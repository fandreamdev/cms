import {
  Body,
  Controller,
  Get,
  Post,
  Redirect,
  Render,
  UseFilters,
} from '@nestjs/common'
import { UserService } from '../../shared/services/user.service'
import { UserCreateDto } from '../../api/dto'
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
}
