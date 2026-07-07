import { PartialType } from '@nestjs/mapped-types'
import { AccessCreateDto } from './access-create.dto'

export class AccessUpdateDto extends PartialType(AccessCreateDto) {}
