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
      throw new BadRequestException('父资源不能是自身')
    }

    const parent = await this.repository.findOne({ where: { id: parentId } })
    if (!parent) {
      throw new NotFoundException('父资源不存在')
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
      throw new BadRequestException('父资源不能是当前资源的子资源')
    }
  }
}
