import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common'
import { authConfig } from '../shared/config'
import type { AuthConfigType } from '../shared/config'
import { RedisCommandService } from './redis-command.service'

const CONSUME_CAPTCHA_SCRIPT = [
  "local value = redis.call('GET', KEYS[1])",
  "if value then redis.call('DEL', KEYS[1]) end",
  'return value',
].join('\n')

const INCREMENT_WITH_TTL_SCRIPT = [
  "local count = redis.call('INCR', KEYS[1])",
  "if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end",
  'return count',
].join('\n')

@Injectable()
export class CaptchaStoreService {
  constructor(
    private readonly redis: RedisCommandService,
    @Inject(authConfig.KEY) private readonly config: AuthConfigType,
  ) {}

  async create(captchaId: string, answerHash: string): Promise<void> {
    try {
      const result = await this.redis.execute(this.config.captchaRedisUrl, [
        'SET',
        this.captchaKey(captchaId),
        answerHash,
        'PX',
        (this.config.captchaTtlSeconds ?? 300) * 1000,
        'NX',
      ])
      if (result !== 'OK') throw new Error('Captcha ID collision')
    } catch (error) {
      throw this.unavailable(error)
    }
  }

  /** Atomically reads and deletes a record so every validation attempt consumes it. */
  async consume(captchaId: string): Promise<string | null> {
    try {
      const result = await this.redis.execute(this.config.captchaRedisUrl, [
        'EVAL',
        CONSUME_CAPTCHA_SCRIPT,
        1,
        this.captchaKey(captchaId),
      ])
      return typeof result === 'string' ? result : null
    } catch (error) {
      throw this.unavailable(error)
    }
  }

  async incrementRateLimit(
    key: string,
    windowSeconds: number,
  ): Promise<number> {
    try {
      const result = await this.redis.execute(this.config.captchaRedisUrl, [
        'EVAL',
        INCREMENT_WITH_TTL_SCRIPT,
        1,
        key,
        windowSeconds,
      ])
      if (typeof result !== 'number')
        throw new Error('Unexpected Redis rate-limit response')
      return result
    } catch (error) {
      throw this.unavailable(error)
    }
  }

  private captchaKey(captchaId: string): string {
    return `auth:captcha:${captchaId}`
  }

  private unavailable(error: unknown): ServiceUnavailableException {
    return new ServiceUnavailableException(
      {
        code: 'CAPTCHA_SERVICE_UNAVAILABLE',
        message: '验证码服务暂不可用，请稍后重试',
      },
      { cause: error instanceof Error ? error : undefined },
    )
  }
}
