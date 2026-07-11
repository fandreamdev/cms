import { PartialType } from '@nestjs/mapped-types'
import { TagCreateDto } from './tag-create.dto'

export class TagUpdateDto extends PartialType(TagCreateDto) {}
