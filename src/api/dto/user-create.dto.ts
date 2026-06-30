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
import { i18nValidationMessage } from 'nestjs-i18n'

export class UserCreateDto {
  @UsernameValidators()
  username!: string

  @PasswordValidators()
  password!: string

  @MobileValidators()
  mobile!: string

  @EmailValidators()
  email!: string

  @StatusValidators()
  status!: number

  @IsSuperValidators()
  isSuper!: boolean

  @SortValidators()
  sort!: number
}

function UsernameValidators() {
  return applyDecorators(
    IsString({
      message: i18nValidationMessage('validation.isString', {
        field: 'username',
      }),
    }),
    IsUserAlreadyExist({
      groups: ['new'],
      message: i18nValidationMessage('validation.isUserAlreadyExist', {
        field: 'username',
      }),
    }),
  )
}

function PasswordValidators() {
  return applyDecorators(
    IsString({
      message: i18nValidationMessage('validation.isString', {
        field: 'password',
      }),
    }),
    MinLength(4, {
      message: i18nValidationMessage('validation.minLength', {
        field: 'password',
        length: 4,
      }),
    }),
  )
}

function MobileValidators() {
  return applyDecorators(
    IsOptional(),
    EmptyStringToUndefined(),
    IsString({
      message: i18nValidationMessage('validation.isString', {
        field: 'mobile',
      }),
    }),
    IsPhoneNumber('CN', {
      message: i18nValidationMessage('validation.isPhoneNumber', {
        field: 'mobile',
      }),
    }),
  )
}

function EmailValidators() {
  return applyDecorators(
    IsOptional(),
    EmptyStringToUndefined(),
    IsString({
      message: i18nValidationMessage('validation.isString', {
        field: 'email',
      }),
    }),
    IsEmail(
      {},
      {
        message: i18nValidationMessage('validation.isEmail', {
          field: 'email',
        }),
      },
    ),
  )
}

function StatusValidators() {
  return applyDecorators(
    Type(() => Number),
    IsNumber(
      {},
      {
        message: i18nValidationMessage('validation.isNumber', {
          field: 'status',
        }),
      },
    ),
    IsIn([0, 1], {
      message: i18nValidationMessage('validation.isIn', { field: 'status' }),
    }),
  )
}

function IsSuperValidators() {
  return applyDecorators(
    IsOptional(),
    Type(() => Boolean),
    IsBoolean({
      message: i18nValidationMessage('validation.isBoolean', {
        field: 'isSuper',
      }),
    }),
  )
}

function SortValidators() {
  return applyDecorators(
    IsOptional(),
    Type(() => Number),
    IsNumber(
      {},
      {
        message: i18nValidationMessage('validation.isNumber', {
          field: 'sort',
        }),
      },
    ),
    Min(0, {
      message: i18nValidationMessage('validation.min', {
        field: 'sort',
        min: 0,
      }),
    }),
  )
}

// 表单提交的空字段是空字符串 ""，会绕过 @IsOptional。
// 这里把 "" 转成 undefined，让可选校验正常放行。
function EmptyStringToUndefined() {
  return Transform(({ value }: { value: unknown }) =>
    value === '' ? undefined : value,
  )
}
