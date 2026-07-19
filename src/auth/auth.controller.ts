import {
  Body,
  Delete,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common'
import { ApiBody, ApiOkResponse, ApiOperation } from '@nestjs/swagger'
import type { Request } from 'express'
import { ApiResourceController } from '../api/common'
import { CurrentUser } from './current-user.decorator'
import { Public } from './public.decorator'
import { AuthService } from './auth.service'
import type { AuthUser } from './auth-user'
import { LoginDto } from './dto/login.dto'
import { RefreshTokenDto } from './dto/refresh-token.dto'
import { CaptchaResponse } from './captcha.service'

@ApiResourceController('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Get('captcha')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
  @ApiOperation({ summary: '获取一次性登录验证码' })
  @ApiOkResponse({
    schema: {
      example: {
        code: 0,
        message: 'success',
        data: {
          captchaId: 'a7c2f0d8-9b70-4cde-9f1c-6ffea4ea11aa',
          image: 'data:image/png;base64,iVBORw0KGgo...',
        },
      },
    },
  })
  captcha(@Req() request: Request): Promise<CaptchaResponse> {
    return this.authService.issueCaptcha(this.clientIp(request))
  }

  @Public()
  @Post('login')
  @ApiBody({ type: LoginDto })
  login(@Body() dto: LoginDto, @Req() request: Request) {
    return this.authService.login(
      dto.username,
      dto.password,
      dto.captchaId,
      dto.captcha,
      this.clientIp(request),
      this.sessionContext(request),
    )
  }

  @Public()
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto, @Req() request: Request) {
    return this.authService.refresh(
      dto.refreshToken,
      this.clientIp(request),
      this.sessionContext(request),
    )
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser): AuthUser {
    return user
  }

  @Post('logout')
  logout(
    @CurrentUser() user: AuthUser,
    @Req() request: Request & { authSessionId?: string },
  ): Promise<void> {
    return this.authService.logout(user.id, this.sessionId(request))
  }

  @Post('logout-all')
  logoutAll(@CurrentUser() user: AuthUser): Promise<void> {
    return this.authService.logoutAll(user.id)
  }

  @Get('sessions')
  sessions(@CurrentUser() user: AuthUser) {
    return this.authService.sessions(user.id)
  }

  @Delete('sessions/:id')
  async revokeSession(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) sessionId: string,
  ): Promise<void> {
    await this.authService.logout(user.id, sessionId)
  }

  private clientIp(request: Request): string {
    return request.ip || request.socket.remoteAddress || 'unknown'
  }

  private sessionContext(request: Request): {
    userAgent?: string
    deviceName?: string
  } {
    return {
      userAgent: this.header(request, 'user-agent'),
      deviceName: this.header(request, 'x-device-name'),
    }
  }

  private header(request: Request, name: string): string | undefined {
    const value = request.headers[name]
    return Array.isArray(value) ? value[0] : value
  }

  private sessionId(request: Request & { authSessionId?: string }): string {
    if (!request.authSessionId)
      throw new UnauthorizedException('登录会话已失效')
    return request.authSessionId
  }
}
