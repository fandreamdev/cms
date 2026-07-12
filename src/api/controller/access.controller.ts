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
import { Access } from '../../shared/entities/access.entity'
import { AccessService } from '../../shared/services/access.service'
import { ApiResourceController, ensureFound, PaginatedData } from '../common'
import { AccessCreateDto, AccessUpdateDto } from '../dto'
import { AccessQueryDto } from '../dto/access/access-query.dto'
import { RequirePermissions } from '../../auth/permissions.decorator'

@ApiResourceController('api/accesses')
export class AccessController {
  constructor(private readonly accessService: AccessService) {}

  @Get()
  @RequirePermissions('access:view')
  async list(
    @Query() queryDto: AccessQueryDto,
  ): Promise<PaginatedData<Access>> {
    return this.accessService.findAll(queryDto)
  }

  @Get('tree')
  @RequirePermissions('access:view')
  async tree(): Promise<Access[]> {
    return this.accessService.findTree()
  }

  @Get(':id')
  @RequirePermissions('access:view')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Access> {
    return this.ensureExists(id)
  }

  @Post()
  @RequirePermissions('access:create')
  async create(
    @Body(new I18nValidationPipe({ transform: true }))
    createDto: AccessCreateDto,
  ): Promise<Access> {
    return this.accessService.create(createDto)
  }

  @Put(':id')
  @RequirePermissions('access:edit')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: AccessUpdateDto,
  ): Promise<Access> {
    await this.accessService.update(id, updateDto)
    return this.findOne(id)
  }

  @Delete(':id')
  @RequirePermissions('access:delete')
  async delete(@Param('id', ParseIntPipe) id: number): Promise<null> {
    await this.ensureExists(id)
    await this.accessService.delete(id)
    return null
  }

  private async ensureExists(id: number): Promise<Access> {
    const access = await this.accessService.findOneById(id)
    return ensureFound(access, 'Access not found')
  }
}
