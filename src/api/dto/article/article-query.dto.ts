import { Type } from 'class-transformer'
import {
  IsDate,
  IsIn,
  IsISO8601,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator'
import { EmptyStringToUndefined } from '../../../shared/decorator/empty-string-to-undefined.decorator'
import { PaginationDto } from '../pagination.dto'
import { ArticleApprovalStatus } from '../../../shared/enum/article-approval-status.enum'
import { IsEnum } from 'class-validator'

export class ArticleQueryDto extends PaginationDto {
  @IsOptional()
  @IsIn(['updatedAt'])
  orderBy?: 'updatedAt'

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc'

  @IsOptional()
  @IsISO8601()
  createdFrom?: string

  @IsOptional()
  @IsISO8601()
  createdTo?: string

  @IsOptional()
  @IsEnum(ArticleApprovalStatus)
  approvalStatus?: ArticleApprovalStatus

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoryId?: number

  @IsOptional()
  @EmptyStringToUndefined()
  @IsString()
  title?: string

  @IsOptional()
  @EmptyStringToUndefined()
  @IsString()
  summary?: string | null

  @IsOptional()
  @EmptyStringToUndefined()
  @IsString()
  content?: string

  @IsOptional()
  @EmptyStringToUndefined()
  @IsString()
  coverUrl?: string | null

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  status?: number

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  publishedAt?: Date | null

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sort?: number
}
