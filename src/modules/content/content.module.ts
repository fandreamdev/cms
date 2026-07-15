import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ArticleController } from '../../api/controller/article.controller'
import { CategoryController } from '../../api/controller/category.controller'
import { TagController } from '../../api/controller/tag.controller'
import { Article } from '../../shared/entities/article.entity'
import { Category } from '../../shared/entities/category.entity'
import { Tag } from '../../shared/entities/tag.entity'
import { User } from '../../shared/entities/user.entity'
import { ArticleService } from '../../shared/services/article.service'
import { CategoryParentResolver } from '../../shared/services/category/category-parent.resolver'
import { CategoryService } from '../../shared/services/category.service'
import { TagService } from '../../shared/services/tag.service'
import { ArticleExportController } from '../../api/controller/article-export.controller'
import { ArticleExportService } from '../../shared/services/article-export.service'

@Module({
  imports: [TypeOrmModule.forFeature([Article, Category, Tag, User])],
  controllers: [
    ArticleExportController,
    ArticleController,
    CategoryController,
    TagController,
  ],
  providers: [
    ArticleService,
    ArticleExportService,
    CategoryService,
    CategoryParentResolver,
    TagService,
  ],
  exports: [ArticleService, CategoryService, TagService],
})
export class ContentModule {}
