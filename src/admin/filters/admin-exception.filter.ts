import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common'
import { Response } from 'express'
import { I18nValidationException } from 'nestjs-i18n'

@Catch(HttpException)
export class AdminExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const res: Response = ctx.getResponse()
    let errors = [exception.message]
    if (exception instanceof I18nValidationException) {
      errors = exception.errors.flatMap((err) =>
        Object.values(err.constraints ?? {}),
      )
    } else if (exception instanceof BadRequestException) {
      const resBody = exception.getResponse()
      if (typeof resBody === 'object' && 'message' in resBody) {
        errors = [...(resBody['message'] as string[])]
      }
    }
    res.status(exception.getStatus()).render('error', {
      message: exception.message,
      errors,
    })
  }
}
