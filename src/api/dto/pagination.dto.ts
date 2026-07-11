import { Type } from 'class-transformer'
import { IsInt, IsOptional, Max, Min } from 'class-validator'

/** 通用分页查询参数，业务查询 DTO 可继承此类 */
export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  pageSize?: number = 10
}
