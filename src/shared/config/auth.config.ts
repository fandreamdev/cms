import { ConfigType, registerAs } from '@nestjs/config'
import Joi from 'joi'
import { envNumber, envString } from '../utils/env'

export const AUTH_KEY = 'auth'

export const authConfig = registerAs(AUTH_KEY, () => {
  const legacySecret = envString('JWT_SECRET') as string
  const accessTokenSecret = envString('JWT_ACCESS_SECRET', legacySecret)
  const refreshTokenSecret = envString(
    'JWT_REFRESH_SECRET',
    `${accessTokenSecret}:refresh`,
  )

  return {
    accessTokenSecret,
    accessTokenExpiresIn: envNumber(
      'JWT_ACCESS_EXPIRES_IN',
      envNumber('JWT_EXPIRES_IN', 7200),
    ),
    refreshTokenSecret,
    refreshTokenExpiresIn: envNumber('JWT_REFRESH_EXPIRES_IN', 604800),
    captchaHmacSecret: envString(
      'CAPTCHA_HMAC_SECRET',
      `${accessTokenSecret}:captcha`,
    ),
    refreshSessionHmacSecret: envString(
      'REFRESH_SESSION_HMAC_SECRET',
      `${refreshTokenSecret}:session`,
    ),
    captchaTtlSeconds: envNumber('CAPTCHA_TTL_SECONDS', 300),
    captchaRedisUrl: envString('CAPTCHA_REDIS_URL', 'redis://localhost:6379/0'),
    captchaRateLimitPerMinute: envNumber('CAPTCHA_RATE_LIMIT_PER_MINUTE', 20),
    loginIpRateLimitPerMinute: envNumber('LOGIN_IP_RATE_LIMIT_PER_MINUTE', 10),
    loginUsernameRateLimitPerFiveMinutes: envNumber(
      'LOGIN_USERNAME_RATE_LIMIT_PER_FIVE_MINUTES',
      5,
    ),
    refreshIpRateLimitPerMinute: envNumber(
      'REFRESH_IP_RATE_LIMIT_PER_MINUTE',
      30,
    ),
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
  CAPTCHA_HMAC_SECRET: Joi.string().min(32).optional(),
  REFRESH_SESSION_HMAC_SECRET: Joi.string().min(32).optional(),
  CAPTCHA_TTL_SECONDS: Joi.number().integer().min(60).max(900).default(300),
  CAPTCHA_REDIS_URL: Joi.string()
    .uri({ scheme: ['redis', 'rediss'] })
    .optional(),
  CAPTCHA_RATE_LIMIT_PER_MINUTE: Joi.number().integer().positive().default(20),
  LOGIN_IP_RATE_LIMIT_PER_MINUTE: Joi.number().integer().positive().default(10),
  LOGIN_USERNAME_RATE_LIMIT_PER_FIVE_MINUTES: Joi.number()
    .integer()
    .positive()
    .default(5),
  REFRESH_IP_RATE_LIMIT_PER_MINUTE: Joi.number()
    .integer()
    .positive()
    .default(30),
}
