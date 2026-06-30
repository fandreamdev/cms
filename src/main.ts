import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import cookieParser from 'cookie-parser'
import session from 'express-session'
import { NestExpressApplication } from '@nestjs/platform-express'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { join } from 'path'
import { engine } from 'express-handlebars'
import { ValidationPipe } from '@nestjs/common'
import { useContainer } from 'class-validator'
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston'
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  })

  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER))

  useContainer(app.select(AppModule), { fallbackOnErrors: true })

  app.useGlobalPipes(new ValidationPipe({ transform: true }))
  // 配置静态文件根目录
  app.useStaticAssets(join(__dirname, '..', 'public'))

  // 配置模版文件的根目录
  app.setBaseViewsDir(join(__dirname, '..', 'views'))
  app.engine(
    'hbs',
    engine({
      extname: '.hbs',
      runtimeOptions: {
        allowProtoMethodsByDefault: true,
        allowProtoPropertiesByDefault: true,
      },
    }),
  )
  app.set('view engine', 'hbs')

  app.use(cookieParser())
  app.use(
    session({
      secret: 'secret-key',
      resave: true,
      saveUninitialized: true,
      cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7,
      },
    }),
  )

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
