import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { FindOptionsOrder, TreeRepository } from 'typeorm'
import { Access } from '../entities/access.entity'
import { BaseService } from './base.service'
import { PaginatedResult } from './base.service'
import { AccessType } from '../enum/access.enum'

type AccessPayload = {
  type?: AccessType
  url?: string
  description?: string
  parentId?: number | null
}

@Injectable()
export class AccessService extends BaseService<Access> {
  protected readonly logger = new Logger(AccessService.name)
  protected fuzzyFields: (keyof Access)[] = ['url', 'description']
  protected defaultOrder: FindOptionsOrder<Access> = { id: 'ASC' }

  constructor(
    @InjectRepository(Access) protected repository: TreeRepository<Access>,
  ) {
    super(repository)
  }

  async findTree(): Promise<Access[]> {
    const tree = await this.repository.findTrees({
      relations: ['parent', 'children'],
    })
    return this.withoutParentRelation(tree)
  }

  async findOneById(id: number): Promise<Access | null> {
    const access = await this.repository.findOne({ where: { id } })
    if (!access) return null

    const [item] = await this.withParentIds([access])
    return item
  }

  async create(createDto: AccessPayload): Promise<Access> {
    const parent = await this.resolveParent(createDto.parentId)
    const entity = this.repository.create({
      type: createDto.type,
      url: createDto.url,
      description: createDto.description,
      parent,
    })
    const saved = await this.repository.save(entity)
    return (await this.findOneById(saved.id)) as Access
  }

  async update(
    id: number,
    updateDto: AccessPayload,
  ): Promise<{ success: boolean; message: string }> {
    const access = await this.repository.findOne({
      where: { id },
      relations: { parent: true },
    })
    if (!access) {
      throw new NotFoundException('Access not found')
    }

    if (updateDto.parentId !== undefined) {
      access.parent = await this.resolveParent(updateDto.parentId, id)
    }
    if (updateDto.type !== undefined) {
      access.type = updateDto.type
    }
    if (updateDto.url !== undefined) {
      access.url = updateDto.url
    }
    if (updateDto.description !== undefined) {
      access.description = updateDto.description
    }

    await this.repository.save(access)
    return {
      success: true,
      message: '更新资源成功',
    }
  }

  async findAll(
    query: { page?: number; pageSize?: number } = {},
  ): Promise<PaginatedResult<Access>> {
    const result = await super.findAll(query)
    return {
      ...result,
      list: await this.withParentIds(result.list),
    }
  }

  private async withParentIds(list: Access[]): Promise<Access[]> {
    if (list.length === 0) return list

    const rows = await this.repository
      .createQueryBuilder('access')
      .leftJoin('access.parent', 'parent')
      .select('access.id', 'id')
      .addSelect('parent.id', 'parentId')
      .where('access.id IN (:...ids)', { ids: list.map((item) => item.id) })
      .getRawMany<{ id: number; parentId: number | null }>()

    const parentIdMap = new Map(
      rows.map((row) => [
        Number(row.id),
        row.parentId ? Number(row.parentId) : null,
      ]),
    )

    return list.map((item) => ({
      ...item,
      parentId: parentIdMap.get(item.id) ?? null,
    }))
  }

  private withoutParentRelation(list: Access[]): Access[] {
    return list.map((item) => {
      const normalized = {
        ...item,
        children: this.withoutParentRelation(item.children ?? []),
      }
      normalized.parent = undefined as unknown as null
      return normalized
    })
  }

  private async resolveParent(
    parentId: number | null | undefined,
    currentId?: number,
  ): Promise<Access | null> {
    if (parentId === undefined || parentId === null) return null
    if (parentId === currentId) {
      throw new BadRequestException('Parent access cannot be itself')
    }

    const parent = await this.repository.findOne({ where: { id: parentId } })
    if (!parent) {
      throw new NotFoundException('Parent access not found')
    }

    if (currentId) {
      const current = await this.repository.findOne({
        where: { id: currentId },
      })
      if (current) {
        const descendants = await this.repository.findDescendants(current)
        if (descendants.some((item) => item.id === parentId)) {
          throw new BadRequestException('Parent access cannot be a descendant')
        }
      }
    }

    return parent
  }
}
