import {
  BadGatewayException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common'
import { weatherConfig } from '../config'
import type { WeatherConfigType } from '../config'
import { WebsiteSettingService } from './website-setting.service'

export interface WeatherLocation {
  name: string
  latitude: number
  longitude: number
}

export interface DashboardWeather {
  location: {
    name: string
    region?: string | null
    country?: string | null
  }
  current: {
    conditionCode: number
    conditionText: string
    temperature: number
    feelsLike: number
    humidity: number
    windSpeed: number
    windDirection?: string | null
    observedAt: Date
  }
  forecast?: { high: number; low: number } | null
}

export type WeatherCacheStatus = 'HIT' | 'MISS' | 'STALE'

export interface DashboardWeatherResult {
  data: DashboardWeather
  cacheStatus: WeatherCacheStatus
}

interface WeatherCacheEntry {
  data: DashboardWeather
  expiresAt: number
}

interface WeatherProvider {
  getCurrentWeather(location: WeatherLocation): Promise<DashboardWeather>
}

class WeatherTimeoutError extends Error {}

@Injectable()
export class DashboardWeatherService implements WeatherProvider {
  private readonly logger = new Logger(DashboardWeatherService.name)
  private readonly cache = new Map<string, WeatherCacheEntry>()

  constructor(
    private readonly settingService: WebsiteSettingService,
    @Inject(weatherConfig.KEY)
    private readonly config: WeatherConfigType,
  ) {}

  async getWeather(): Promise<DashboardWeatherResult> {
    const location = await this.resolveLocation()
    const cacheKey = `${this.config.provider}:${location.latitude}:${location.longitude}`
    const cached = this.cache.get(cacheKey)
    const now = Date.now()
    if (cached && cached.expiresAt > now) {
      return { data: cached.data, cacheStatus: 'HIT' }
    }

    try {
      const data = await this.getCurrentWeather(location)
      this.cache.set(cacheKey, {
        data,
        expiresAt: now + (this.config.cacheTtlSeconds ?? 900) * 1000,
      })
      return { data, cacheStatus: 'MISS' }
    } catch (error) {
      if (cached) {
        this.logger.warn(
          `Weather provider failed; serving stale cache for ${cacheKey}: ${this.errorMessage(error)}`,
        )
        return { data: cached.data, cacheStatus: 'STALE' }
      }
      if (error instanceof WeatherTimeoutError) {
        throw new ServiceUnavailableException('天气服务暂不可用')
      }
      if (error instanceof BadGatewayException) throw error
      throw new BadGatewayException('天气服务返回无效数据')
    }
  }

  async getCurrentWeather(
    location: WeatherLocation,
  ): Promise<DashboardWeather> {
    if (this.config.provider !== 'open-meteo') {
      throw new BadGatewayException('不支持的天气服务提供商')
    }

    const url = new URL('https://api.open-meteo.com/v1/forecast')
    url.search = new URLSearchParams({
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      current:
        'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code',
      daily: 'temperature_2m_max,temperature_2m_min',
      forecast_days: '1',
      timezone: 'UTC',
      temperature_unit: 'celsius',
      wind_speed_unit: 'kmh',
    }).toString()

    const controller = new AbortController()
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.timeoutMs ?? 5000,
    )
    try {
      const response = await fetch(url, { signal: controller.signal })
      if (!response.ok) {
        throw new BadGatewayException('天气服务请求失败')
      }
      return this.adaptOpenMeteo(location, await response.json())
    } catch (error) {
      if (error instanceof BadGatewayException) throw error
      if (this.isAbortError(error)) throw new WeatherTimeoutError()
      throw new BadGatewayException('天气服务请求失败')
    } finally {
      clearTimeout(timeout)
    }
  }

  private async resolveLocation(): Promise<WeatherLocation> {
    const value = await this.settingService.findValue('weather:location')
    if (value === undefined) {
      return {
        name: this.config.defaultName ?? '上海',
        latitude: this.config.defaultLatitude ?? 31.2304,
        longitude: this.config.defaultLongitude ?? 121.4737,
      }
    }
    if (!this.isWeatherLocation(value)) {
      throw new InternalServerErrorException('天气位置配置不合法')
    }
    return value
  }

  private adaptOpenMeteo(
    location: WeatherLocation,
    payload: unknown,
  ): DashboardWeather {
    if (!this.isRecord(payload) || !this.isRecord(payload.current)) {
      throw new BadGatewayException('天气服务返回无效数据')
    }
    const current = payload.current
    const weatherCode = this.numberField(current, 'weather_code')
    const observedAt = this.dateField(current, 'time')
    const humidity = this.numberField(current, 'relative_humidity_2m')
    if (humidity < 0 || humidity > 100) {
      throw new BadGatewayException('天气服务返回无效数据')
    }

    const forecast = this.adaptForecast(payload.daily)
    const windDegree = this.numberField(current, 'wind_direction_10m')
    return {
      location: { name: location.name },
      current: {
        conditionCode: weatherCode,
        conditionText: this.conditionText(weatherCode),
        temperature: this.numberField(current, 'temperature_2m'),
        feelsLike: this.numberField(current, 'apparent_temperature'),
        humidity,
        windSpeed: this.numberField(current, 'wind_speed_10m'),
        windDirection: this.windDirection(windDegree),
        observedAt,
      },
      forecast,
    }
  }

  private adaptForecast(value: unknown): { high: number; low: number } | null {
    if (!this.isRecord(value)) return null
    const highs = value.temperature_2m_max
    const lows = value.temperature_2m_min
    if (!this.isNumberArray(highs) || !this.isNumberArray(lows)) return null
    const high = highs[0]
    const low = lows[0]
    if (typeof high !== 'number' || typeof low !== 'number') return null
    return { high, low }
  }

  private conditionText(code: number): string {
    if (code === 0) return '晴'
    if (code === 1) return '晴间多云'
    if (code === 2) return '多云'
    if (code === 3) return '阴'
    if ([45, 48].includes(code)) return '雾'
    if ([51, 53, 55].includes(code)) return '毛毛雨'
    if ([56, 57].includes(code)) return '冻毛毛雨'
    if ([61, 63, 65].includes(code)) return '降雨'
    if ([66, 67].includes(code)) return '冻雨'
    if ([71, 73, 75, 77].includes(code)) return '降雪'
    if ([80, 81, 82].includes(code)) return '阵雨'
    if ([85, 86].includes(code)) return '阵雪'
    if ([95, 96, 99].includes(code)) return '雷暴'
    return '未知天气'
  }

  private windDirection(degrees: number): string {
    const directions = [
      '北风',
      '东北风',
      '东风',
      '东南风',
      '南风',
      '西南风',
      '西风',
      '西北风',
    ]
    return directions[Math.round((((degrees % 360) + 360) % 360) / 45) % 8]
  }

  private numberField(value: Record<string, unknown>, key: string): number {
    const number = value[key]
    if (typeof number !== 'number' || !Number.isFinite(number)) {
      throw new BadGatewayException('天气服务返回无效数据')
    }
    return number
  }

  private dateField(value: Record<string, unknown>, key: string): Date {
    const raw = value[key]
    const normalized =
      typeof raw === 'string' && !/(?:Z|[+-]\d{2}:\d{2})$/i.test(raw)
        ? `${raw}Z`
        : raw
    const date =
      typeof normalized === 'string' ? new Date(normalized) : undefined
    if (!date || Number.isNaN(date.getTime())) {
      throw new BadGatewayException('天气服务返回无效数据')
    }
    return date
  }

  private isWeatherLocation(value: unknown): value is WeatherLocation {
    if (!this.isRecord(value)) return false
    const { name, latitude, longitude } = value
    return (
      typeof name === 'string' &&
      name.trim().length > 0 &&
      typeof latitude === 'number' &&
      Number.isFinite(latitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      typeof longitude === 'number' &&
      Number.isFinite(longitude) &&
      longitude >= -180 &&
      longitude <= 180
    )
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null
  }

  private isNumberArray(value: unknown): value is number[] {
    return (
      Array.isArray(value) && value.every((item) => typeof item === 'number')
    )
  }

  private isAbortError(error: unknown): boolean {
    return error instanceof Error && error.name === 'AbortError'
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
  }
}
