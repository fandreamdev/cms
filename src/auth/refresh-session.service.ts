import { Inject, Injectable } from '@nestjs/common'
import { createHmac } from 'node:crypto'
import { authConfig } from '../shared/config'
import type { AuthConfigType } from '../shared/config'
import { RedisCommandService } from './redis-command.service'

export interface AuthSessionContext {
  ip: string
  userAgent?: string
  deviceName?: string
}

export interface RefreshSessionInfo {
  id: string
  createdAt: string
  lastUsedAt: string
  expiresAt: string
  ip: string
  userAgent?: string
  deviceName?: string
}

type StoredRefreshSession = RefreshSessionInfo & {
  userId: number
  familyId: string
  tokenHash: string
}

type RotationResult = 'ROTATED' | 'REPLAY' | 'INVALID'

const CREATE_SESSION_SCRIPT = [
  "redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[2])",
  "redis.call('ZADD', KEYS[2], ARGV[3], ARGV[4])",
  "redis.call('PEXPIRE', KEYS[2], ARGV[2])",
  "redis.call('ZADD', KEYS[3], ARGV[3], ARGV[4])",
  "redis.call('PEXPIRE', KEYS[3], ARGV[2])",
  'return 1',
].join('\n')

const ROTATE_SESSION_SCRIPT = [
  "local old = redis.call('GET', KEYS[1])",
  'if not old then',
  "  local familyId = redis.call('GET', KEYS[2])",
  '  if familyId then',
  '    local familyKey = ARGV[8] .. familyId',
  "    local sessionIds = redis.call('ZRANGE', familyKey, 0, -1)",
  '    for _, sessionId in ipairs(sessionIds) do',
  "      redis.call('DEL', ARGV[7] .. sessionId)",
  "      redis.call('ZREM', KEYS[4], sessionId)",
  '    end',
  "    redis.call('DEL', familyKey)",
  "    return { 'REPLAY', familyId }",
  '  end',
  "  return { 'INVALID' }",
  'end',
  'local session = cjson.decode(old)',
  "if session.userId ~= tonumber(ARGV[9]) then return { 'INVALID' } end",
  "if session.tokenHash ~= ARGV[1] then return { 'INVALID' } end",
  "local oldTtl = redis.call('PTTL', KEYS[1])",
  "if oldTtl <= 0 then return { 'INVALID' } end",
  'local next = cjson.decode(ARGV[2])',
  'next.familyId = session.familyId',
  "redis.call('DEL', KEYS[1])",
  "redis.call('SET', KEYS[2], session.familyId, 'PX', oldTtl)",
  "redis.call('SET', KEYS[3], cjson.encode(next), 'PX', ARGV[3])",
  "redis.call('ZREM', KEYS[4], ARGV[4])",
  "redis.call('ZADD', KEYS[4], ARGV[5], ARGV[6])",
  "redis.call('PEXPIRE', KEYS[4], ARGV[3])",
  'local familyKey = ARGV[8] .. session.familyId',
  "redis.call('ZREM', familyKey, ARGV[4])",
  "redis.call('ZADD', familyKey, ARGV[5], ARGV[6])",
  "redis.call('PEXPIRE', familyKey, ARGV[3])",
  "return { 'ROTATED' }",
].join('\n')

@Injectable()
export class RefreshSessionService {
  constructor(
    private readonly redis: RedisCommandService,
    @Inject(authConfig.KEY) private readonly config: AuthConfigType,
  ) {}

  async create(
    userId: number,
    sessionId: string,
    refreshToken: string,
    context: AuthSessionContext,
  ): Promise<void> {
    const now = new Date()
    const expiresAt = new Date(now.getTime() + this.ttlMilliseconds())
    const session = this.session(
      userId,
      sessionId,
      sessionId,
      refreshToken,
      now,
      expiresAt,
      context,
    )
    await this.redis.execute(this.config.captchaRedisUrl, [
      'EVAL',
      CREATE_SESSION_SCRIPT,
      3,
      this.sessionKey(sessionId),
      this.userSessionsKey(userId),
      this.familySessionsKey(session.familyId),
      JSON.stringify(session),
      this.ttlMilliseconds(),
      expiresAt.getTime(),
      sessionId,
    ])
  }

  async rotate(
    userId: number,
    oldSessionId: string,
    oldRefreshToken: string,
    newSessionId: string,
    newRefreshToken: string,
    context: AuthSessionContext,
  ): Promise<RotationResult> {
    const now = new Date()
    const expiresAt = new Date(now.getTime() + this.ttlMilliseconds())
    const next = this.session(
      userId,
      newSessionId,
      oldSessionId,
      newRefreshToken,
      now,
      expiresAt,
      context,
    )
    const response = await this.redis.execute(this.config.captchaRedisUrl, [
      'EVAL',
      ROTATE_SESSION_SCRIPT,
      4,
      this.sessionKey(oldSessionId),
      this.usedKey(oldSessionId),
      this.sessionKey(newSessionId),
      this.userSessionsKey(userId),
      this.tokenHash(oldRefreshToken),
      JSON.stringify(next),
      this.ttlMilliseconds(),
      oldSessionId,
      expiresAt.getTime(),
      newSessionId,
      'auth:refresh:session:',
      'auth:refresh:family:',
      userId,
    ])
    return Array.isArray(response) && typeof response[0] === 'string'
      ? (response[0] as RotationResult)
      : 'INVALID'
  }

  async assertActive(userId: number, sessionId: string): Promise<boolean> {
    const session = await this.get(sessionId)
    return session?.userId === userId
  }

  async list(userId: number): Promise<RefreshSessionInfo[]> {
    const ids = await this.redis.execute(this.config.captchaRedisUrl, [
      'ZRANGE',
      this.userSessionsKey(userId),
      0,
      -1,
    ])
    if (!Array.isArray(ids) || !ids.length) return []
    const values = await this.redis.execute(this.config.captchaRedisUrl, [
      'MGET',
      ...ids
        .filter((id): id is string => typeof id === 'string')
        .map((id) => this.sessionKey(id)),
    ])
    if (!Array.isArray(values)) return []
    return values
      .map((value) => (typeof value === 'string' ? this.parse(value) : null))
      .filter(
        (session): session is StoredRefreshSession =>
          session?.userId === userId,
      )
      .map(
        ({
          tokenHash: _tokenHash,
          familyId: _familyId,
          userId: _userId,
          ...session
        }) => session,
      )
  }

  async revoke(userId: number, sessionId: string): Promise<boolean> {
    const session = await this.get(sessionId)
    if (!session || session.userId !== userId) return false
    await this.redis.execute(this.config.captchaRedisUrl, [
      'DEL',
      this.sessionKey(sessionId),
    ])
    await this.redis.execute(this.config.captchaRedisUrl, [
      'ZREM',
      this.userSessionsKey(userId),
      sessionId,
    ])
    await this.redis.execute(this.config.captchaRedisUrl, [
      'ZREM',
      this.familySessionsKey(session.familyId),
      sessionId,
    ])
    return true
  }

  async revokeAll(userId: number): Promise<void> {
    const sessions = await this.listStored(userId)
    if (!sessions.length) return
    await Promise.all(
      sessions.map((session) =>
        this.redis.execute(this.config.captchaRedisUrl, [
          'DEL',
          this.sessionKey(session.id),
        ]),
      ),
    )
    await this.redis.execute(this.config.captchaRedisUrl, [
      'DEL',
      this.userSessionsKey(userId),
    ])
  }

  private async listStored(userId: number): Promise<StoredRefreshSession[]> {
    const ids = await this.redis.execute(this.config.captchaRedisUrl, [
      'ZRANGE',
      this.userSessionsKey(userId),
      0,
      -1,
    ])
    if (!Array.isArray(ids) || !ids.length) return []
    const sessions = await Promise.all(
      ids
        .filter((id): id is string => typeof id === 'string')
        .map((id) => this.get(id)),
    )
    return sessions.filter(
      (session): session is StoredRefreshSession => session?.userId === userId,
    )
  }

  private async get(sessionId: string): Promise<StoredRefreshSession | null> {
    const raw = await this.redis.execute(this.config.captchaRedisUrl, [
      'GET',
      this.sessionKey(sessionId),
    ])
    return typeof raw === 'string' ? this.parse(raw) : null
  }

  private session(
    userId: number,
    id: string,
    familyId: string,
    refreshToken: string,
    createdAt: Date,
    expiresAt: Date,
    context: AuthSessionContext,
  ): StoredRefreshSession {
    return {
      id,
      userId,
      familyId,
      tokenHash: this.tokenHash(refreshToken),
      createdAt: createdAt.toISOString(),
      lastUsedAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      ip: context.ip,
      userAgent: context.userAgent?.slice(0, 256),
      deviceName: context.deviceName?.slice(0, 120),
    }
  }

  private tokenHash(refreshToken: string): string {
    return createHmac('sha256', this.config.refreshSessionHmacSecret)
      .update(refreshToken)
      .digest('hex')
  }

  private parse(value: string): StoredRefreshSession | null {
    try {
      const session = JSON.parse(value) as Partial<StoredRefreshSession>
      return typeof session.id === 'string' &&
        typeof session.userId === 'number' &&
        typeof session.familyId === 'string' &&
        typeof session.tokenHash === 'string'
        ? (session as StoredRefreshSession)
        : null
    } catch {
      return null
    }
  }

  private ttlMilliseconds(): number {
    return (this.config.refreshTokenExpiresIn ?? 604800) * 1000
  }

  private sessionKey(sessionId: string): string {
    return `auth:refresh:session:${sessionId}`
  }

  private usedKey(sessionId: string): string {
    return `auth:refresh:used:${sessionId}`
  }

  private userSessionsKey(userId: number): string {
    return `auth:refresh:user:${userId}`
  }

  private familySessionsKey(familyId: string): string {
    return `auth:refresh:family:${familyId}`
  }
}
