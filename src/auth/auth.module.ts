import { Global, Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { JwtModule } from '@nestjs/jwt'
import { authConfig } from '../shared/config'
import type { AuthConfigType } from '../shared/config'
import { AuthController } from './auth.controller'
import { JwtAuthGuard } from './jwt-auth.guard'
import { PermissionsGuard } from './permissions.guard'
import { AuthService } from './auth.service'
import { SystemModule } from '../modules/system/system.module'
import { CaptchaService } from './captcha.service'
import { CaptchaStoreService } from './captcha-store.service'
import { RedisCommandService } from './redis-command.service'
import { AuthRateLimitService } from './auth-rate-limit.service'
import { RefreshSessionService } from './refresh-session.service'

@Global()
@Module({
  imports: [
    SystemModule,
    JwtModule.registerAsync({
      inject: [authConfig.KEY],
      useFactory: (config: AuthConfigType) => ({
        secret: config.accessTokenSecret,
        signOptions: { expiresIn: config.accessTokenExpiresIn ?? 7200 },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    CaptchaService,
    CaptchaStoreService,
    RedisCommandService,
    AuthRateLimitService,
    RefreshSessionService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
  exports: [JwtModule, AuthService],
})
export class AuthModule {}
