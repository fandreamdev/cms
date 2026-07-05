import { PartialType } from '@nestjs/mapped-types'

import { UserCreateDto } from './user-create.dto'
import { IsOptional, IsString, MinLength } from 'class-validator'
import { applyDecorators } from '@nestjs/common'
import { i18nValidationMessage } from 'nestjs-i18n'
import { EmptyStringToUndefined } from '../../../shared/decorator/empty-string-to-undefined.decorator'

export class UserUpdateDto extends PartialType(UserCreateDto) {
  @IsString()
  username!: string

  @PasswordValidators()
  password!: string
}

function PasswordValidators() {
  return applyDecorators(
    EmptyStringToUndefined(),
    IsOptional(),
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
