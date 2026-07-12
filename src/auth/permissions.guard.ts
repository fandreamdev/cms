import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Request } from 'express'
import type { AuthUser } from './auth-user'
import { PERMISSIONS_KEY } from './permissions.decorator'

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    )
    if (!required?.length) return true

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>()
    const user = request.user
    if (!user) throw new ForbiddenException('没有访问权限')
    if (user.isSuper) return true
    if (
      !required.every((permission) => user.permissions.includes(permission))
    ) {
      throw new ForbiddenException('没有访问权限')
    }
    return true
  }
}
