import Joi from 'joi'
import {
  DATABASE_KEY,
  databaseConfig,
  DatabaseConfigType,
  databaseSchema,
} from './database.config'
import { I18N_KEY, i18nConfig, I18nConfigType } from './i18n.config'
import {
  UPLOAD_KEY,
  uploadConfig,
  UploadConfigType,
  uploadSchema,
} from './upload.config'
import { AUTH_KEY, authConfig, AuthConfigType, authSchema } from './auth.config'

export * from './database.config'
export * from './i18n.config'
export * from './upload.config'
export * from './auth.config'

export type AppConfigType = {
  [DATABASE_KEY]: DatabaseConfigType
  [I18N_KEY]: I18nConfigType
  [UPLOAD_KEY]: UploadConfigType
  [AUTH_KEY]: AuthConfigType
}

export const appConfigSchema = Joi.object({
  ...databaseSchema,
  ...uploadSchema,
  ...authSchema,
})

export default [databaseConfig, i18nConfig, uploadConfig, authConfig]
