import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Redirect,
  Render,
  UseFilters,
} from '@nestjs/common'
import { UserService } from '../../shared/services/user.service'
import { UserCreateDto, UserUpdateDto } from '../../api/dto'
import { AdminExceptionFilter } from '../filters/admin-exception.filter'

@Controller('admin/users')
@UseFilters(AdminExceptionFilter)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @Render('user/user-list')
  async findAll() {
    const users = await this.userService.findAll()
    return { users }
  }

  @Get('create')
  @Render('user/user-form')
  createForm() {
    return { user: {} }
  }

  @Post()
  @Redirect('/admin/users')
  async create(@Body() createDto: UserCreateDto) {
    return this.userService.create(createDto)
  }

  @Get('update/:id')
  @Render('user/user-form')
  async updateForm(@Param('id', ParseIntPipe) id: number) {
    const user = await this.userService.findOne({ where: { id } })
    return { user }
  }

  @Put(':id')
  @Redirect('/admin/users')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UserUpdateDto,
  ) {
    return this.userService.update(id, updateDto)
  }

  @Get('update/delete/:id')
  @Redirect('/admin/users')
  async delete(@Param('id', ParseIntPipe) id: number) {
    return this.userService.delete(id)
  }
}
