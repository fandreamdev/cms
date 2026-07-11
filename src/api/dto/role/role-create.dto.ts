import { Type, Transform } from 'class-transformer'
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator'

export class RoleCreateDto {
  @Transform(({ value }) => {
    const input: unknown = value
    return typeof input === 'string' ? input.trim() : input
  })
  @IsString()
  @IsNotEmpty()
  name!: string

  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  accessIds?: number[]
}
