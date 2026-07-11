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
import { ArticleService } from '../../shared/services/article.service'
import { ArticleCreateDto, ArticleUpdateDto } from '../dto'
import { ArticleQueryDto } from '../dto/article/article-query.dto'
import {
  ApiExceptionFilter,
  PaginatedData,
  TransformInterceptor,
} from '../common'
import { Article } from '../../shared/entities/article.entity'

@Controller('api/articles')
@UseInterceptors(TransformInterceptor)
@UseFilters(ApiExceptionFilter)
export class ArticleController {
  constructor(private readonly articleService: ArticleService) {}

  @Get()
  async list(
    @Query() queryDto: ArticleQueryDto,
  ): Promise<PaginatedData<Article>> {
    return this.articleService.findAllWithCategory(queryDto)
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Article> {
    const article = await this.articleService.findOneWithCategory(id)
    if (!article) {
      throw new NotFoundException('Article not found')
    }
    return article
  }

  @Post()
  async create(
    @Body(new I18nValidationPipe({ transform: true }))
    createDto: ArticleCreateDto,
  ): Promise<Article> {
    return this.articleService.createWithCategory(createDto)
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: ArticleUpdateDto,
  ): Promise<Article> {
    return this.articleService.updateWithCategory(id, updateDto)
  }

  @Delete(':id')
  async delete(@Param('id', ParseIntPipe) id: number): Promise<null> {
    await this.findOne(id)
    await this.articleService.delete(id)
    return null
  }
}
