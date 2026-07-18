import { DashboardWeatherService } from './dashboard-weather.service'
import { WebsiteSettingService } from './website-setting.service'

describe('DashboardWeatherService', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('normalizes Open-Meteo data and uses an in-memory cache', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        current: {
          weather_code: 2,
          temperature_2m: 31.2,
          apparent_temperature: 35.1,
          relative_humidity_2m: 72,
          wind_speed_10m: 13.5,
          wind_direction_10m: 135,
          time: '2026-07-18T08:00:00',
        },
        daily: {
          temperature_2m_max: [34],
          temperature_2m_min: [27],
        },
      }),
    })
    global.fetch = fetchMock
    const settingService = {
      findValue: jest.fn().mockResolvedValue({
        name: '上海',
        latitude: 31.2304,
        longitude: 121.4737,
      }),
    } as unknown as WebsiteSettingService
    const service = new DashboardWeatherService(settingService, {
      provider: 'open-meteo',
      apiKey: '',
      defaultLatitude: 31.2304,
      defaultLongitude: 121.4737,
      defaultName: '上海',
      cacheTtlSeconds: 900,
      timeoutMs: 5000,
    })

    const first = await service.getWeather()
    const second = await service.getWeather()

    expect(first).toMatchObject({
      cacheStatus: 'MISS',
      data: {
        location: { name: '上海' },
        current: {
          conditionCode: 2,
          conditionText: '多云',
          windDirection: '东南风',
          observedAt: new Date('2026-07-18T08:00:00.000Z'),
        },
        forecast: { high: 34, low: 27 },
      },
    })
    expect(second.cacheStatus).toBe('HIT')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
