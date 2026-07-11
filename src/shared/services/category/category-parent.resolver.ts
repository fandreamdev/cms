import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { TreeRepository } from 'typeorm'
import { Category } from '../../entities/category.entity'

@Injectable()
export class CategoryParentResolver {
  constructor(
    @InjectRepository(Category)
    private readonly repository: TreeRepository<Category>,
  ) {}

  async resolve(
    parentId: number | null | undefined,
    currentId?: number,
  ): Promise<Category | null> {
    if (parentId === undefined || parentId === null) return null
    if (parentId === currentId)
      throw new BadRequestException('Parent category cannot be itself')
    const parent = await this.repository.findOne({
      where: { id: parentId },
    })
    if (!parent) throw new NotFoundException('Parent category not found')
    if (currentId) {
      const current = await this.repository.findOne({
        where: { id: currentId },
      })
      if (current) {
        const descendants = await this.repository.findDescendants(current)
        if (descendants.some((item) => item.id === parentId)) {
          throw new BadRequestException(
            'Parent category cannot be a descendant',
          )
        }
      }
    }
    return parent
  }
}
