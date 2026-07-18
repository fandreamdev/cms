import { IsIn, IsISO8601, IsOptional, IsString } from 'class-validator'
import { EmptyStringToUndefined } from '../../../shared/decorator/empty-string-to-undefined.decorator'
import { PaginationDto } from '../pagination.dto'

export class RoleQueryDto extends PaginationDto {
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
  @EmptyStringToUndefined()
  @IsString()
  name?: string
}
