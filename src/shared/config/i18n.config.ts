import { ConfigType, registerAs } from '@nestjs/config'
import { I18nViewEngine } from 'nestjs-i18n'
import { envBoolean, envString } from '../utils/env'

export const I18N_KEY = 'i18n'
export const I18N_FALLBACK_LANGUAGE = 'I18N_FALLBACK_LANGUAGE'
export const I18N_LOGGING = 'I18N_LOGGING'
export const I18N_VIEW_ENGINE = 'I18N_VIEW_ENGINE'

export const i18nConfig = registerAs(I18N_KEY, () => ({
  fallbackLanguage: envString(I18N_FALLBACK_LANGUAGE, 'zh'),
  logging: envBoolean(I18N_LOGGING),
  viewEngine: envString(I18N_VIEW_ENGINE, 'hbs') as I18nViewEngine,
}))

export type I18nConfigType = ConfigType<typeof i18nConfig>
