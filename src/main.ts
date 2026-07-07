import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import cookieParser from 'cookie-parser'
import { NextFunction, Request, Response } from 'express'
import session from 'express-session'
import methodOverride from 'method-override'
import { NestExpressApplication } from '@nestjs/platform-express'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { join } from 'path'
import { engine } from 'express-handlebars'
import { useContainer } from 'class-validator'
import { formatDate } from './shared/utils/hbs-helpers'
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston'
import {
  I18nService,
  I18nValidationExceptionFilter,
  I18nValidationPipe,
} from 'nestjs-i18n'
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  })

  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER))

  useContainer(app.select(AppModule), { fallbackOnErrors: true })

  app.useGlobalPipes(
    new I18nValidationPipe({ transform: true, whitelist: true }),
  )
  app.useGlobalFilters(
    new I18nValidationExceptionFilter({ detailedErrors: true }),
  )

  app.use(cookieParser())
  // 允许表单通过 _method 查询参数模拟 PUT/DELETE 请求
  app.use(
    methodOverride((req) => {
      const method = (req.query as Record<string, unknown>)?._method
      if (typeof method === 'string') {
        delete (req.query as Record<string, unknown>)._method
        return method
      }
      return req.method
    }),
  )
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
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.locals.currentPath = req.path
    next()
  })

  // 配置静态文件根目录
  app.useStaticAssets(join(process.cwd(), 'public'))

  // 配置模版文件的根目录
  app.setBaseViewsDir(join(process.cwd(), 'views'))
  // 把 nestjs-i18n 的 t helper 注册到 express-handlebars 引擎上
  // （nestjs-i18n 自带的 hbs 集成只作用于 hbs 包，这里手动接到实际使用的引擎）
  const i18nService = app.get<I18nService>(I18nService)
  app.engine(
    'hbs',
    engine({
      extname: '.hbs',
      helpers: {
        t: i18nService.hbsHelper,
        eq: (a: unknown, b: unknown) => a === b,
        isPermissionMenuOpen: (currentPath: unknown) =>
          typeof currentPath === 'string' &&
          ['/admin/users', '/admin/roles', '/admin/accesses'].some((path) =>
            currentPath.startsWith(path),
          ),
        formatDate,
      },
      runtimeOptions: {
        allowProtoMethodsByDefault: true,
        allowProtoPropertiesByDefault: true,
      },
    }),
  )
  app.setViewEngine('hbs')

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
