import { Module } from '@nestjs/common'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { LoggerModule } from './shared/logger/logger.module'
import { I18Module } from './shared/i18n/i18.module'
import { AuthModule } from './auth/auth.module'
import { InfrastructureModule } from './infrastructure/infrastructure.module'
import { ContentModule } from './modules/content/content.module'
import { SystemModule } from './modules/system/system.module'
import { UploadModule } from './modules/upload/upload.module'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { NotificationModule } from './modules/notification/notification.module'
import { SettingsModule } from './modules/settings/settings.module'

@Module({
  imports: [
    InfrastructureModule,
    LoggerModule,
    SystemModule,
    AuthModule,
    ContentModule,
    UploadModule,
    I18Module,
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      global: true,
    }),
    NotificationModule,
    SettingsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
