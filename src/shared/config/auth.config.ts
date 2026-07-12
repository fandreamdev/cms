import { ConfigType, registerAs } from '@nestjs/config'
import Joi from 'joi'
import { envNumber, envString } from '../utils/env'

export const AUTH_KEY = 'auth'

export const authConfig = registerAs(AUTH_KEY, () => ({
  jwtSecret: envString('JWT_SECRET'),
  jwtExpiresIn: envNumber('JWT_EXPIRES_IN', 7200),
}))

export type AuthConfigType = ConfigType<typeof authConfig>

export const authSchema = {
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.number().integer().positive().default(7200),
}
