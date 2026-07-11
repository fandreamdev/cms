import { ConfigType, registerAs } from '@nestjs/config'
import Joi from 'joi'
import { envNumber, envString } from '../utils/env'

export const UPLOAD_KEY = 'upload'

export const uploadConfig = registerAs(UPLOAD_KEY, () => ({
  storage: envString('UPLOAD_STORAGE', 'local') as 'local' | 'oss',
  localDirectory: envString('UPLOAD_LOCAL_DIRECTORY', 'uploads'),
  publicBaseUrl: envString('UPLOAD_PUBLIC_BASE_URL', ''),
  imageMaxWidth: envNumber('UPLOAD_IMAGE_MAX_WIDTH', 1920),
  imageQuality: envNumber('UPLOAD_IMAGE_QUALITY', 82),
  ossRegion: envString('OSS_REGION'),
  ossBucket: envString('OSS_BUCKET'),
  ossAccessKeyId: envString('OSS_ACCESS_KEY_ID'),
  ossAccessKeySecret: envString('OSS_ACCESS_KEY_SECRET'),
  ossEndpoint: envString('OSS_ENDPOINT'),
  ossCdnUrl: envString('OSS_CDN_URL', ''),
}))

export type UploadConfigType = ConfigType<typeof uploadConfig>

export const uploadSchema = {
  UPLOAD_STORAGE: Joi.string().valid('local', 'oss').default('local'),
  UPLOAD_LOCAL_DIRECTORY: Joi.string().default('uploads'),
  UPLOAD_PUBLIC_BASE_URL: Joi.string().allow('').default(''),
  UPLOAD_IMAGE_MAX_WIDTH: Joi.number().integer().min(320).default(1920),
  UPLOAD_IMAGE_QUALITY: Joi.number().integer().min(1).max(100).default(82),
  OSS_REGION: Joi.string().optional(),
  OSS_BUCKET: Joi.string().optional(),
  OSS_ACCESS_KEY_ID: Joi.string().optional(),
  OSS_ACCESS_KEY_SECRET: Joi.string().optional(),
  OSS_ENDPOINT: Joi.string().optional(),
  OSS_CDN_URL: Joi.string().allow('').default(''),
}
