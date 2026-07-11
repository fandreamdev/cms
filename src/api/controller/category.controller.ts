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
import { CategoryService } from '../../shared/services/category.service'
import { CategoryCreateDto, CategoryUpdateDto } from '../dto'
import { CategoryQueryDto } from '../dto/category/category-query.dto'
import {
  ApiExceptionFilter,
  PaginatedData,
  TransformInterceptor,
} from '../common'
import { Category } from '../../shared/entities/category.entity'

@Controller('api/categories')
@UseInterceptors(TransformInterceptor)
@UseFilters(ApiExceptionFilter)
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  async list(
    @Query() queryDto: CategoryQueryDto,
  ): Promise<PaginatedData<Category>> {
    return this.categoryService.findAll(queryDto)
  }

  @Get('tree')
  async tree(): Promise<Category[]> {
    return this.categoryService.findTree()
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Category> {
    const category = await this.categoryService.findOne({ where: { id } })
    if (!category) {
      throw new NotFoundException('Category not found')
    }
    return category
  }

  @Post()
  async create(
    @Body(new I18nValidationPipe({ transform: true }))
    createDto: CategoryCreateDto,
  ): Promise<Category> {
    return this.categoryService.create(createDto)
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: CategoryUpdateDto,
  ): Promise<Category> {
    await this.findOne(id)
    await this.categoryService.update(id, updateDto)
    return this.findOne(id)
  }

  @Delete(':id')
  async delete(@Param('id', ParseIntPipe) id: number): Promise<null> {
    await this.findOne(id)
    await this.categoryService.delete(id)
    return null
  }
}
