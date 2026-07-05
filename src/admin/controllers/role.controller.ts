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
import { RoleCreateDto, RoleUpdateDto } from '../../api/dto'
import { RoleQueryDto } from '../../api/dto/role/role-query.dto'
import { RoleService } from '../../shared/services/role.service'
import { buildPaginationView } from '../../shared/utils/pagination'
import { AdminExceptionFilter } from '../filters/admin-exception.filter'

@Controller('admin/roles')
@UseFilters(AdminExceptionFilter)
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get()
  @Render('role/role-list')
  async findAll(@Query() queryDto: RoleQueryDto) {
    const result = await this.roleService.findAll(queryDto)
    return {
      roles: result.list,
      pagination: buildPaginationView(result, { ...queryDto }),
      query: queryDto,
    }
  }

  @Get('create')
  @Render('role/role-form')
  createForm() {
    return { role: {} }
  }

  @Post()
  @Redirect('/admin/roles')
  async create(@Body() createDto: RoleCreateDto) {
    return this.roleService.create(createDto)
  }

  @Get(':id/detail')
  @Render('role/role-detail')
  async detail(@Param('id', ParseIntPipe) id: number) {
    const role = await this.roleService.findOne({ where: { id } })
    if (!role) {
      throw new HttpException('Role not Found', 404)
    }
    return { role }
  }

  @Get(':id/edit')
  @Render('role/role-form')
  async updateForm(@Param('id', ParseIntPipe) id: number) {
    const role = await this.roleService.findOne({ where: { id } })
    if (!role) {
      throw new HttpException('Role not Found', 404)
    }
    return { role }
  }

  @Put(':id')
  @Redirect('/admin/roles')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: RoleUpdateDto,
  ) {
    return this.roleService.update(id, updateDto)
  }

  @Delete(':id')
  async delete(@Param('id', ParseIntPipe) id: number) {
    return this.roleService.delete(id)
  }
}
