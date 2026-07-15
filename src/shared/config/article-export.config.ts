import { ConfigType, registerAs } from '@nestjs/config'
import Joi from 'joi'
import { envString } from '../utils/env'

export const ARTICLE_EXPORT_KEY = 'articleExport'

export const articleExportConfig = registerAs(ARTICLE_EXPORT_KEY, () => ({
  pdfFontPath: envString('ARTICLE_EXPORT_PDF_FONT_PATH', ''),
  pdfFontFamily: envString('ARTICLE_EXPORT_PDF_FONT_FAMILY', ''),
}))
export type ArticleExportConfigType = ConfigType<typeof articleExportConfig>

export const articleExportSchema = {
  ARTICLE_EXPORT_PDF_FONT_PATH: Joi.string().allow('').default(''),
  ARTICLE_EXPORT_PDF_FONT_FAMILY: Joi.string().allow('').default(''),
}
