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
import {
  EMAIL_KEY,
  emailConfig,
  EmailConfigType,
  emailSchema,
} from './email.config'
import {
  ARTICLE_EXPORT_KEY,
  articleExportConfig,
  ArticleExportConfigType,
  articleExportSchema,
} from './article-export.config'
import {
  MONGO_KEY,
  mongoConfig,
  MongoConfigType,
  mongoSchema,
} from './mongo.config'
import {
  WEATHER_KEY,
  weatherConfig,
  WeatherConfigType,
  weatherSchema,
} from './weather.config'
import {
  SYSTEM_MONITOR_KEY,
  systemMonitorConfig,
  SystemMonitorConfigType,
  systemMonitorSchema,
} from './system-monitor.config'

export * from './database.config'
export * from './i18n.config'
export * from './upload.config'
export * from './auth.config'
export * from './email.config'
export * from './article-export.config'
export * from './mongo.config'
export * from './weather.config'
export * from './system-monitor.config'

export type AppConfigType = {
  [DATABASE_KEY]: DatabaseConfigType
  [I18N_KEY]: I18nConfigType
  [UPLOAD_KEY]: UploadConfigType
  [AUTH_KEY]: AuthConfigType
  [EMAIL_KEY]: EmailConfigType
  [ARTICLE_EXPORT_KEY]: ArticleExportConfigType
  [MONGO_KEY]: MongoConfigType
  [WEATHER_KEY]: WeatherConfigType
  [SYSTEM_MONITOR_KEY]: SystemMonitorConfigType
}

export const appConfigSchema = Joi.object({
  ...databaseSchema,
  ...uploadSchema,
  ...authSchema,
  ...emailSchema,
  ...articleExportSchema,
  ...mongoSchema,
  ...weatherSchema,
  ...systemMonitorSchema,
})

export default [
  databaseConfig,
  i18nConfig,
  uploadConfig,
  authConfig,
  emailConfig,
  articleExportConfig,
  mongoConfig,
  weatherConfig,
  systemMonitorConfig,
]
