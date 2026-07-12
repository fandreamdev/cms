import { Body, Get, Post } from '@nestjs/common'
import { ApiResourceController } from '../api/common'
import { CurrentUser } from './current-user.decorator'
import { Public } from './public.decorator'
import { AuthService } from './auth.service'
import type { AuthUser } from './auth-user'
import { LoginDto } from './dto/login.dto'

@ApiResourceController('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.username, dto.password)
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser): AuthUser {
    return user
  }
}
