import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { Reflector } from '@nestjs/core'
import { Request } from 'express'
import { UserService } from '../shared/services/user.service'
import type { AuthUser } from './auth-user'
import { IS_PUBLIC_KEY } from './public.decorator'
import { authConfig } from '../shared/config'
import type { AuthConfigType } from '../shared/config'
import { TokenPayload } from './token-payload'
import { RefreshSessionService } from './refresh-session.service'

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
    @Inject(authConfig.KEY)
    private readonly config: AuthConfigType,
    private readonly refreshSessionService: RefreshSessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser; authSessionId?: string }>()
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
        !payload.jti ||
        typeof payload.sid !== 'string' ||
        !payload.sid
      ) {
        throw new UnauthorizedException('令牌类型或负载无效')
      }
      const user = await this.userService.findForAuthentication(payload.sub)
      if (!user || user.status !== 1) {
        throw new UnauthorizedException('用户不存在或已停用')
      }
      if (
        !(await this.refreshSessionService.assertActive(user.id, payload.sid))
      ) {
        throw new UnauthorizedException('登录会话已失效')
      }
      request.user = user
      request.authSessionId = payload.sid
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
