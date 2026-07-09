import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common'
import { instanceToPlain } from 'class-transformer'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'
import {
  API_SUCCESS_CODE,
  API_SUCCESS_MESSAGE,
  ApiResponse,
} from './api-response'

/**
 * 把控制器返回值统一包裹成 { code, message, data }。
 * 同时用 instanceToPlain 递归处理实体，触发 @Exclude 等序列化规则
 * （例如剔除 User.password），因此返回原始实体也不会泄露敏感字段。
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => ({
        code: API_SUCCESS_CODE,
        message: API_SUCCESS_MESSAGE,
        data: (instanceToPlain(data) as T) ?? null,
      })),
    )
  }
}
