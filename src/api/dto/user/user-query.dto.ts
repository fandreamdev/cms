import { Transform } from 'class-transformer'
import {
  IsBoolean,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
} from 'class-validator'
import { EmptyStringToUndefined } from '../../../shared/decorator/empty-string-to-undefined.decorator'
import { PaginationDto } from '../pagination.dto'

export class UserQueryDto extends PaginationDto {
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
  @IsString()
  @EmptyStringToUndefined()
  username?: string

  @IsOptional()
  @IsString()
  @EmptyStringToUndefined()
  mobile?: string

  @IsOptional()
  @IsString()
  @EmptyStringToUndefined()
  email?: string

  // 查询参数始终是字符串，保持字符串即可（模板回填按字符串比较，DB 精确匹配时 MySQL 会自动转 int）
  @IsOptional()
  @IsIn(['0', '1'])
  @EmptyStringToUndefined()
  status?: string

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true' || value === '1') return true
    if (value === 'false' || value === '0') return false
    return undefined
  })
  isSuper?: boolean
}
