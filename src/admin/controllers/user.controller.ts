import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Redirect,
  Render,
  UseFilters,
} from '@nestjs/common'
import { UserService } from '../../shared/services/user.service'
import { UserCreateDto, UserUpdateDto } from '../../api/dto'
import { AdminExceptionFilter } from '../filters/admin-exception.filter'
import { hashPassword } from '../../shared/utils/pwd'
import { UserQueryDto } from '../../api/dto/user-query.dto'
import { buildPaginationView } from '../../shared/utils/pagination'

@Controller('admin/users')
@UseFilters(AdminExceptionFilter)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @Render('user/user-list')
  async findAll(@Query() userQueryDto: UserQueryDto) {
    const result = await this.userService.findAll(userQueryDto)
    return {
      users: result.list,
      // 分页信息（翻页链接保留当前过滤条件）
      pagination: buildPaginationView(result, { ...userQueryDto }),
      // 把查询条件回传给模板，用于回填搜索表单
      query: userQueryDto,
    }
  }

  @Get('create')
  @Render('user/user-form')
  createForm() {
    return { user: {} }
  }

  @Post()
  @Redirect('/admin/users')
  async create(@Body() createDto: UserCreateDto) {
    if (createDto.password) {
      createDto.password = await hashPassword(createDto.password)
    }
    return this.userService.create(createDto)
  }

  @Get(':id/detail')
  @Render('user/user-detail')
  async detail(@Param('id', ParseIntPipe) id: number) {
    const user = await this.userService.findOne({ where: { id } })
    if (!user) {
      throw new HttpException('User not Found', 404)
    }
    return { user }
  }

  @Get(':id/edit')
  @Render('user/user-form')
  async updateForm(@Param('id', ParseIntPipe) id: number) {
    const user = await this.userService.findOne({ where: { id } })
    if (!user) {
      throw new HttpException('User not Found', 404)
    }
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

  @Put(':id/status')
  async toggleStatus(@Param('id', ParseIntPipe) id: number) {
    const user = await this.userService.findOne({ where: { id } })
    if (!user) {
      throw new HttpException('User not Found', 404)
    }
    const status = user.status === 1 ? 0 : 1
    await this.userService.update(id, { status })
    return { success: true, status }
  }

  @Delete(':id')
  async delete(@Param('id', ParseIntPipe) id: number) {
    return this.userService.delete(id)
  }
}
