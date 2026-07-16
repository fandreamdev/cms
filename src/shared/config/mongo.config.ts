import { ConfigType, registerAs } from '@nestjs/config'
import Joi from 'joi'
import { envNumber, envString } from '../utils/env'

export const MONGO_KEY = 'mongo'
export const DEFAULT_MONGODB_URI =
  'mongodb://cms:cms_local_password@localhost:27017/cms?authSource=admin'

export const mongoConfig = registerAs(MONGO_KEY, () => ({
  uri: envString('MONGODB_URI', DEFAULT_MONGODB_URI),
  serverSelectionTimeoutMs: envNumber(
    'MONGODB_SERVER_SELECTION_TIMEOUT_MS',
    5000,
  ),
}))

export type MongoConfigType = ConfigType<typeof mongoConfig>

export const mongoSchema = {
  MONGODB_URI: Joi.string()
    .uri({ scheme: ['mongodb', 'mongodb+srv'] })
    .default(DEFAULT_MONGODB_URI),
  MONGODB_SERVER_SELECTION_TIMEOUT_MS: Joi.number()
    .integer()
    .min(1000)
    .default(5000),
}
