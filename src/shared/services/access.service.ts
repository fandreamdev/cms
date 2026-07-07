import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { TreeRepository } from 'typeorm'
import { Access } from '../entities/access.entity'
import { BaseService } from './base.service'

@Injectable()
export class AccessService extends BaseService<Access> {
  protected readonly logger = new Logger(AccessService.name)
  protected fuzzyFields: (keyof Access)[] = ['url', 'description']

  constructor(
    @InjectRepository(Access) protected repository: TreeRepository<Access>,
  ) {
    super(repository)
  }

  async findTree(): Promise<Access[]> {
    return this.repository.findTrees({ relations: ['parent', 'children'] })
  }
}
