import { IsOptional, IsString } from 'class-validator'
import { EmptyStringToUndefined } from '../../../shared/decorator/empty-string-to-undefined.decorator'
import { PaginationDto } from '../pagination.dto'

export class RoleQueryDto extends PaginationDto {
  @IsOptional()
  @EmptyStringToUndefined()
  @IsString()
  name?: string
}
