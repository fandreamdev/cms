import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, In, Repository } from 'typeorm'
import { Role } from '../entities/role.entity'
import { BaseService } from './base.service'
import { Access } from '../entities/access.entity'

export type RoleCreatePayload = Pick<Role, 'name'> & {
  accessIds?: number[]
}

export type RoleUpdatePayload = Partial<
  Omit<Role, 'id' | 'users' | 'accesses'>
> & {
  accessIds?: number[]
}

@Injectable()
export class RoleService extends BaseService<Role> {
  protected readonly logger = new Logger(RoleService.name)
  protected fuzzyFields: (keyof Role)[] = ['name']

  constructor(
    @InjectRepository(Role) protected repository: Repository<Role>,
    private readonly dataSource: DataSource,
  ) {
    super(repository)
  }

  async findOneWithAccesses(id: number): Promise<Role | null> {
    return this.repository
      .createQueryBuilder('role')
      .leftJoinAndSelect('role.accesses', 'access')
      .where('role.id = :id', { id })
      .orderBy('access.id', 'ASC')
      .getOne()
  }

  async createWithAccesses(payload: RoleCreatePayload): Promise<Role> {
    const id = await this.dataSource.transaction(async (manager) => {
      const roleRepository = manager.getRepository(Role)
      const name = payload.name.trim()

      const existingRole = await roleRepository.findOne({ where: { name } })
      if (existingRole) {
        throw new ConflictException('角色名称已存在')
      }

      const uniqueAccessIds = [...new Set(payload.accessIds ?? [])]
      const accesses = uniqueAccessIds.length
        ? await manager
            .getRepository(Access)
            .findBy({ id: In(uniqueAccessIds) })
        : []
      if (accesses.length !== uniqueAccessIds.length) {
        throw new BadRequestException('部分资源不存在')
      }

      const role = roleRepository.create({ name, accesses })
      return (await roleRepository.save(role)).id
    })

    return (await this.findOneWithAccesses(id)) as Role
  }

  async updateWithAccesses(
    id: number,
    payload: RoleUpdatePayload,
  ): Promise<Role> {
    await this.dataSource.transaction(async (manager) => {
      const roleRepository = manager.getRepository(Role)
      const role = await roleRepository.findOne({ where: { id } })
      if (!role) throw new NotFoundException('Role not found')

      const { accessIds, ...roleFields } = payload
      let accesses: Access[] | undefined
      if (accessIds !== undefined) {
        const uniqueAccessIds = [...new Set(accessIds)]
        accesses = uniqueAccessIds.length
          ? await manager
              .getRepository(Access)
              .findBy({ id: In(uniqueAccessIds) })
          : []
        if (accesses.length !== uniqueAccessIds.length) {
          throw new BadRequestException('部分资源不存在')
        }
      }

      Object.assign(role, roleFields)
      if (accesses !== undefined) role.accesses = accesses
      await roleRepository.save(role)
    })

    return (await this.findOneWithAccesses(id)) as Role
  }
}
