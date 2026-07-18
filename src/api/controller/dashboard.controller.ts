import { Get, Header, Post, Res } from '@nestjs/common'
import type { Response } from 'express'
import { CurrentUser } from '../../auth/current-user.decorator'
import type { AuthUser } from '../../auth/auth-user'
import { ApiResourceController } from '../common'
import {
  DashboardOverview,
  DashboardService,
} from '../../shared/services/dashboard.service'
import {
  DashboardWeatherResult,
  DashboardWeatherService,
} from '../../shared/services/dashboard-weather.service'
import { RequirePermissions } from '../../auth/permissions.decorator'
import { DashboardSystemService } from '../../shared/services/dashboard-system.service'
import type { DashboardSystemStatus } from '../../shared/services/dashboard-system.service'
import { DashboardSystemSocketService } from '../../shared/services/dashboard-system-socket.service'
import type { DashboardSystemSocketTicket } from '../../shared/services/dashboard-system-socket.service'

@ApiResourceController('api/dashboard')
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly weatherService: DashboardWeatherService,
    private readonly systemService: DashboardSystemService,
    private readonly systemSocketService: DashboardSystemSocketService,
  ) {}

  @Get('overview')
  @Header('Cache-Control', 'private, max-age=30')
  getOverview(@CurrentUser() user: AuthUser): Promise<DashboardOverview> {
    return this.dashboardService.getOverview(user)
  }

  @Get('weather')
  async getWeather(
    @Res({ passthrough: true }) response: Response,
  ): Promise<DashboardWeatherResult['data']> {
    const result = await this.weatherService.getWeather()
    response.setHeader('X-Weather-Cache', result.cacheStatus)
    response.setHeader('Cache-Control', 'private, max-age=600')
    return result.data
  }

  @Get('system')
  @RequirePermissions('system:monitor')
  @Header('Cache-Control', 'private, max-age=30')
  getSystem(): DashboardSystemStatus {
    return this.systemService.getStatus()
  }

  @Post('system/socket-ticket')
  @RequirePermissions('system:monitor')
  createSystemSocketTicket(
    @CurrentUser() user: AuthUser,
  ): DashboardSystemSocketTicket {
    return this.systemSocketService.issueTicket(user)
  }
}
