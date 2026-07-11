import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import OSS from 'ali-oss'
import { randomUUID } from 'crypto'
import { mkdir, writeFile } from 'fs/promises'
import { extname, join, posix, resolve } from 'path'
import { AppConfigType, UploadConfigType } from '../config'

const IMAGE_TYPES = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
} as const

@Injectable()
export class UploadService {
  private readonly config: UploadConfigType

  constructor(configService: ConfigService<AppConfigType>) {
    this.config = configService.get<UploadConfigType>(
      'upload',
    ) as UploadConfigType
  }

  async saveImage(file: Express.Multer.File): Promise<{ url: string }> {
    const extension = this.validateImage(file)
    const now = new Date()
    const key = posix.join(
      'images',
      String(now.getFullYear()),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
      `${randomUUID()}${extension}`,
    )

    return this.config.storage === 'oss'
      ? this.saveToOss(key, file.buffer)
      : this.saveToLocal(key, file.buffer)
  }

  private validateImage(file: Express.Multer.File): string {
    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('图片大小不能超过 5MB')
    }
    const expectedExtension =
      IMAGE_TYPES[file.mimetype as keyof typeof IMAGE_TYPES]
    const originalExtension = extname(file.originalname).toLowerCase()
    if (
      !expectedExtension ||
      !this.extensionMatches(file.mimetype, originalExtension) ||
      !this.signatureMatches(file.mimetype, file.buffer)
    ) {
      throw new BadRequestException('只支持 JPG、PNG、GIF 和 WebP 图片')
    }
    return expectedExtension
  }

  private extensionMatches(mime: string, extension: string): boolean {
    return mime === 'image/jpeg'
      ? extension === '.jpg' || extension === '.jpeg'
      : IMAGE_TYPES[mime as keyof typeof IMAGE_TYPES] === extension
  }

  private signatureMatches(mime: string, buffer: Buffer): boolean {
    if (mime === 'image/jpeg')
      return buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
    if (mime === 'image/png')
      return buffer
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    if (mime === 'image/gif')
      return ['GIF87a', 'GIF89a'].includes(
        buffer.subarray(0, 6).toString('ascii'),
      )
    if (mime === 'image/webp')
      return (
        buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
        buffer.subarray(8, 12).toString('ascii') === 'WEBP'
      )
    return false
  }

  private async saveToLocal(
    key: string,
    buffer: Buffer,
  ): Promise<{ url: string }> {
    try {
      const root = resolve(process.cwd(), this.config.localDirectory)
      const target = join(root, ...key.split('/'))
      await mkdir(resolve(target, '..'), { recursive: true })
      await writeFile(target, buffer, { flag: 'wx' })
      const relativeUrl = `/uploads/${key}`
      return {
        url: this.config.publicBaseUrl
          ? `${this.config.publicBaseUrl.replace(/\/$/, '')}${relativeUrl}`
          : relativeUrl,
      }
    } catch {
      throw new InternalServerErrorException('图片保存失败')
    }
  }

  private async saveToOss(
    key: string,
    buffer: Buffer,
  ): Promise<{ url: string }> {
    const { ossRegion, ossBucket, ossAccessKeyId, ossAccessKeySecret } =
      this.config
    if (!ossRegion || !ossBucket || !ossAccessKeyId || !ossAccessKeySecret) {
      throw new InternalServerErrorException('OSS 存储配置不完整')
    }
    try {
      const client = new OSS({
        region: ossRegion,
        bucket: ossBucket,
        accessKeyId: ossAccessKeyId,
        accessKeySecret: ossAccessKeySecret,
        ...(this.config.ossEndpoint
          ? { endpoint: this.config.ossEndpoint }
          : {}),
      })
      const result = await client.put(`uploads/${key}`, buffer)
      const url = this.config.ossCdnUrl
        ? `${this.config.ossCdnUrl.replace(/\/$/, '')}/uploads/${key}`
        : result.url
      return { url }
    } catch {
      throw new InternalServerErrorException('图片保存失败')
    }
  }
}
