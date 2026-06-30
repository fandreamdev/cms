import { Module } from '@nestjs/common'
import {
  WinstonModule,
  utilities as nestWinstonModuleUtilities,
} from 'nest-winston'
import * as winston from 'winston'
import 'winston-daily-rotate-file'

const { combine, timestamp } = winston.format

// 控制台格式：带颜色的 nestLike
const consoleFormat = combine(
  timestamp({ format: 'YYYY/MM/DD HH:mm:ss' }),
  nestWinstonModuleUtilities.format.nestLike('Nest', {
    colors: true,
    prettyPrint: true,
  }),
)

// 文件格式：nestLike，不带颜色（避免写入 ANSI 转义码）
const fileFormat = combine(
  timestamp({ format: 'YYYY/MM/DD HH:mm:ss' }),
  nestWinstonModuleUtilities.format.nestLike('Nest', {
    colors: false,
    prettyPrint: true,
  }),
)

// JSON 文件格式
const jsonFormat = combine(
  timestamp({ format: 'YYYY/MM/DD HH:mm:ss' }),
  winston.format.json(),
)

@Module({
  imports: [
    WinstonModule.forRoot({
      transports: [
        new winston.transports.Console({
          format: consoleFormat,
        }),
        // 普通日志：按日期 + 大小切割，单文件 10M
        new winston.transports.DailyRotateFile({
          dirname: 'logs',
          filename: 'cms-%DATE%',
          extension: '.log',
          datePattern: 'YYYY-MM-DD',
          maxSize: '10m',
          maxFiles: '14d',
          zippedArchive: true,
          format: fileFormat,
        }),
        // JSON 格式日志：按日期 + 大小切割，单文件 10M
        new winston.transports.DailyRotateFile({
          dirname: 'logs',
          filename: 'cms-json-%DATE%',
          extension: '.log',
          datePattern: 'YYYY-MM-DD',
          maxSize: '10m',
          maxFiles: '14d',
          zippedArchive: true,
          format: jsonFormat,
        }),
        // 错误日志：单独存放，同样按日期 + 大小切割，单文件 10M
        new winston.transports.DailyRotateFile({
          dirname: 'logs/error',
          filename: 'cms-error-%DATE%',
          extension: '.log',
          datePattern: 'YYYY-MM-DD',
          maxSize: '10m',
          maxFiles: '14d',
          zippedArchive: true,
          level: 'error',
          format: fileFormat,
        }),
      ],
    }),
  ],
  exports: [WinstonModule],
})
export class LoggerModule {}
