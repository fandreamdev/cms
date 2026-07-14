import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DeepPartial, TreeRepository } from 'typeorm'
import { CategoryCreateDto, CategoryUpdateDto } from '../../api/dto'
import { Category } from '../entities/category.entity'
import { BaseService } from './base.service'
import { CategoryParentResolver } from './category/category-parent.resolver'
import { stripParentRelations } from './category/category-tree-response'

@Injectable()
export class CategoryService extends BaseService<Category> {
  protected readonly logger = new Logger(CategoryService.name)

  constructor(
    @InjectRepository(Category) protected repository: TreeRepository<Category>,
    private readonly parentResolver: CategoryParentResolver,
  ) {
    super(repository)
  }

  async findTree(): Promise<Category[]> {
    const tree = await this.repository.findTrees({
      relations: ['parent', 'children'],
    })
    return stripParentRelations(tree)
  }

  async create(createDto: CategoryCreateDto): Promise<Category> {
    const { parentId, ...values } = createDto
    const parent = await this.parentResolver.resolve(parentId)
    return this.repository.save(
      this.repository.create({ ...values, parent } as DeepPartial<Category>),
    )
  }

  async update(id: number, updateDto: CategoryUpdateDto) {
    const entity = await this.repository.findOne({
      where: { id },
      relations: { parent: true },
    })
    if (!entity) throw new NotFoundException('分类不存在')
    const { parentId, ...values } = updateDto
    if (parentId !== undefined)
      entity.parent = await this.parentResolver.resolve(parentId, id)
    Object.assign(entity, values)
    await this.repository.save(entity)
    return { success: true, message: 'Updated successfully' }
  }
}
