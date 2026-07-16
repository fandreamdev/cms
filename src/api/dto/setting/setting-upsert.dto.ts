import {
  IsBoolean,
  IsDefined,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator'

/** Value can be any JSON value supported by MongoDB (object, array, string, number or boolean). */
export class SettingUpsertDto {
  @IsDefined()
  value!: unknown

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null
}
