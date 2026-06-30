import { applyDecorators } from '@nestjs/common'
import { Transform, Type } from 'class-transformer'
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNumber,
  IsOptional,
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
  @IsOptional()
  @EmptyStringToUndefined()
  mobile!: string

  @IsEmail()
  @IsString()
  @IsOptional()
  @EmptyStringToUndefined()
  email!: string

  @StatusValidators()
  status!: number

  @IsBoolean()
  @Type(() => Boolean)
  @IsOptional()
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
    IsOptional(),
  )
}

// 表单提交的空字段是空字符串 ""，会绕过 @IsOptional。
// 这里把 "" 转成 undefined，让可选校验正常放行。
function EmptyStringToUndefined() {
  return Transform(({ value }: { value: unknown }) =>
    value === '' ? undefined : value,
  )
}
