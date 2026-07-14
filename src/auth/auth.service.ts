import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { randomUUID } from 'crypto'
import { authConfig } from '../shared/config'
import type { AuthConfigType } from '../shared/config'
import { UserService } from '../shared/services/user.service'
import { checkPassword } from '../shared/utils/pwd'
import { AuthUser } from './auth-user'
import { TokenPayload, TokenType } from './token-payload'

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
  ) {}

  async login(username: string, password: string): Promise<AuthResult> {
    const user = await this.userService.findForLogin(username)
    if (
      !user ||
      user.status !== 1 ||
      !(await checkPassword(password, user.password))
    ) {
      throw new UnauthorizedException('用户名或密码错误')
    }
    return { ...(await this.signTokens(user.id)), user }
  }

  async refresh(refreshToken: string): Promise<AuthResult> {
    try {
      const payload = await this.jwtService.verifyAsync<TokenPayload>(
        refreshToken,
        { secret: this.config.refreshTokenSecret },
      )
      this.assertPayload(payload, 'refresh')

      const user = await this.userService.findForAuthentication(payload.sub)
      if (!user || user.status !== 1) {
        throw new UnauthorizedException('用户不存在或已停用')
      }
      return { ...(await this.signTokens(user.id)), user }
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error
      throw new UnauthorizedException('刷新凭证已失效')
    }
  }

  private async signTokens(userId: number): Promise<AuthTokens> {
    const payload = (tokenType: TokenType): TokenPayload => ({
      sub: userId,
      tokenType,
      jti: randomUUID(),
    })
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload('access'), {
        secret: this.config.accessTokenSecret,
        expiresIn: this.config.accessTokenExpiresIn,
      }),
      this.jwtService.signAsync(payload('refresh'), {
        secret: this.config.refreshTokenSecret,
        expiresIn: this.config.refreshTokenExpiresIn,
      }),
    ])
    return { accessToken, refreshToken }
  }

  private assertPayload(payload: TokenPayload, tokenType: TokenType): void {
    if (
      payload.tokenType !== tokenType ||
      !Number.isInteger(payload.sub) ||
      payload.sub <= 0 ||
      typeof payload.jti !== 'string' ||
      !payload.jti
    ) {
      throw new UnauthorizedException('令牌类型或负载无效')
    }
  }
}
