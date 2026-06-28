import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNumber,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Min,
} from 'class-validator'

export class UserUpdateDto {
  @IsString()
  @IsOptional()
  username!: string

  @IsString()
  @IsOptional()
  password!: string

  @IsPhoneNumber('CN')
  @IsString()
  @IsOptional()
  mobile!: string

  @IsEmail()
  @IsString()
  @IsOptional()
  email!: string

  @IsNumber()
  @IsIn([0, 1])
  @IsOptional()
  status!: number

  @IsBoolean()
  @IsOptional()
  isSuper!: boolean

  @IsNumber()
  @Min(0)
  @IsOptional()
  sort!: number
}
