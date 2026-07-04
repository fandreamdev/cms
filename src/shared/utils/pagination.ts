import { PaginatedResult } from '../services/base.service'

/** 传给模板渲染分页条的数据结构 */
export interface PaginationView {
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasPrev: boolean
  hasNext: boolean
  prevPage: number
  nextPage: number
  /** 要渲染的页码按钮 */
  items: { page: number; active: boolean }[]
  /** 过滤条件的查询串（不含 page），形如 `username=a&status=1`；无条件时为空串 */
  queryString: string
}

/**
 * 把服务层的分页结果转换成模板可直接使用的视图数据。
 * @param result 分页查询结果
 * @param filters 原始查询条件（用于生成翻页链接时保留过滤参数）
 * @param window 当前页左右各展示多少个页码，默认 2
 */
export function buildPaginationView<T>(
  result: PaginatedResult<T>,
  filters: Record<string, unknown> = {},
  window = 2,
): PaginationView {
  const { page, pageSize, total, totalPages } = result

  const start = Math.max(1, page - window)
  const end = Math.min(totalPages, page + window)
  const items: { page: number; active: boolean }[] = []
  for (let p = start; p <= end; p++) {
    items.push({ page: p, active: p === page })
  }

  // 保留过滤条件（排除分页字段与空值），拼成查询串
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (key === 'page' || key === 'pageSize') continue
    if (value === undefined || value === null || value === '') continue
    // 查询参数经 whitelist 后仅为原始类型，只对可安全字符串化的值拼接
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      params.append(key, String(value))
    }
  }

  return {
    page,
    pageSize,
    total,
    totalPages,
    hasPrev: page > 1,
    hasNext: page < totalPages,
    prevPage: page - 1,
    nextPage: page + 1,
    items,
    queryString: params.toString(),
  }
}
