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
import { AccessService } from '../../shared/services/access.service'
import { AccessCreateDto, AccessUpdateDto } from '../dto'
import { AccessQueryDto } from '../dto/access/access-query.dto'
import {
  ApiExceptionFilter,
  PaginatedData,
  TransformInterceptor,
} from '../common'
import { Access } from '../../shared/entities/access.entity'

@Controller('api/accesses')
@UseInterceptors(TransformInterceptor)
@UseFilters(ApiExceptionFilter)
export class AccessController {
  constructor(private readonly accessService: AccessService) {}

  @Get()
  async list(
    @Query() queryDto: AccessQueryDto,
  ): Promise<PaginatedData<Access>> {
    return this.accessService.findAll(queryDto)
  }

  @Get('tree')
  async tree(): Promise<Access[]> {
    return this.accessService.findTree()
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Access> {
    const access = await this.accessService.findOneById(id)
    if (!access) {
      throw new NotFoundException('Access not found')
    }
    return access
  }

  @Post()
  async create(
    @Body(new I18nValidationPipe({ transform: true }))
    createDto: AccessCreateDto,
  ): Promise<Access> {
    return this.accessService.create(createDto)
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: AccessUpdateDto,
  ): Promise<Access> {
    await this.accessService.update(id, updateDto)
    return this.findOne(id)
  }

  @Delete(':id')
  async delete(@Param('id', ParseIntPipe) id: number): Promise<null> {
    await this.ensureExists(id)
    await this.accessService.delete(id)
    return null
  }

  private async ensureExists(id: number): Promise<Access> {
    const access = await this.accessService.findOneById(id)
    if (!access) {
      throw new NotFoundException('Access not found')
    }
    return access
  }
}
