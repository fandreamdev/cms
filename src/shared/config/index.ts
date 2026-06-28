import Joi from 'joi'
import {
  DATABASE_KEY,
  databaseConfig,
  DatabaseConfigType,
  databaseSchema,
} from './database.config'

export * from './database.config'

export type AppConfigType = {
  [DATABASE_KEY]: DatabaseConfigType
}

export const appConfigSchema = Joi.object({
  ...databaseSchema,
})

export default [databaseConfig]
