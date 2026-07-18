import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common'
import {
  And,
  DeepPartial,
  FindOneOptions,
  FindOptionsOrder,
  FindOptionsWhere,
  Like,
  LessThan,
  MoreThanOrEqual,
  ObjectLiteral,
  QueryDeepPartialEntity,
  Repository,
} from 'typeorm'

/** 分页查询结果 */
export interface PaginatedResult<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export abstract class BaseService<T extends ObjectLiteral> {
  constructor(protected repository: Repository<T>) {}

  /** 需要模糊匹配（LIKE）的字段，子类按需声明；未列出的字段走精确匹配 */
  protected fuzzyFields: (keyof T)[] = []

  /** 列表默认排序，子类按需声明 */
  protected defaultOrder?: FindOptionsOrder<T>

  /** 构建 where 时需要忽略的字段（分页等非过滤参数） */
  private static readonly NON_FILTER_KEYS = [
    'page',
    'pageSize',
    'orderBy',
    'order',
    'createdFrom',
    'createdTo',
  ]

  /** 把查询 DTO 构建成 TypeORM 的 where 条件 */
  protected buildWhere(query: object): FindOptionsWhere<T> {
    const where: FindOptionsWhere<T> = {}
    for (const [key, value] of Object.entries(query)) {
      // 跳过分页等非过滤字段
      if (BaseService.NON_FILTER_KEYS.includes(key)) continue
      // 跳过空条件
      if (value === undefined || value === null || value === '') continue
      const field = key as keyof T
      if (this.fuzzyFields.includes(field) && typeof value === 'string') {
        where[field] = Like(`%${value}%`) as never
      } else {
        where[field] = value as never
      }
    }
    return this.applyCreatedAtRange(where, query)
  }

  async findAll(
    query: {
      page?: number
      pageSize?: number
      orderBy?: 'updatedAt'
      order?: 'asc' | 'desc'
      createdFrom?: string
      createdTo?: string
    } = {},
  ): Promise<PaginatedResult<T>> {
    const page = query.page && query.page > 0 ? query.page : 1
    const pageSize = query.pageSize && query.pageSize > 0 ? query.pageSize : 10

    const [list, total] = await this.repository.findAndCount({
      where: this.buildWhere(query),
      order: this.resolveOrder(query),
      skip: (page - 1) * pageSize,
      take: pageSize,
    })

    return {
      list,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    }
  }

  private resolveOrder(query: {
    orderBy?: 'updatedAt'
    order?: 'asc' | 'desc'
  }): FindOptionsOrder<T> | undefined {
    if (query.orderBy === 'updatedAt') {
      const direction = query.order === 'asc' ? 'ASC' : 'DESC'
      return { updatedAt: direction } as unknown as FindOptionsOrder<T>
    }
    return this.defaultOrder
  }

  protected applyCreatedAtRange(
    where: FindOptionsWhere<T>,
    query: { createdFrom?: string; createdTo?: string },
  ): FindOptionsWhere<T> {
    const { createdFrom, createdTo } = query
    if (!createdFrom && !createdTo) return where

    const from = createdFrom ? new Date(createdFrom) : undefined
    const to = createdTo ? new Date(createdTo) : undefined
    if (
      (from && Number.isNaN(from.getTime())) ||
      (to && Number.isNaN(to.getTime())) ||
      (from && to && from >= to)
    ) {
      throw new BadRequestException('createdFrom 必须早于 createdTo')
    }

    const condition =
      from && to
        ? And(MoreThanOrEqual(from), LessThan(to))
        : from
          ? MoreThanOrEqual(from)
          : LessThan(to as Date)
    ;(where as Record<string, unknown>).createdAt = condition
    return where
  }

  async findOne(options: FindOneOptions<T>) {
    return this.repository.findOne(options)
  }

  async create(createDto: DeepPartial<T>) {
    const entity = this.repository.create(createDto)
    return this.repository.save(entity)
  }

  async update(id: number, updateDto: QueryDeepPartialEntity<T>) {
    const result = await this.repository.update(id, updateDto)
    if (result.affected && result.affected === 1) {
      return {
        success: true,
        message: '更新用户成功',
      }
    }
    throw new HttpException('用户不存在！', HttpStatus.NOT_FOUND)
  }

  async delete(id: number) {
    const result = await this.repository.delete(id)
    if (result.affected && result.affected === 1) {
      return {
        success: true,
        message: '删除用户成功',
      }
    }
    throw new HttpException('用户不存在！', HttpStatus.NOT_FOUND)
  }
}
