/** 统一 API 响应体：业务码 0 表示成功，非 0 表示失败 */
export interface ApiResponse<T = unknown> {
  /** 业务状态码，0 表示成功；失败时通常与 HTTP 状态码一致 */
  code: number | string
  /** 提示信息，成功为 'success'，失败为错误描述 */
  message: string
  /** 业务数据，失败时为 null */
  data: T | null
}

/** 分页数据的标准结构，作为 ApiResponse.data 返回 */
export interface PaginatedData<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export const API_SUCCESS_CODE = 0
export const API_SUCCESS_MESSAGE = 'success'
