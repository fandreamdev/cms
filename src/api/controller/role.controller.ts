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
import { Role } from '../../shared/entities/role.entity'
import { RoleService } from '../../shared/services/role.service'
import { ApiResourceController, ensureFound, PaginatedData } from '../common'
import { RoleCreateDto, RoleUpdateDto } from '../dto'
import { RoleQueryDto } from '../dto/role/role-query.dto'

@ApiResourceController('api/roles')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get()
  async list(@Query() queryDto: RoleQueryDto): Promise<PaginatedData<Role>> {
    return this.roleService.findAll(queryDto)
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Role> {
    return this.ensureExists(id)
  }

  @Post()
  async create(
    @Body(new I18nValidationPipe({ transform: true }))
    createDto: RoleCreateDto,
  ): Promise<Role> {
    return this.roleService.create(createDto)
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: RoleUpdateDto,
  ): Promise<Role> {
    await this.ensureExists(id)
    await this.roleService.update(id, updateDto)
    return this.findOne(id)
  }

  @Delete(':id')
  async delete(@Param('id', ParseIntPipe) id: number): Promise<null> {
    await this.ensureExists(id)
    await this.roleService.delete(id)
    return null
  }

  private async ensureExists(id: number): Promise<Role> {
    const role = await this.roleService.findOne({ where: { id } })
    return ensureFound(role, 'Role not found')
  }
}
