import { Allow, IsOptional, IsString, MinLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class LoginDto {
  @ApiProperty({ example: 'admin' })
  @IsString()
  username!: string

  @ApiProperty({ example: 'Test@123456', format: 'password' })
  @IsString()
  @MinLength(4)
  password!: string

  @ApiProperty({
    example: 'a7c2f0d8-9b70-4cde-9f1c-6ffea4ea11aa',
    description: 'GET /api/auth/captcha 返回的验证码 ID',
  })
  @IsOptional()
  @Allow()
  captchaId?: string

  @ApiProperty({ example: '0427', description: '4 位数字验证码' })
  @IsOptional()
  @Allow()
  captcha?: string
}
