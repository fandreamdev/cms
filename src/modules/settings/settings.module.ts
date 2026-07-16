import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { WebsiteSettingController } from '../../api/controller/website-setting.controller'
import {
  WebsiteSetting,
  WebsiteSettingSchema,
} from '../../shared/schemas/website-setting.schema'
import { WebsiteSettingService } from '../../shared/services/website-setting.service'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WebsiteSetting.name, schema: WebsiteSettingSchema },
    ]),
  ],
  controllers: [WebsiteSettingController],
  providers: [WebsiteSettingService],
  exports: [WebsiteSettingService],
})
export class SettingsModule {}
