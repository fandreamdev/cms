import { Body, Get, Post } from '@nestjs/common'
import { ApiResourceController } from '../api/common'
import { CurrentUser } from './current-user.decorator'
import { Public } from './public.decorator'
import { AuthService } from './auth.service'
import type { AuthUser } from './auth-user'
import { LoginDto } from './dto/login.dto'
import { RefreshTokenDto } from './dto/refresh-token.dto'

@ApiResourceController('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.username, dto.password)
  }

  @Public()
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken)
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser): AuthUser {
    return user
  }
}
