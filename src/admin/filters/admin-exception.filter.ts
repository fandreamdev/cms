import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common'
import { Response } from 'express'

@Catch(HttpException)
export class AdminExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp()

    const res: Response = ctx.getResponse()
    console.log(exception.getResponse())
    res.status(exception.getStatus()).render('error', {
      message: exception.message,
      response: exception.getResponse(),
    })
  }
}
