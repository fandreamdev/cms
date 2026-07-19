import { Inject, Injectable, Logger } from '@nestjs/common'
import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto'
import sharp from 'sharp'
import { authConfig } from '../shared/config'
import type { AuthConfigType } from '../shared/config'
import { CaptchaInvalidException } from './captcha-invalid.exception'
import { CaptchaStoreService } from './captcha-store.service'

export interface CaptchaResponse {
  captchaId: string
  image: string
}

@Injectable()
export class CaptchaService {
  private readonly logger = new Logger(CaptchaService.name)

  constructor(
    private readonly store: CaptchaStoreService,
    @Inject(authConfig.KEY) private readonly config: AuthConfigType,
  ) {}

  async issue(maskedIp: string): Promise<CaptchaResponse> {
    const captchaId = randomUUID()
    const answer = randomInt(0, 10_000).toString().padStart(4, '0')
    const image = await this.renderImage(answer)
    await this.store.create(captchaId, this.answerHash(captchaId, answer))
    this.audit('captcha_issued', { ip: maskedIp })
    return { captchaId, image }
  }

  async verifyAndConsume(captchaId: unknown, captcha: unknown): Promise<void> {
    if (
      typeof captchaId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        captchaId,
      ) ||
      typeof captcha !== 'string' ||
      !/^\d{4}$/.test(captcha)
    ) {
      throw new CaptchaInvalidException()
    }

    const storedHash = await this.store.consume(captchaId)
    if (!storedHash) throw new CaptchaInvalidException()

    const expectedHash = Buffer.from(storedHash, 'hex')
    const receivedHash = Buffer.from(this.answerHash(captchaId, captcha), 'hex')
    if (
      expectedHash.length !== receivedHash.length ||
      !timingSafeEqual(expectedHash, receivedHash)
    ) {
      throw new CaptchaInvalidException()
    }
  }

  private answerHash(captchaId: string, answer: string): string {
    return createHmac('sha256', this.config.captchaHmacSecret)
      .update(`${captchaId}:${answer}`)
      .digest('hex')
  }

  private async renderImage(answer: string): Promise<string> {
    const lines = Array.from({ length: 4 }, () => {
      const color = `rgb(${randomInt(120, 201)}, ${randomInt(120, 201)}, ${randomInt(120, 201)})`
      return `<line x1="${randomInt(0, 121)}" y1="${randomInt(0, 41)}" x2="${randomInt(0, 121)}" y2="${randomInt(0, 41)}" stroke="${color}" stroke-width="1"/>`
    }).join('')
    const dots = Array.from({ length: 28 }, () => {
      const color = `rgb(${randomInt(140, 211)}, ${randomInt(140, 211)}, ${randomInt(140, 211)})`
      return `<circle cx="${randomInt(1, 120)}" cy="${randomInt(1, 40)}" r="1" fill="${color}"/>`
    }).join('')
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40" viewBox="0 0 120 40"><rect width="120" height="40" rx="3" fill="#f8fafc"/>${lines}<text x="18" y="28" fill="#1e293b" font-family="Arial, sans-serif" font-size="24" font-weight="700" letter-spacing="6">${answer}</text>${dots}</svg>`
    const png = await sharp(Buffer.from(svg)).png().toBuffer()
    return `data:image/png;base64,${png.toString('base64')}`
  }

  private audit(event: string, details: Record<string, string>): void {
    this.logger.log(JSON.stringify({ event: `auth.${event}`, ...details }))
  }
}
