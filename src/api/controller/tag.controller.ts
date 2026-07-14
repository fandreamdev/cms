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
import { TagService } from '../../shared/services/tag.service'
import { TagCreateDto, TagUpdateDto } from '../dto'
import { TagQueryDto } from '../dto/tag/tag-query.dto'
import {
  ApiExceptionFilter,
  PaginatedData,
  TransformInterceptor,
} from '../common'
import { Tag } from '../../shared/entities/tag.entity'
import { RequirePermissions } from '../../auth/permissions.decorator'

@Controller('api/tags')
@UseInterceptors(TransformInterceptor)
@UseFilters(ApiExceptionFilter)
export class TagController {
  constructor(private readonly tagService: TagService) {}

  @Get()
  @RequirePermissions('tag:list')
  async list(@Query() queryDto: TagQueryDto): Promise<PaginatedData<Tag>> {
    return this.tagService.findAll(queryDto)
  }

  @Get(':id')
  @RequirePermissions('tag:view')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Tag> {
    const tag = await this.tagService.findOne({ where: { id } })
    if (!tag) {
      throw new NotFoundException('标签不存在')
    }
    return tag
  }

  @Post()
  @RequirePermissions('tag:create')
  async create(
    @Body(new I18nValidationPipe({ transform: true }))
    createDto: TagCreateDto,
  ): Promise<Tag> {
    return this.tagService.create(createDto)
  }

  @Put(':id')
  @RequirePermissions('tag:edit')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: TagUpdateDto,
  ): Promise<Tag> {
    await this.findOne(id)
    await this.tagService.update(id, updateDto)
    return this.findOne(id)
  }

  @Delete(':id')
  @RequirePermissions('tag:delete')
  async delete(@Param('id', ParseIntPipe) id: number): Promise<null> {
    await this.findOne(id)
    await this.tagService.delete(id)
    return null
  }
}
