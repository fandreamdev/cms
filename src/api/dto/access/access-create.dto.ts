import { Type } from 'class-transformer'
import { IsEnum, IsOptional, IsString } from 'class-validator'
import { IsInt, Min } from 'class-validator'
import { EmptyStringToUndefined } from '../../../shared/decorator/empty-string-to-undefined.decorator'
import { AccessType } from '../../../shared/enum/access.enum'

export class AccessCreateDto {
  @IsEnum(AccessType)
  type!: AccessType

  @IsOptional()
  @EmptyStringToUndefined()
  @IsString()
  url?: string

  @IsOptional()
  @EmptyStringToUndefined()
  @IsString()
  description?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  parentId?: number | null
}
