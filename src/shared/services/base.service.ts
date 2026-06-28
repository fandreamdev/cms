import { HttpException, HttpStatus } from '@nestjs/common'
import {
  DeepPartial,
  FindOneOptions,
  ObjectLiteral,
  QueryDeepPartialEntity,
  Repository,
} from 'typeorm'

export abstract class BaseService<T extends ObjectLiteral> {
  constructor(protected repository: Repository<T>) {}

  async findAll() {
    return this.repository.find()
  }

  async findOne(options: FindOneOptions<T>) {
    return this.repository.findOne(options)
  }

  async create(createDto: DeepPartial<T>) {
    const entity = this.repository.create(createDto)
    return this.repository.save(entity)
  }

  async update(id: number, updateDto: QueryDeepPartialEntity<T>) {
    const result = await this.repository.update(id, updateDto)
    if (result.affected && result.affected === 1) {
      return {
        success: true,
        message: '更新用户成功',
      }
    }
    throw new HttpException('用户不存在！', HttpStatus.NOT_FOUND)
  }

  async delete(id: number) {
    const result = await this.repository.delete(id)
    if (result.affected && result.affected === 1) {
      return {
        success: true,
        message: '删除用户成功',
      }
    }
    throw new HttpException('用户不存在！', HttpStatus.NOT_FOUND)
  }
}
