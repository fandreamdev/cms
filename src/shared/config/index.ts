import Joi from 'joi'
import {
  DATABASE_KEY,
  databaseConfig,
  DatabaseConfigType,
  databaseSchema,
} from './database.config'
import { I18N_KEY, i18nConfig, I18nConfigType } from './i18n.config'

export * from './database.config'
export * from './i18n.config'

export type AppConfigType = {
  [DATABASE_KEY]: DatabaseConfigType
  [I18N_KEY]: I18nConfigType
}

export const appConfigSchema = Joi.object({
  ...databaseSchema,
})

export default [databaseConfig, i18nConfig]
