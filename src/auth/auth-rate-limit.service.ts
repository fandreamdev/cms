import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common'
import { createHmac } from 'node:crypto'
import { authConfig } from '../shared/config'
import type { AuthConfigType } from '../shared/config'
import { CaptchaStoreService } from './captcha-store.service'

@Injectable()
export class AuthRateLimitService {
  private readonly logger = new Logger(AuthRateLimitService.name)

  constructor(
    private readonly store: CaptchaStoreService,
    @Inject(authConfig.KEY) private readonly config: AuthConfigType,
  ) {}

  async checkCaptchaRequest(ip: string): Promise<void> {
    await this.check(
      `auth:rate:captcha:ip:${this.fingerprint(ip)}`,
      this.config.captchaRateLimitPerMinute ?? 20,
      60,
      'captcha_rate_limited',
      { ip: this.maskIp(ip) },
    )
  }

  async checkLogin(ip: string, username: string): Promise<void> {
    await this.check(
      `auth:rate:login:ip:${this.fingerprint(ip)}`,
      this.config.loginIpRateLimitPerMinute ?? 10,
      60,
      'login_ip_rate_limited',
      { ip: this.maskIp(ip) },
    )
    await this.check(
      `auth:rate:login:username:${this.fingerprint(username.trim().toLowerCase())}`,
      this.config.loginUsernameRateLimitPerFiveMinutes ?? 5,
      300,
      'login_username_rate_limited',
      { username: this.fingerprint(username.trim().toLowerCase()) },
    )
  }

  async checkRefresh(ip: string): Promise<void> {
    await this.check(
      `auth:rate:refresh:ip:${this.fingerprint(ip)}`,
      this.config.refreshIpRateLimitPerMinute ?? 30,
      60,
      'refresh_rate_limited',
      { ip: this.maskIp(ip) },
    )
  }

  auditLogin(success: boolean, ip: string, username: string): void {
    this.logger.log(
      JSON.stringify({
        event: success ? 'auth.login_succeeded' : 'auth.login_failed',
        ip: this.maskIp(ip),
        username: this.fingerprint(username.trim().toLowerCase()),
      }),
    )
  }

  auditRefresh(success: boolean, ip: string, userId?: number): void {
    this.logger.log(
      JSON.stringify({
        event: success ? 'auth.refresh_succeeded' : 'auth.refresh_failed',
        ip: this.maskIp(ip),
        userId,
      }),
    )
  }

  auditRefreshReplay(ip: string, userId: number): void {
    this.logger.warn(
      JSON.stringify({
        event: 'auth.refresh_replay_detected',
        ip: this.maskIp(ip),
        userId,
      }),
    )
  }

  maskIp(ip: string): string {
    if (ip.includes('.')) return ip.replace(/\d+$/, '0')
    return ip.replace(/(?:[0-9a-f]{1,4}:){1,4}[0-9a-f]{0,4}$/i, '::')
  }

  private async check(
    key: string,
    limit: number,
    windowSeconds: number,
    event: string,
    details: Record<string, string>,
  ): Promise<void> {
    const count = await this.store.incrementRateLimit(key, windowSeconds)
    if (count <= limit) return
    this.logger.warn(JSON.stringify({ event: `auth.${event}`, ...details }))
    throw new HttpException(
      '请求过于频繁，请稍后再试',
      HttpStatus.TOO_MANY_REQUESTS,
    )
  }

  private fingerprint(value: string): string {
    return createHmac('sha256', this.config.captchaHmacSecret)
      .update(value)
      .digest('hex')
      .slice(0, 16)
  }
}
