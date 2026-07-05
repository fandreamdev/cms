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
import { I18nValidationPipe } from 'nestjs-i18n'
import { RoleService } from '../../shared/services/role.service'
import { RoleCreateDto, RoleUpdateDto } from '../dto'
import { RoleQueryDto } from '../dto/role/role-query.dto'

@Controller('api/roles')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get()
  async list(@Query() queryDto: RoleQueryDto) {
    return this.roleService.findAll(queryDto)
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.roleService.findOne({ where: { id } })
  }

  @Post()
  async create(
    @Body(new I18nValidationPipe({ transform: true }))
    createDto: RoleCreateDto,
  ) {
    return this.roleService.create(createDto)
  }

  @Put(':id')
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
