import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { UserService } from '../shared/services/user.service'
import { checkPassword } from '../shared/utils/pwd'
import { AuthUser } from './auth-user'

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
  ) {}

  async login(
    username: string,
    password: string,
  ): Promise<{ accessToken: string; user: AuthUser }> {
    const user = await this.userService.findForLogin(username)
    if (
      !user ||
      user.status !== 1 ||
      !(await checkPassword(password, user.password))
    ) {
      throw new UnauthorizedException('用户名或密码错误')
    }
    return {
      accessToken: await this.jwtService.signAsync({ sub: user.id }),
      user,
    }
  }
}
