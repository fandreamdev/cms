import { PartialType } from '@nestjs/mapped-types'

import { UserCreateDto } from './user-create.dto'
import { IsString } from 'class-validator'

export class UserUpdateDto extends PartialType(UserCreateDto) {
  @IsString()
  username!: string
}
