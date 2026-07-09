import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common'
import { I18nValidationPipe } from 'nestjs-i18n'
import { UserService } from '../../shared/services/user.service'
import { UserCreateDto, UserUpdateDto } from '../dto'
import { UserQueryDto } from '../dto/user/user-query.dto'
import { hashPassword } from '../../shared/utils/pwd'
import {
  ApiExceptionFilter,
  PaginatedData,
  TransformInterceptor,
} from '../common'
import { User } from '../../shared/entities/user.entity'

@Controller('api/users')
@UseInterceptors(TransformInterceptor)
@UseFilters(ApiExceptionFilter)
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
    const user = await this.userService.findOne({ where: { id } })
    if (!user) {
      throw new NotFoundException('用户不存在')
    }
    return user
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
    // 仅当传入了新密码时才重新哈希，避免把明文或空值写库
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

  /** 确认用户存在，不存在则抛 404 */
  private async ensureExists(id: number): Promise<User> {
    const user = await this.userService.findOne({ where: { id } })
    if (!user) {
      throw new NotFoundException('用户不存在')
    }
    return user
  }
}
