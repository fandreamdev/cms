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
import { CurrentUser } from '../../auth/current-user.decorator'
import { RequirePermissions } from '../../auth/permissions.decorator'
import type { AuthUser } from '../../auth/auth-user'
import { ArticleRejectDto } from '../dto/article/article-reject.dto'
import { ArticleStatusDto } from '../dto/article/article-status.dto'

@Controller('api/articles')
@UseInterceptors(TransformInterceptor)
@UseFilters(ApiExceptionFilter)
export class ArticleController {
  constructor(private readonly articleService: ArticleService) {}

  @Get()
  @RequirePermissions('article:view')
  async list(
    @Query() queryDto: ArticleQueryDto,
  ): Promise<PaginatedData<Article>> {
    return this.articleService.findAllWithCategory(queryDto)
  }

  @Get(':id')
  @RequirePermissions('article:view')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Article> {
    const article = await this.articleService.findOneWithCategory(id)
    if (!article) {
      throw new NotFoundException('Article not found')
    }
    return article
  }

  @Post()
  @RequirePermissions('article:create')
  async create(
    @Body(new I18nValidationPipe({ transform: true }))
    createDto: ArticleCreateDto,
    @CurrentUser() user: AuthUser,
  ): Promise<Article> {
    return this.articleService.createWithCategory(createDto, user)
  }

  @Put(':id')
  @RequirePermissions('article:edit')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: ArticleUpdateDto,
    @CurrentUser() user: AuthUser,
  ): Promise<Article> {
    return this.articleService.updateWithCategory(id, updateDto, user.id)
  }

  @Post(':id/submit')
  @RequirePermissions('article:submit')
  submit(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ): Promise<Article> {
    return this.articleService.submit(id, user.id)
  }

  @Post(':id/approve')
  @RequirePermissions('article:approve')
  approve(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ): Promise<Article> {
    return this.articleService.approve(id, user)
  }

  @Post(':id/reject')
  @RequirePermissions('article:approve')
  reject(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ArticleRejectDto,
    @CurrentUser() user: AuthUser,
  ): Promise<Article> {
    return this.articleService.reject(id, dto.reason, user)
  }

  @Post(':id/withdraw')
  @RequirePermissions('article:withdraw')
  withdraw(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ): Promise<Article> {
    return this.articleService.withdraw(id, user.id)
  }

  @Put(':id/status')
  @RequirePermissions('article:status')
  setStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ArticleStatusDto,
  ): Promise<Article> {
    return this.articleService.setStatus(id, dto.status)
  }

  @Delete(':id')
  @RequirePermissions('article:delete')
  async delete(@Param('id', ParseIntPipe) id: number): Promise<null> {
    await this.findOne(id)
    await this.articleService.delete(id)
    return null
  }
}
