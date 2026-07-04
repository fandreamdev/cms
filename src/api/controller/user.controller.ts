import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common'
import { UserService } from '../../shared/services/user.service'
import { UserCreateDto, UserUpdateDto } from '../dto'
import { I18nValidationPipe } from 'nestjs-i18n'
import { UserQueryDto } from '../dto/user-query.dto'

@Controller('api/users')
export class UserController {
  constructor(private userService: UserService) {}

  @Get()
  async list(@Query() userQueryDto: UserQueryDto) {
    return this.userService.findAll(userQueryDto)
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.userService.findOne({ where: { id } })
  }

  @Post()
  async create(
    @Body(new I18nValidationPipe({ transform: true, groups: ['new'] }))
    createDto: UserCreateDto,
  ) {
    return this.userService.create(createDto)
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UserUpdateDto,
  ) {
    return this.userService.update(id, updateDto)
  }

  @Delete(':id')
  async delete(@Param('id', ParseIntPipe) id: number) {
    return this.userService.delete(id)
  }
}
