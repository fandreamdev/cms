import { ConfigType, registerAs } from '@nestjs/config'
import Joi from 'joi'
import { envNumber, envString } from '../utils/env'

export const AUTH_KEY = 'auth'

export const authConfig = registerAs(AUTH_KEY, () => {
  const legacySecret = envString('JWT_SECRET') as string
  const accessTokenSecret = envString('JWT_ACCESS_SECRET', legacySecret)

  return {
    accessTokenSecret,
    accessTokenExpiresIn: envNumber(
      'JWT_ACCESS_EXPIRES_IN',
      envNumber('JWT_EXPIRES_IN', 7200),
    ),
    refreshTokenSecret: envString(
      'JWT_REFRESH_SECRET',
      `${accessTokenSecret}:refresh`,
    ),
    refreshTokenExpiresIn: envNumber('JWT_REFRESH_EXPIRES_IN', 604800),
  }
})

export type AuthConfigType = ConfigType<typeof authConfig>

export const authSchema = {
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.number().integer().positive().default(7200),
  JWT_ACCESS_SECRET: Joi.string().min(32).optional(),
  JWT_ACCESS_EXPIRES_IN: Joi.number().integer().positive().optional(),
  JWT_REFRESH_SECRET: Joi.string().min(32).optional(),
  JWT_REFRESH_EXPIRES_IN: Joi.number().integer().positive().default(604800),
}
