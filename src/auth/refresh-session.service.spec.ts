import { randomUUID } from 'node:crypto'
import { RefreshSessionService } from './refresh-session.service'

describe('RefreshSessionService', () => {
  const redis = { execute: jest.fn() }
  const service = new RefreshSessionService(
    redis as never,
    {
      captchaRedisUrl: 'redis://localhost:6379/0',
      refreshSessionHmacSecret: 'a-secure-test-secret-with-at-least-32-chars',
      refreshTokenExpiresIn: 300,
    } as never,
  )

  beforeEach(() => jest.clearAllMocks())

  it('creates a Redis session with a one-way refresh token HMAC', async () => {
    redis.execute.mockResolvedValue(1)
    const sessionId = randomUUID()

    await service.create(1, sessionId, 'refresh-token-plaintext', {
      ip: '127.0.0.0',
    })

    const [, , , , , , stored] = redis.execute.mock.calls[0][1]
    expect(stored).not.toContain('refresh-token-plaintext')
    expect(JSON.parse(stored)).toMatchObject({
      id: sessionId,
      userId: 1,
      tokenHash: expect.stringMatching(/^[0-9a-f]{64}$/),
    })
  })

  it('returns the atomic replay result from Redis rotation', async () => {
    redis.execute.mockResolvedValue(['REPLAY', randomUUID()])

    await expect(
      service.rotate(
        1,
        randomUUID(),
        'old-refresh-token',
        randomUUID(),
        'next-refresh-token',
        { ip: '127.0.0.0' },
      ),
    ).resolves.toBe('REPLAY')
  })
})
