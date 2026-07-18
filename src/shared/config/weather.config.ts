import { ConfigType, registerAs } from '@nestjs/config'
import Joi from 'joi'
import { envNumber, envString } from '../utils/env'

export const WEATHER_KEY = 'weather'

export const weatherConfig = registerAs(WEATHER_KEY, () => ({
  provider: envString('WEATHER_PROVIDER', 'open-meteo') as 'open-meteo',
  apiKey: envString('WEATHER_API_KEY', ''),
  defaultLatitude: envNumber('WEATHER_DEFAULT_LATITUDE', 31.2304),
  defaultLongitude: envNumber('WEATHER_DEFAULT_LONGITUDE', 121.4737),
  defaultName: envString('WEATHER_DEFAULT_NAME', '上海'),
  cacheTtlSeconds: envNumber('WEATHER_CACHE_TTL_SECONDS', 900),
  timeoutMs: envNumber('WEATHER_TIMEOUT_MS', 5000),
}))

export type WeatherConfigType = ConfigType<typeof weatherConfig>

export const weatherSchema = {
  WEATHER_PROVIDER: Joi.string().valid('open-meteo').default('open-meteo'),
  WEATHER_API_KEY: Joi.string().allow('').default(''),
  WEATHER_DEFAULT_LATITUDE: Joi.number().min(-90).max(90).default(31.2304),
  WEATHER_DEFAULT_LONGITUDE: Joi.number().min(-180).max(180).default(121.4737),
  WEATHER_DEFAULT_NAME: Joi.string().trim().min(1).default('上海'),
  WEATHER_CACHE_TTL_SECONDS: Joi.number()
    .integer()
    .min(600)
    .max(1800)
    .default(900),
  WEATHER_TIMEOUT_MS: Joi.number().integer().min(3000).max(5000).default(5000),
}
