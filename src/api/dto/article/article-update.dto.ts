import { PartialType } from '@nestjs/mapped-types'
import { ArticleCreateDto } from './article-create.dto'

export class ArticleUpdateDto extends PartialType(ArticleCreateDto) {}
