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
import { RoleService } from '../../shared/services/role.service'
import { RoleCreateDto, RoleUpdateDto } from '../dto'
import { RoleQueryDto } from '../dto/role/role-query.dto'
import {
  ApiExceptionFilter,
  PaginatedData,
  TransformInterceptor,
} from '../common'
import { Role } from '../../shared/entities/role.entity'

@Controller('api/roles')
@UseInterceptors(TransformInterceptor)
@UseFilters(ApiExceptionFilter)
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get()
  async list(@Query() queryDto: RoleQueryDto): Promise<PaginatedData<Role>> {
    return this.roleService.findAll(queryDto)
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Role> {
    const role = await this.roleService.findOne({ where: { id } })
    if (!role) {
      throw new NotFoundException('Role not found')
    }
    return role
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
    if (!role) {
      throw new NotFoundException('Role not found')
    }
    return role
  }
}
