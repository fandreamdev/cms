import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { randomUUID } from 'crypto'
import { authConfig } from '../shared/config'
import type { AuthConfigType } from '../shared/config'
import { UserService } from '../shared/services/user.service'
import { checkPassword } from '../shared/utils/pwd'
import { AuthUser } from './auth-user'
import { TokenPayload, TokenType } from './token-payload'
import { CaptchaService, CaptchaResponse } from './captcha.service'
import { AuthRateLimitService } from './auth-rate-limit.service'
import {
  AuthSessionContext,
  RefreshSessionInfo,
  RefreshSessionService,
} from './refresh-session.service'

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export interface AuthResult extends AuthTokens {
  user: AuthUser
}

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    @Inject(authConfig.KEY)
    private readonly config: AuthConfigType,
    private readonly captchaService: CaptchaService,
    private readonly rateLimitService: AuthRateLimitService,
    private readonly refreshSessionService: RefreshSessionService,
  ) {}

  async issueCaptcha(ip: string): Promise<CaptchaResponse> {
    await this.rateLimitService.checkCaptchaRequest(ip)
    return this.captchaService.issue(this.rateLimitService.maskIp(ip))
  }

  async login(
    username: string,
    password: string,
    captchaId: unknown,
    captcha: unknown,
    ip: string,
    context: Omit<AuthSessionContext, 'ip'> = {},
  ): Promise<AuthResult> {
    await this.rateLimitService.checkLogin(ip, username)
    try {
      await this.captchaService.verifyAndConsume(captchaId, captcha)
      const result = await this.loginWithCredentials(username, password, {
        ...context,
        ip: this.rateLimitService.maskIp(ip),
      })
      this.rateLimitService.auditLogin(true, ip, username)
      return result
    } catch (error) {
      this.rateLimitService.auditLogin(false, ip, username)
      throw error
    }
  }

  private async loginWithCredentials(
    username: string,
    password: string,
    context: AuthSessionContext,
  ): Promise<AuthResult> {
    const user = await this.userService.findForLogin(username)
    if (
      !user ||
      user.status !== 1 ||
      !(await checkPassword(password, user.password))
    ) {
      throw new UnauthorizedException('用户名或密码错误')
    }
    return { ...(await this.signTokens(user.id, context)), user }
  }

  async refresh(
    refreshToken: string,
    ip: string,
    context: Omit<AuthSessionContext, 'ip'> = {},
  ): Promise<AuthResult> {
    await this.rateLimitService.checkRefresh(ip)
    let userId: number | undefined
    try {
      const payload = await this.jwtService.verifyAsync<TokenPayload>(
        refreshToken,
        { secret: this.config.refreshTokenSecret },
      )
      this.assertPayload(payload, 'refresh')
      userId = payload.sub

      const user = await this.userService.findForAuthentication(payload.sub)
      if (!user || user.status !== 1) {
        throw new UnauthorizedException('用户不存在或已停用')
      }
      const next = await this.createTokens(user.id)
      const result = await this.refreshSessionService.rotate(
        user.id,
        payload.jti,
        refreshToken,
        next.sessionId,
        next.refreshToken,
        { ...context, ip: this.rateLimitService.maskIp(ip) },
      )
      if (result !== 'ROTATED') {
        if (result === 'REPLAY') {
          this.rateLimitService.auditRefreshReplay(ip, user.id)
        }
        throw new UnauthorizedException('刷新凭证已失效')
      }
      this.rateLimitService.auditRefresh(true, ip, user.id)
      return {
        accessToken: next.accessToken,
        refreshToken: next.refreshToken,
        user,
      }
    } catch (error) {
      this.rateLimitService.auditRefresh(false, ip, userId)
      if (error instanceof UnauthorizedException) throw error
      throw new UnauthorizedException('刷新凭证已失效')
    }
  }

  async logout(userId: number, sessionId: string): Promise<void> {
    await this.refreshSessionService.revoke(userId, sessionId)
  }

  async logoutAll(userId: number): Promise<void> {
    await this.refreshSessionService.revokeAll(userId)
  }

  sessions(userId: number): Promise<RefreshSessionInfo[]> {
    return this.refreshSessionService.list(userId)
  }

  private async signTokens(
    userId: number,
    context: AuthSessionContext,
  ): Promise<AuthTokens> {
    const tokens = await this.createTokens(userId)
    await this.refreshSessionService.create(
      userId,
      tokens.sessionId,
      tokens.refreshToken,
      context,
    )
    return tokens
  }

  private async createTokens(
    userId: number,
  ): Promise<AuthTokens & { sessionId: string }> {
    const sessionId = randomUUID()
    const payload = (tokenType: TokenType): TokenPayload => ({
      sub: userId,
      tokenType,
      jti: randomUUID(),
      sid: sessionId,
    })
    const refreshPayload: TokenPayload = {
      sub: userId,
      tokenType: 'refresh',
      jti: sessionId,
      sid: sessionId,
    }
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload('access'), {
        secret: this.config.accessTokenSecret,
        expiresIn: this.config.accessTokenExpiresIn,
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: this.config.refreshTokenSecret,
        expiresIn: this.config.refreshTokenExpiresIn,
      }),
    ])
    return { accessToken, refreshToken, sessionId }
  }

  private assertPayload(payload: TokenPayload, tokenType: TokenType): void {
    if (
      payload.tokenType !== tokenType ||
      !Number.isInteger(payload.sub) ||
      payload.sub <= 0 ||
      typeof payload.jti !== 'string' ||
      !payload.jti ||
      typeof payload.sid !== 'string' ||
      !payload.sid
    ) {
      throw new UnauthorizedException('令牌类型或负载无效')
    }
  }
}
