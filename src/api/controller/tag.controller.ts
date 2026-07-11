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

@Controller('api/tags')
@UseInterceptors(TransformInterceptor)
@UseFilters(ApiExceptionFilter)
export class TagController {
  constructor(private readonly tagService: TagService) {}

  @Get()
  async list(@Query() queryDto: TagQueryDto): Promise<PaginatedData<Tag>> {
    return this.tagService.findAll(queryDto)
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Tag> {
    const tag = await this.tagService.findOne({ where: { id } })
    if (!tag) {
      throw new NotFoundException('Tag not found')
    }
    return tag
  }

  @Post()
  async create(
    @Body(new I18nValidationPipe({ transform: true }))
    createDto: TagCreateDto,
  ): Promise<Tag> {
    return this.tagService.create(createDto)
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: TagUpdateDto,
  ): Promise<Tag> {
    await this.findOne(id)
    await this.tagService.update(id, updateDto)
    return this.findOne(id)
  }

  @Delete(':id')
  async delete(@Param('id', ParseIntPipe) id: number): Promise<null> {
    await this.findOne(id)
    await this.tagService.delete(id)
    return null
  }
}
