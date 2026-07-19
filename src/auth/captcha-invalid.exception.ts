import { BadRequestException } from '@nestjs/common'

export const CAPTCHA_INVALID_CODE = 'CAPTCHA_INVALID'
export const CAPTCHA_INVALID_MESSAGE = '验证码错误或已过期，请刷新后重试'

export class CaptchaInvalidException extends BadRequestException {
  constructor() {
    super({
      code: CAPTCHA_INVALID_CODE,
      message: CAPTCHA_INVALID_MESSAGE,
    })
  }
}
