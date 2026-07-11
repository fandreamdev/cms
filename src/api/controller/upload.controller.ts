import {
  BadRequestException,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiResourceController } from '../common'
import { UploadService } from '../../shared/services/upload.service'

@ApiResourceController('api/uploads')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('images')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadImage(
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<{ url: string }> {
    if (!file) throw new BadRequestException('请选择需要上传的图片')
    return this.uploadService.saveImage(file)
  }
}
