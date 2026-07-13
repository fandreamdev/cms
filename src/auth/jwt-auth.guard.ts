import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { Reflector } from '@nestjs/core'
import { Request } from 'express'
import { UserService } from '../shared/services/user.service'
import type { AuthUser } from './auth-user'
import { IS_PUBLIC_KEY } from './public.decorator'
import { AppConfigType, AuthConfigType } from '../shared/config'
import { TokenPayload } from './token-payload'

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
    configService: ConfigService<AppConfigType>,
  ) {
    this.config = configService.get<AuthConfigType>('auth') as AuthConfigType
  }

  private readonly config: AuthConfigType

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>()
    const token = this.extractToken(request)
    if (!token) throw new UnauthorizedException('请先登录')

    try {
      const payload = await this.jwtService.verifyAsync<TokenPayload>(token, {
        secret: this.config.accessTokenSecret,
      })
      if (
        payload.tokenType !== 'access' ||
        !Number.isInteger(payload.sub) ||
        payload.sub <= 0 ||
        typeof payload.jti !== 'string' ||
        !payload.jti
      ) {
        throw new UnauthorizedException('Token 类型或负载无效')
      }
      const user = await this.userService.findForAuthentication(payload.sub)
      if (!user || user.status !== 1) {
        throw new UnauthorizedException('用户不存在或已停用')
      }
      request.user = user
      return true
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error
      throw new UnauthorizedException('登录状态已失效')
    }
  }

  private extractToken(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? []
    return type === 'Bearer' ? token : undefined
  }
}
