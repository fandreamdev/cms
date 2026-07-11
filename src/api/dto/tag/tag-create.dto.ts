import { Type } from 'class-transformer'
import { IsNumber, IsOptional, IsString } from 'class-validator'
import { EmptyStringToUndefined } from '../../../shared/decorator/empty-string-to-undefined.decorator'

export class TagCreateDto {
  @IsString()
  name!: string

  @IsOptional()
  @EmptyStringToUndefined()
  @IsString()
  description?: string | null

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sort?: number
}
