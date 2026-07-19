import { Injectable } from '@nestjs/common'
import { Socket, connect as connectSocket } from 'node:net'
import { connect as connectTls, TLSSocket } from 'node:tls'

type RedisReply = string | number | null | RedisReply[] | Error

type ParsedReply = {
  reply: RedisReply
  offset: number
}

/** A minimal RESP client for the small, atomic command set used by authentication. */
@Injectable()
export class RedisCommandService {
  async execute(
    urlValue: string,
    args: readonly (string | number)[],
  ): Promise<RedisReply> {
    const url = new URL(urlValue)
    const commands: (readonly (string | number)[])[] = []
    const password = decodeURIComponent(url.password)
    const username = decodeURIComponent(url.username)
    if (password) {
      commands.push(
        username ? ['AUTH', username, password] : ['AUTH', password],
      )
    }

    const database = url.pathname.replace(/^\//, '')
    if (database && database !== '0') commands.push(['SELECT', database])
    commands.push(args)

    return new Promise<RedisReply>((resolve, reject) => {
      const socket: Socket | TLSSocket =
        url.protocol === 'rediss:'
          ? connectTls({ host: url.hostname, port: this.port(url) })
          : connectSocket({ host: url.hostname, port: this.port(url) })
      let buffer = Buffer.alloc(0)
      const replies: RedisReply[] = []
      let settled = false

      const fail = (error: Error) => {
        if (settled) return
        settled = true
        socket.destroy()
        reject(error)
      }

      socket.setTimeout(3_000, () => fail(new Error('Redis command timed out')))
      socket.once('error', fail)
      socket.once('close', () => {
        if (!settled) fail(new Error('Redis connection closed unexpectedly'))
      })
      socket.once(
        url.protocol === 'rediss:' ? 'secureConnect' : 'connect',
        () => {
          socket.write(
            Buffer.concat(commands.map((command) => this.encode(command))),
          )
        },
      )
      socket.on('data', (chunk: Buffer) => {
        buffer = Buffer.concat([buffer, chunk])
        while (true) {
          const parsed = this.parse(buffer)
          if (!parsed) break
          buffer = buffer.subarray(parsed.offset)
          replies.push(parsed.reply)
        }
        if (replies.length !== commands.length || settled) return

        const error = replies.find((reply) => reply instanceof Error)
        if (error instanceof Error) return fail(error)
        settled = true
        socket.end()
        resolve(replies.at(-1) ?? null)
      })
    })
  }

  private port(url: URL): number {
    return url.port ? Number(url.port) : 6379
  }

  private encode(args: readonly (string | number)[]): Buffer {
    const values = args.map((value) => Buffer.from(String(value)))
    return Buffer.concat([
      Buffer.from(`*${values.length}\r\n`),
      ...values.flatMap((value) => [
        Buffer.from(`$${value.length}\r\n`),
        value,
        Buffer.from('\r\n'),
      ]),
    ])
  }

  private parse(buffer: Buffer, offset = 0): ParsedReply | undefined {
    if (offset >= buffer.length) return undefined
    const type = String.fromCharCode(buffer[offset])
    const lineEnd = buffer.indexOf('\r\n', offset)
    if (lineEnd < 0) return undefined
    const line = buffer.toString('utf8', offset + 1, lineEnd)
    const bodyOffset = lineEnd + 2

    if (type === '+') return { reply: line, offset: bodyOffset }
    if (type === '-') return { reply: new Error(line), offset: bodyOffset }
    if (type === ':') return { reply: Number(line), offset: bodyOffset }
    if (type === '$') {
      const length = Number(line)
      if (length === -1) return { reply: null, offset: bodyOffset }
      const end = bodyOffset + length
      if (buffer.length < end + 2) return undefined
      return {
        reply: buffer.toString('utf8', bodyOffset, end),
        offset: end + 2,
      }
    }
    if (type === '*') {
      const length = Number(line)
      if (length === -1) return { reply: null, offset: bodyOffset }
      const values: RedisReply[] = []
      let next = bodyOffset
      for (let index = 0; index < length; index += 1) {
        const item = this.parse(buffer, next)
        if (!item) return undefined
        values.push(item.reply)
        next = item.offset
      }
      return { reply: values, offset: next }
    }
    throw new Error('Unsupported Redis response type')
  }
}
