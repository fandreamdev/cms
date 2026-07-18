import { ForbiddenException, Injectable, OnModuleDestroy } from '@nestjs/common'
import { createHash, randomBytes } from 'node:crypto'
import type { IncomingMessage, Server } from 'node:http'
import { URL } from 'node:url'
import { WebSocket, WebSocketServer } from 'ws'
import type { AuthUser } from '../../auth/auth-user'
import { UserService } from './user.service'
import {
  DashboardSystemService,
  DashboardSystemStatus,
} from './dashboard-system.service'
import { systemMonitorConfig } from '../config'
import type { SystemMonitorConfigType } from '../config'
import { Inject } from '@nestjs/common'

const STREAM_PATH = '/api/dashboard/system/stream'
const TICKET_TTL_MS = 30_000
const HEARTBEAT_MS = 25_000
const MAX_BUFFERED_BYTES = 1024 * 1024

interface SocketTicket {
  userId: number
  permissionsFingerprint: string
  expiresAt: number
  path: string
}

interface ClientConnection {
  userId: number
  socket: WebSocket
  lastPongAt: number
}

export interface DashboardSystemSocketTicket {
  ticket: string
  expiresAt: Date
}

@Injectable()
export class DashboardSystemSocketService implements OnModuleDestroy {
  private readonly tickets = new Map<string, SocketTicket>()
  private readonly clients = new Map<WebSocket, ClientConnection>()
  private readonly clientCounts = new Map<number, number>()
  private readonly websocketServer = new WebSocketServer({ noServer: true })
  private sequence = 0
  private attached = false
  private heartbeat?: NodeJS.Timeout
  private unsubscribe?: () => void

  constructor(
    private readonly userService: UserService,
    private readonly systemService: DashboardSystemService,
    @Inject(systemMonitorConfig.KEY)
    private readonly config: SystemMonitorConfigType,
  ) {
    // The server is attached explicitly from main.ts after Nest creates the
    // HTTP server, so all upgrade checks remain under this service.
  }

  attach(server: Server): void {
    if (this.attached) return
    this.attached = true
    server.on('upgrade', (request, socket, head) => {
      void this.handleUpgrade(request, socket, head)
    })
    this.unsubscribe = this.systemService.subscribe(
      (status) => void this.broadcastStatus(status),
    )
    this.heartbeat = setInterval(
      () => void this.checkConnections(),
      HEARTBEAT_MS,
    )
    this.heartbeat.unref()
  }

  issueTicket(user: AuthUser): DashboardSystemSocketTicket {
    this.assertMonitorPermission(user)
    const ticket = randomBytes(32).toString('base64url')
    const expiresAt = new Date(Date.now() + TICKET_TTL_MS)
    this.tickets.set(this.hash(ticket), {
      userId: user.id,
      permissionsFingerprint: this.permissionsFingerprint(user),
      expiresAt: expiresAt.getTime(),
      path: STREAM_PATH,
    })
    return { ticket, expiresAt }
  }

  onModuleDestroy(): void {
    this.unsubscribe?.()
    if (this.heartbeat) clearInterval(this.heartbeat)
    for (const client of this.clients.values()) client.socket.close(1001)
    this.clients.clear()
    this.clientCounts.clear()
    this.tickets.clear()
    this.websocketServer.close()
  }

  private async handleUpgrade(
    request: IncomingMessage,
    socket: import('node:stream').Duplex,
    head: Buffer,
  ): Promise<void> {
    const url = new URL(request.url ?? '/', 'http://localhost')
    if (url.pathname !== STREAM_PATH) return
    const ticket = url.searchParams.get('ticket')
    if (!ticket) return this.rejectUpgrade(socket, 4401, 'Unauthorized')

    const user = await this.consumeTicket(ticket)
    if (!user) return this.rejectUpgrade(socket, 4401, 'Unauthorized')
    if (!this.hasConnectionCapacity(user.id)) {
      return this.rejectUpgrade(socket, 4429, 'Too many connections')
    }

    this.websocketServer.handleUpgrade(request, socket, head, (client) => {
      this.registerClient(client, user.id)
      this.sendStatus(client, this.systemService.getStatus())
    })
  }

  private async consumeTicket(ticket: string): Promise<AuthUser | null> {
    const key = this.hash(ticket)
    const stored = this.tickets.get(key)
    this.tickets.delete(key)
    if (
      !stored ||
      stored.expiresAt < Date.now() ||
      stored.path !== STREAM_PATH
    ) {
      return null
    }

    const user = await this.userService.findForAuthentication(stored.userId)
    if (!user || !this.canMonitor(user)) return null
    if (this.permissionsFingerprint(user) !== stored.permissionsFingerprint)
      return null
    return user
  }

  private registerClient(socket: WebSocket, userId: number): void {
    const connection: ClientConnection = {
      userId,
      socket,
      lastPongAt: Date.now(),
    }
    this.clients.set(socket, connection)
    this.clientCounts.set(userId, (this.clientCounts.get(userId) ?? 0) + 1)
    socket.on('message', (data) =>
      this.handleMessage(connection, data.toString()),
    )
    socket.on('close', () => this.unregisterClient(connection))
    socket.on('error', () => this.unregisterClient(connection))
  }

  private unregisterClient(connection: ClientConnection): void {
    if (!this.clients.delete(connection.socket)) return
    const remaining = (this.clientCounts.get(connection.userId) ?? 1) - 1
    if (remaining > 0) this.clientCounts.set(connection.userId, remaining)
    else this.clientCounts.delete(connection.userId)
  }

  private handleMessage(connection: ClientConnection, source: string): void {
    try {
      const message = JSON.parse(source) as {
        type?: unknown
        timestamp?: unknown
      }
      if (message.type === 'pong') connection.lastPongAt = Date.now()
      if (message.type === 'ping') {
        this.send(connection.socket, {
          type: 'pong',
          timestamp: message.timestamp ?? Date.now(),
        })
      }
    } catch {
      // Invalid client messages are ignored; status data is server-push only.
    }
  }

  private async broadcastStatus(status: DashboardSystemStatus): Promise<void> {
    const message = {
      type: 'system.status',
      sequence: ++this.sequence,
      data: status,
    }
    for (const connection of this.clients.values()) {
      const user = await this.userService.findForAuthentication(
        connection.userId,
      )
      if (!user || !this.canMonitor(user)) {
        connection.socket.close(4403, 'Permission revoked')
        continue
      }
      this.send(connection.socket, message)
    }
  }

  private sendStatus(socket: WebSocket, status: DashboardSystemStatus): void {
    this.send(socket, {
      type: 'system.status',
      sequence: ++this.sequence,
      data: status,
    })
  }

  private async checkConnections(): Promise<void> {
    const now = Date.now()
    for (const connection of this.clients.values()) {
      if (now - connection.lastPongAt > HEARTBEAT_MS * 2) {
        connection.socket.close(4401, 'Heartbeat timeout')
        continue
      }
      this.send(connection.socket, { type: 'ping', timestamp: now })
    }
  }

  private send(socket: WebSocket, message: unknown): void {
    if (
      socket.readyState !== WebSocket.OPEN ||
      socket.bufferedAmount > MAX_BUFFERED_BYTES
    )
      return
    socket.send(JSON.stringify(message))
  }

  private hasConnectionCapacity(userId: number): boolean {
    return (
      (this.clientCounts.get(userId) ?? 0) <
      (this.config.maxConnectionsPerUser ?? 3)
    )
  }

  private canMonitor(user: AuthUser): boolean {
    return user.isSuper || user.permissions.includes('system:monitor')
  }

  private assertMonitorPermission(user: AuthUser): void {
    if (!this.canMonitor(user)) throw new ForbiddenException('没有访问权限')
  }

  private permissionsFingerprint(user: AuthUser): string {
    return this.hash([...user.permissions].sort().join('\n'))
  }

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex')
  }

  private rejectUpgrade(
    socket: import('node:stream').Duplex,
    closeCode: number,
    message: string,
  ): void {
    const status = closeCode === 4429 ? 429 : closeCode === 4403 ? 403 : 401
    socket.write(`HTTP/1.1 ${status} ${message}\r\nConnection: close\r\n\r\n`)
    socket.destroy()
  }
}
