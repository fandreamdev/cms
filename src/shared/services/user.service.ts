import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { User } from '../entities/user.entity'
import { Repository } from 'typeorm'
import { BaseService } from './base.service'

@Injectable()
export class UserService extends BaseService<User> {
  protected readonly logger = new Logger(UserService.name)
  constructor(@InjectRepository(User) protected repository: Repository<User>) {
    super(repository)
    this.logger.log('userService is init')
  }
}
