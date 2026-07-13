import { Global, Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'
import { JwtModule } from '@nestjs/jwt'
import { AppConfigType, AuthConfigType } from '../shared/config'
import { AuthController } from './auth.controller'
import { JwtAuthGuard } from './jwt-auth.guard'
import { PermissionsGuard } from './permissions.guard'
import { AuthService } from './auth.service'
import { SystemModule } from '../modules/system/system.module'

@Global()
@Module({
  imports: [
    SystemModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfigType>) => {
        const config = configService.get<AuthConfigType>('auth')
        return {
          secret: config?.accessTokenSecret,
          signOptions: { expiresIn: config?.accessTokenExpiresIn ?? 7200 },
        }
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
  exports: [JwtModule, AuthService],
})
export class AuthModule {}
