import { Module } from '@nestjs/common'
import { UploadController } from '../../api/controller/upload.controller'
import { UploadService } from '../../shared/services/upload.service'

@Module({
  controllers: [UploadController],
  providers: [UploadService],
  exports: [UploadService],
})
export class UploadModule {}
