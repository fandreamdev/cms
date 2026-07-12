import {
  Body,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common'
import { I18nValidationPipe } from 'nestjs-i18n'
import { User } from '../../shared/entities/user.entity'
import { UserService } from '../../shared/services/user.service'
import { hashPassword } from '../../shared/utils/pwd'
import { ApiResourceController, ensureFound, PaginatedData } from '../common'
import { UserCreateDto, UserUpdateDto } from '../dto'
import { UserQueryDto } from '../dto/user/user-query.dto'
import { RequirePermissions } from '../../auth/permissions.decorator'

@ApiResourceController('api/users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @RequirePermissions('user:list')
  async list(
    @Query() userQueryDto: UserQueryDto,
  ): Promise<PaginatedData<User>> {
    return this.userService.findAll(userQueryDto)
  }

  @Get(':id')
  @RequirePermissions('user:view')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<User> {
    return this.ensureExistsWithRoles(id)
  }

  @Post()
  @RequirePermissions('user:create')
  async create(
    @Body(new I18nValidationPipe({ transform: true, groups: ['new'] }))
    createDto: UserCreateDto,
  ): Promise<User> {
    const payload = {
      ...createDto,
      password: await hashPassword(createDto.password),
    }
    return this.userService.createWithRoles(payload)
  }

  @Put(':id')
  @RequirePermissions('user:edit')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UserUpdateDto,
  ): Promise<User> {
    await this.ensureExists(id)
    const payload = { ...updateDto }
    if (payload.password) {
      payload.password = await hashPassword(payload.password)
    }
    return this.userService.updateWithRoles(id, payload)
  }

  @Put(':id/status')
  @RequirePermissions('user:edit')
  async toggleStatus(@Param('id', ParseIntPipe) id: number): Promise<User> {
    const user = await this.ensureExists(id)
    const status = user.status === 1 ? 0 : 1
    await this.userService.update(id, { status })
    return this.findOne(id)
  }

  @Delete(':id')
  @RequirePermissions('user:delete')
  async delete(@Param('id', ParseIntPipe) id: number): Promise<null> {
    await this.ensureExists(id)
    await this.userService.delete(id)
    return null
  }

  private async ensureExists(id: number): Promise<User> {
    const user = await this.userService.findOne({ where: { id } })
    return ensureFound(user, 'User not found')
  }

  private async ensureExistsWithRoles(id: number): Promise<User> {
    const user = await this.userService.findOneWithRoles(id)
    return ensureFound(user, 'User not found')
  }
}
