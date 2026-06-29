import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  ValidationPipe,
} from '@nestjs/common'
import { UserService } from '../../shared/services/user.service'
import { UserCreateDto, UserUpdateDto } from '../dto'

@Controller('api/users')
export class UserController {
  constructor(private userService: UserService) {}

  @Get()
  async list() {
    return this.userService.findAll()
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.userService.findOne({ where: { id } })
  }

  @Post()
  async create(
    @Body(new ValidationPipe({ transform: true, groups: ['new'] }))
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
