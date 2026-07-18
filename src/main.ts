import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { NestExpressApplication } from '@nestjs/platform-express'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { useContainer } from 'class-validator'
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston'
import { I18nValidationExceptionFilter, I18nValidationPipe } from 'nestjs-i18n'
import { resolve } from 'path'
import { uploadConfig, UploadConfigType } from './shared/config'
import { DashboardSystemSocketService } from './shared/services/dashboard-system-socket.service'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    bodyParser: false,
  })

  app.useBodyParser('json', { limit: '5mb' })
  app.useBodyParser('urlencoded', { limit: '5mb', extended: true })

  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER))

  // 让 class-validator 的自定义校验器能注入 Nest 容器里的依赖
  useContainer(app.select(AppModule), { fallbackOnErrors: true })

  app.useGlobalPipes(
    new I18nValidationPipe({ transform: true, whitelist: true }),
  )
  app.useGlobalFilters(
    new I18nValidationExceptionFilter({ detailedErrors: true }),
  )

  const upload = app.get<UploadConfigType>(uploadConfig.KEY)
  app.useStaticAssets(
    resolve(process.cwd(), upload.localDirectory ?? 'uploads'),
    {
      prefix: '/uploads/',
    },
  )

  app.get(DashboardSystemSocketService).attach(app.getHttpServer())

  const swaggerConfig = new DocumentBuilder()
    .setTitle('CMS')
    .setDescription('Cms API description')
    .setVersion('1.0')
    .addTag('cms')
    .build()

  const documentFactory = () => SwaggerModule.createDocument(app, swaggerConfig)
  SwaggerModule.setup('docs', app, documentFactory)

  await app.listen(process.env.PORT ?? 3000)
}
bootstrap().catch((err) => {
  console.log(err)
})
