import { ConfigType, registerAs } from '@nestjs/config'
import Joi from 'joi'
import { envBoolean, envNumber, envString } from '../utils/env'

export const EMAIL_KEY = 'email'

export const emailConfig = registerAs(EMAIL_KEY, () => ({
  enabled: envBoolean('EMAIL_ENABLED'),
  host: envString('EMAIL_HOST', ''),
  port: envNumber('EMAIL_PORT', 465),
  secure: envString('EMAIL_SECURE', 'true').toUpperCase() === 'TRUE',
  user: envString('EMAIL_USER', ''),
  password: envString('EMAIL_PASSWORD', ''),
  from: envString('EMAIL_FROM', ''),
  reviewUrl: envString('EMAIL_ARTICLE_REVIEW_URL', ''),
  connectionTimeout: envNumber('EMAIL_CONNECTION_TIMEOUT_MS', 10000),
}))
export type EmailConfigType = ConfigType<typeof emailConfig>

export const emailSchema = {
  EMAIL_ENABLED: Joi.boolean().default(false),
  EMAIL_HOST: Joi.alternatives().conditional('EMAIL_ENABLED', {
    is: true,
    then: Joi.string().min(1).required(),
    otherwise: Joi.string().allow('').default(''),
  }),
  EMAIL_PORT: Joi.number().integer().min(1).max(65535).default(465),
  EMAIL_SECURE: Joi.boolean().default(true),
  EMAIL_USER: Joi.string().allow('').default(''),
  EMAIL_PASSWORD: Joi.string().allow('').default(''),
  EMAIL_FROM: Joi.alternatives().conditional('EMAIL_ENABLED', {
    is: true,
    then: Joi.string().min(1).required(),
    otherwise: Joi.string().allow('').default(''),
  }),
  EMAIL_ARTICLE_REVIEW_URL: Joi.string().uri().allow('').default(''),
  EMAIL_CONNECTION_TIMEOUT_MS: Joi.number().integer().positive().default(10000),
}
