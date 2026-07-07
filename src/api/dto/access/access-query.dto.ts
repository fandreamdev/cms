import { IsEnum, IsOptional, IsString } from 'class-validator'
import { EmptyStringToUndefined } from '../../../shared/decorator/empty-string-to-undefined.decorator'
import { AccessType } from '../../../shared/enum/access.enum'
import { PaginationDto } from '../pagination.dto'

export class AccessQueryDto extends PaginationDto {
  @IsOptional()
  @EmptyStringToUndefined()
  @IsEnum(AccessType)
  type?: AccessType

  @IsOptional()
  @EmptyStringToUndefined()
  @IsString()
  url?: string

  @IsOptional()
  @EmptyStringToUndefined()
  @IsString()
  description?: string
}
