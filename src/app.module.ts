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

@Module({
  imports: [
    InfrastructureModule,
    LoggerModule,
    SystemModule,
    AuthModule,
    ContentModule,
    UploadModule,
    I18Module,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
