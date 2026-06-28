import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import cookieParser from 'cookie-parser'
import session from 'express-session'
import { NestExpressApplication } from '@nestjs/platform-express'
import { join } from 'path'
import { engine } from 'express-handlebars'
import { ValidationPipe } from '@nestjs/common'
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule)

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

  await app.listen(process.env.PORT ?? 3000)
}
bootstrap()
