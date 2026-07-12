import { IsNotEmpty, IsString, MaxLength } from 'class-validator'

export class ArticleRejectDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string
}
