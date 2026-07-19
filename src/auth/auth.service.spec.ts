import { CaptchaInvalidException } from './captcha-invalid.exception'
import { AuthService } from './auth.service'

describe('AuthService login', () => {
  it('does not query the user or issue tokens when captcha validation fails', async () => {
    const userService = { findForLogin: jest.fn() }
    const jwtService = { signAsync: jest.fn() }
    const captchaService = {
      verifyAndConsume: jest
        .fn()
        .mockRejectedValue(new CaptchaInvalidException()),
    }
    const rateLimitService = {
      checkLogin: jest.fn(),
      auditLogin: jest.fn(),
    }
    const service = new AuthService(
      userService as never,
      jwtService as never,
      {
        accessTokenSecret: 'access-secret-at-least-32-characters',
        refreshTokenSecret: 'refresh-secret-at-least-32-characters',
      } as never,
      captchaService as never,
      rateLimitService as never,
      {} as never,
    )

    await expect(
      service.login(
        'admin',
        'Test@123456',
        'a7c2f0d8-9b70-4cde-9f1c-6ffea4ea11aa',
        '0427',
        '127.0.0.1',
      ),
    ).rejects.toBeInstanceOf(CaptchaInvalidException)

    expect(userService.findForLogin).not.toHaveBeenCalled()
    expect(jwtService.signAsync).not.toHaveBeenCalled()
    expect(rateLimitService.auditLogin).toHaveBeenCalledWith(
      false,
      expect.anything(),
      'admin',
    )
  })
})
