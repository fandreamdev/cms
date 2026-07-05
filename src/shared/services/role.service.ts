import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Role } from '../entities/role.entity'
import { BaseService } from './base.service'

@Injectable()
export class RoleService extends BaseService<Role> {
  protected readonly logger = new Logger(RoleService.name)
  protected fuzzyFields: (keyof Role)[] = ['name']

  constructor(@InjectRepository(Role) protected repository: Repository<Role>) {
    super(repository)
  }
}
