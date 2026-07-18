import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DashboardController } from '../../api/controller/dashboard.controller'
import { Access } from '../../shared/entities/access.entity'
import { Article } from '../../shared/entities/article.entity'
import { Category } from '../../shared/entities/category.entity'
import { Role } from '../../shared/entities/role.entity'
import { Tag } from '../../shared/entities/tag.entity'
import { User } from '../../shared/entities/user.entity'
import { DashboardService } from '../../shared/services/dashboard.service'
import { DashboardWeatherService } from '../../shared/services/dashboard-weather.service'
import { DashboardSystemService } from '../../shared/services/dashboard-system.service'
import { DashboardSystemSocketService } from '../../shared/services/dashboard-system-socket.service'
import { SettingsModule } from '../settings/settings.module'
import { SystemModule } from '../system/system.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([Article, Category, Tag, User, Role, Access]),
    SettingsModule,
    SystemModule,
  ],
  controllers: [DashboardController],
  providers: [
    DashboardService,
    DashboardWeatherService,
    DashboardSystemService,
    DashboardSystemSocketService,
  ],
})
export class DashboardModule {}
