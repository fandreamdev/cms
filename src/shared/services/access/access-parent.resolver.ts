import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { TreeRepository } from 'typeorm'
import { Access } from '../../entities/access.entity'

@Injectable()
export class AccessParentResolver {
  constructor(
    @InjectRepository(Access)
    private readonly repository: TreeRepository<Access>,
  ) {}

  async resolve(
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
      await this.ensureParentIsNotDescendant(currentId, parentId)
    }

    return parent
  }

  private async ensureParentIsNotDescendant(
    currentId: number,
    parentId: number,
  ): Promise<void> {
    const current = await this.repository.findOne({ where: { id: currentId } })
    if (!current) return

    const descendants = await this.repository.findDescendants(current)
    if (descendants.some((item) => item.id === parentId)) {
      throw new BadRequestException('Parent access cannot be a descendant')
    }
  }
}
