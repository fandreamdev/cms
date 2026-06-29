import { applyDecorators } from '@nestjs/common'
import { Type } from 'class-transformer'
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNumber,
  IsPhoneNumber,
  IsString,
  Min,
  MinLength,
} from 'class-validator'
import { IsUserAlreadyExist } from '../../shared/validators/is-username-unique.validator'

export class UserCreateDto {
  @IsString()
  @IsUserAlreadyExist({ groups: ['new'] })
  username!: string

  @IsString()
  @MinLength(4)
  password!: string

  @IsPhoneNumber('CN')
  @IsString()
  mobile!: string

  @IsEmail()
  @IsString()
  email!: string

  @StatusValidators()
  status!: number

  @IsBoolean()
  @Type(() => Boolean)
  isSuper!: boolean

  @SortValidators()
  sort!: number
}

function StatusValidators() {
  return applyDecorators(
    IsNumber(),
    IsIn([0, 1]),
    Type(() => Number),
  )
}

function SortValidators() {
  return applyDecorators(
    IsNumber(),
    Min(0),
    Type(() => Number),
  )
}
