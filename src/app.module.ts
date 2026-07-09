import { Module } from '@nestjs/common'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { ApiModule } from './api/api.module'
import { SharedModule } from './shared/shared.module'
import { LoggerModule } from './shared/logger/logger.module'
import { I18Module } from './shared/i18n/i18.module'

@Module({
  imports: [LoggerModule, ApiModule, SharedModule, I18Module],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
