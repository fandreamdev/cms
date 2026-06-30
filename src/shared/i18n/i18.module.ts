import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AcceptLanguageResolver, I18nModule, QueryResolver } from 'nestjs-i18n'
import * as path from 'path'
import { AppConfigType } from '../config'
@Module({
  imports: [
    I18nModule.forRootAsync({
      useFactory: (configService: ConfigService<AppConfigType>) => {
        const i18nConfig = configService.getOrThrow('i18n', { infer: true })
        return {
          ...i18nConfig,
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
      inject: [ConfigService],
    }),
  ],
  exports: [I18nModule],
})
export class I18Module {}
