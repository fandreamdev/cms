import { ArgumentsHost, Catch, HttpException, Logger } from '@nestjs/common'
import { Response } from 'express'
import { I18nValidationException } from 'nestjs-i18n'
import { I18nValidationExceptionFilter } from 'nestjs-i18n'
import { ApiResponse } from './api-response'

/**
 * API 统一异常过滤器：把所有异常收敛成 { code, message, data } 响应体。
 *
 * - 校验异常（I18nValidationException）复用父类的多语言翻译逻辑，
 *   再通过 responseBodyFormatter 把翻译后的错误信息塞进统一响应体；
 * - 其它 HttpException 取其状态码与信息；
 * - 未知异常统一按 500 处理，避免把内部细节泄露给前端。
 */
@Catch()
export class ApiExceptionFilter extends I18nValidationExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name)

  constructor() {
    super({
      detailedErrors: false,
      // 复用父类的翻译流程，仅重写最终响应体结构
      responseBodyFormatter: (_host, exc, formattedErrors) => {
        const messages = Array.isArray(formattedErrors)
          ? (formattedErrors as string[])
          : [exc.message]
        const body: ApiResponse = {
          code: exc.getStatus(),
          message: messages[0] ?? exc.message,
          data: null,
        }
        return body as unknown as Record<string, unknown>
      },
    })
  }

  catch(exception: unknown, host: ArgumentsHost): unknown {
    // 校验异常交给父类（会翻译并调用上面的 responseBodyFormatter）
    if (exception instanceof I18nValidationException) {
      return super.catch(exception, host)
    }

    const res = host.switchToHttp().getResponse<Response>()

    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      const body = exception.getResponse()
      const message =
        typeof body === 'string'
          ? body
          : this.extractMessage(body) || exception.message
      return res.status(status).json({
        code:
          (typeof body === 'string' ? undefined : this.extractCode(body)) ??
          status,
        message,
        data: null,
      } satisfies ApiResponse)
    }

    // 未预期的异常：记录日志并返回统一的 500，不暴露堆栈
    this.logger.error(
      exception instanceof Error ? exception.stack : String(exception),
    )
    return res.status(500).json({
      code: 500,
      message: 'Internal server error',
      data: null,
    } satisfies ApiResponse)
  }

  /** 从 HttpException 的响应体里取出可读信息（兼容 message 为数组的情况） */
  private extractMessage(body: object): string | undefined {
    const message = (body as { message?: unknown }).message
    if (Array.isArray(message)) return message[0] as string
    if (typeof message === 'string') return message
    return undefined
  }

  private extractCode(body: object): number | string | undefined {
    const code = (body as { code?: unknown }).code
    return typeof code === 'number' || typeof code === 'string'
      ? code
      : undefined
  }
}
