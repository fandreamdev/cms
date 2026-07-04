import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { User } from '../entities/user.entity'
import { FindOptionsOrder, Repository } from 'typeorm'
import { BaseService } from './base.service'

@Injectable()
export class UserService extends BaseService<User> {
  protected readonly logger = new Logger(UserService.name)

  // 用户名/邮箱/手机号模糊匹配，其余字段精确匹配
  protected fuzzyFields: (keyof User)[] = ['username', 'email', 'mobile']
  protected defaultOrder: FindOptionsOrder<User> = { sort: 'ASC' }

  constructor(@InjectRepository(User) protected repository: Repository<User>) {
    super(repository)
    this.logger.log('userService is init')
  }
}
