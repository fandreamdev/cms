import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNumber,
  IsPhoneNumber,
  IsString,
  Min,
} from 'class-validator'

export class UserCreateDto {
  @IsString()
  username!: string

  @IsString()
  password!: string

  @IsPhoneNumber('CN')
  @IsString()
  mobile!: string

  @IsEmail()
  @IsString()
  email!: string

  @IsNumber()
  @IsIn([0, 1])
  status!: number

  @IsBoolean()
  isSuper!: boolean

  @IsNumber()
  @Min(0)
  sort!: number
}
