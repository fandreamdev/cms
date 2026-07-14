import { Module } from '@nestjs/common'
import { AcceptLanguageResolver, I18nModule, QueryResolver } from 'nestjs-i18n'
import * as path from 'path'
import { i18nConfig, I18nConfigType } from '../config'
@Module({
  imports: [
    I18nModule.forRootAsync({
      useFactory: (config: I18nConfigType) => {
        return {
          ...config,
          loaderOptions: {
            path: path.join(__dirname, '../../i18n/'),
            watch: true,
          },
        }
      },
      resolvers: [
        { use: QueryResolver, options: ['lang', 'l'] },
        AcceptLanguageResolver,
      ],
      inject: [i18nConfig.KEY],
    }),
  ],
  exports: [I18nModule],
})
export class I18Module {}
