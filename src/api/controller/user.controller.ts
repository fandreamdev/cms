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

@ApiResourceController('api/users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  async list(
    @Query() userQueryDto: UserQueryDto,
  ): Promise<PaginatedData<User>> {
    return this.userService.findAll(userQueryDto)
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<User> {
    return this.ensureExists(id)
  }

  @Post()
  async create(
    @Body(new I18nValidationPipe({ transform: true, groups: ['new'] }))
    createDto: UserCreateDto,
  ): Promise<User> {
    const payload = { ...createDto }
    if (payload.password) {
      payload.password = await hashPassword(payload.password)
    }
    return this.userService.create(payload)
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UserUpdateDto,
  ): Promise<User> {
    await this.ensureExists(id)
    const { password, ...rest } = updateDto
    const payload: Partial<User> = { ...rest }
    if (password) {
      payload.password = await hashPassword(password)
    }
    await this.userService.update(id, payload)
    return this.findOne(id)
  }

  @Put(':id/status')
  async toggleStatus(@Param('id', ParseIntPipe) id: number): Promise<User> {
    const user = await this.ensureExists(id)
    const status = user.status === 1 ? 0 : 1
    await this.userService.update(id, { status })
    return this.findOne(id)
  }

  @Delete(':id')
  async delete(@Param('id', ParseIntPipe) id: number): Promise<null> {
    await this.ensureExists(id)
    await this.userService.delete(id)
    return null
  }

  private async ensureExists(id: number): Promise<User> {
    const user = await this.userService.findOne({ where: { id } })
    return ensureFound(user, 'User not found')
  }
}
