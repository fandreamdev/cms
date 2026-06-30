import { Module } from '@nestjs/common'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { AdminModule } from './admin/admin.module'
import { ApiModule } from './api/api.module'
import { SharedModule } from './shared/shared.module'
import { LoggerModule } from './shared/logger/logger.module'
import { I18Module } from './shared/i18n/i18.module'

@Module({
  imports: [LoggerModule, AdminModule, ApiModule, SharedModule, I18Module],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
