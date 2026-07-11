import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { User } from '../entities/user.entity'
import { DataSource, FindOptionsOrder, In, Repository } from 'typeorm'
import { BaseService } from './base.service'
import { Role } from '../entities/role.entity'

export type UserCreatePayload = Omit<
  User,
  'id' | 'roles' | 'createdAt' | 'updatedAt'
> & {
  roleIds?: number[]
}

export type UserUpdatePayload = Partial<Omit<User, 'id' | 'roles'>> & {
  roleIds?: number[]
}

@Injectable()
export class UserService extends BaseService<User> {
  protected readonly logger = new Logger(UserService.name)

  // 用户名/邮箱/手机号模糊匹配，其余字段精确匹配
  protected fuzzyFields: (keyof User)[] = ['username', 'email', 'mobile']
  protected defaultOrder: FindOptionsOrder<User> = { sort: 'ASC' }

  constructor(
    @InjectRepository(User) protected repository: Repository<User>,
    private readonly dataSource: DataSource,
  ) {
    super(repository)
    this.logger.log('userService is init')
  }

  async findOneWithRoles(id: number): Promise<User | null> {
    return this.repository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.roles', 'role')
      .where('user.id = :id', { id })
      .orderBy('role.id', 'ASC')
      .getOne()
  }

  async createWithRoles(payload: UserCreatePayload): Promise<User> {
    const id = await this.dataSource.transaction(async (manager) => {
      const { roleIds, ...userFields } = payload
      const uniqueRoleIds = [...new Set(roleIds ?? [])]
      const roles = uniqueRoleIds.length
        ? await manager.getRepository(Role).findBy({ id: In(uniqueRoleIds) })
        : []
      if (roles.length !== uniqueRoleIds.length) {
        throw new BadRequestException('部分角色不存在')
      }

      const userRepository = manager.getRepository(User)
      const user = userRepository.create({ ...userFields, roles })
      return (await userRepository.save(user)).id
    })

    return (await this.findOneWithRoles(id)) as User
  }

  async updateWithRoles(id: number, payload: UserUpdatePayload): Promise<User> {
    await this.dataSource.transaction(async (manager) => {
      const userRepository = manager.getRepository(User)
      const user = await userRepository.findOne({ where: { id } })
      if (!user) throw new NotFoundException('User not found')

      const { roleIds, ...userFields } = payload
      let roles: Role[] | undefined
      if (roleIds !== undefined) {
        const uniqueRoleIds = [...new Set(roleIds)]
        roles = uniqueRoleIds.length
          ? await manager.getRepository(Role).findBy({ id: In(uniqueRoleIds) })
          : []
        if (roles.length !== uniqueRoleIds.length) {
          throw new BadRequestException('部分角色不存在')
        }
      }

      Object.assign(user, userFields)
      if (roles !== undefined) user.roles = roles
      await userRepository.save(user)
    })

    return (await this.findOneWithRoles(id)) as User
  }
}
