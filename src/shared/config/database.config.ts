import { ConfigType, registerAs } from '@nestjs/config'
import { envBoolean, envNumber, envString } from '../utils/env'
import Joi from 'joi'

export const DATABASE_KEY = 'database'
export const DATABASE_TYPE = 'DATABASE_TYPE'
export const DATABASE_HOST = 'DATABASE_HOST'
export const DATABASE_PORT = 'DATABASE_PORT'
export const DATABASE_USER = 'DATABASE_USER'
export const DATABASE_PASSWORD = 'DATABASE_PASSWORD'
export const DATABASE_DB = 'DATABASE_DB'
export const DATABASE_AUTO_LOAD_ENTITIES = 'DATABASE_AUTO_LOAD_ENTITIES'
export const DATABASE_SYNC = 'DATABASE_SYNC'
export const DATABASE_LOG = 'DATABASE_LOG'

export const databaseConfig = registerAs(DATABASE_KEY, () => ({
  type: envString(DATABASE_TYPE, 'mysql'),
  host: envString(DATABASE_HOST, 'localhost'),
  port: envNumber(DATABASE_PORT, 3306),
  username: envString(DATABASE_USER),
  password: envString(DATABASE_PASSWORD),
  database: envString(DATABASE_DB),
  autoLoadEntities: envBoolean(DATABASE_AUTO_LOAD_ENTITIES),
  synchronize: envBoolean(DATABASE_SYNC),
  logging: envBoolean(DATABASE_LOG),
}))

export type DatabaseConfigType = ConfigType<typeof databaseConfig>

export const databaseSchema = {
  [DATABASE_TYPE]: Joi.string().default('mysql'),
  [DATABASE_HOST]: Joi.string().default('localhost'),
  [DATABASE_PORT]: Joi.number().default(3306),
  [DATABASE_USER]: Joi.string().required(),
  [DATABASE_PASSWORD]: Joi.string().required(),
  [DATABASE_DB]: Joi.string().required(),
}
