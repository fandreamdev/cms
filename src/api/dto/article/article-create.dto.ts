import { Type } from 'class-transformer'
import {
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator'
import { EmptyStringToUndefined } from '../../../shared/decorator/empty-string-to-undefined.decorator'

export class ArticleCreateDto {
  @IsString()
  title!: string

  @IsOptional()
  @EmptyStringToUndefined()
  @IsString()
  summary?: string | null

  @IsString()
  content!: string

  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoryId!: number

  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  tagIds?: number[]

  @IsOptional()
  @EmptyStringToUndefined()
  @IsString()
  coverUrl?: string | null

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([0, 1])
  status?: number

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sort?: number
}
