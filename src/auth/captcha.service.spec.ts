import { createHmac } from 'node:crypto'
import { CaptchaInvalidException } from './captcha-invalid.exception'
import { CaptchaService } from './captcha.service'

describe('CaptchaService', () => {
  const config = {
    captchaHmacSecret: 'a-secure-test-secret-with-at-least-32-chars',
  }
  const store = {
    create: jest.fn(),
    consume: jest.fn(),
  }
  const service = new CaptchaService(store as never, config as never)

  beforeEach(() => jest.clearAllMocks())

  it('returns a PNG data URL and stores only the answer HMAC', async () => {
    await expect(service.issue('127.0.0.0')).resolves.toMatchObject({
      captchaId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      image: expect.stringMatching(/^data:image\/png;base64,/),
    })
    expect(store.create).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringMatching(/^[0-9a-f]{64}$/),
    )
  })

  it('uses a constant-time HMAC comparison after atomically consuming the record', async () => {
    const captchaId = 'a7c2f0d8-9b70-4cde-9f1c-6ffea4ea11aa'
    store.consume.mockResolvedValue(
      createHmac('sha256', config.captchaHmacSecret)
        .update(`${captchaId}:0427`)
        .digest('hex'),
    )

    await expect(
      service.verifyAndConsume(captchaId, '0427'),
    ).resolves.toBeUndefined()
    expect(store.consume).toHaveBeenCalledWith(captchaId)
  })

  it('rejects an incorrect answer after consuming it', async () => {
    const captchaId = 'a7c2f0d8-9b70-4cde-9f1c-6ffea4ea11aa'
    store.consume.mockResolvedValue('0'.repeat(64))

    await expect(
      service.verifyAndConsume(captchaId, '0427'),
    ).rejects.toBeInstanceOf(CaptchaInvalidException)
    expect(store.consume).toHaveBeenCalledWith(captchaId)
  })
})
