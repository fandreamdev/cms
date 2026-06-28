import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { User } from '../entities/user.entity'
import { Repository } from 'typeorm'
import { BaseService } from './base.service'

@Injectable()
export class UserService extends BaseService<User> {
  constructor(@InjectRepository(User) protected repository: Repository<User>) {
    super(repository)
  }
}
