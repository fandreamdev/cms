import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { FindOptionsOrder, Repository } from 'typeorm'
import { Tag } from '../entities/tag.entity'
import { BaseService } from './base.service'

@Injectable()
export class TagService extends BaseService<Tag> {
  protected readonly logger = new Logger(TagService.name)
  protected fuzzyFields: (keyof Tag)[] = ['name']
  protected defaultOrder: FindOptionsOrder<Tag> = { sort: 'ASC' }

  constructor(@InjectRepository(Tag) protected repository: Repository<Tag>) {
    super(repository)
  }
}
