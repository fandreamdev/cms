import {
  applyDecorators,
  Controller,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common'
import { ApiExceptionFilter } from './api-exception.filter'
import { TransformInterceptor } from './transform.interceptor'

export function ApiResourceController(path: string): ClassDecorator {
  return applyDecorators(
    Controller(path),
    UseInterceptors(TransformInterceptor),
    UseFilters(ApiExceptionFilter),
  )
}
