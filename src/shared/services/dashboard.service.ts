import { Injectable, InternalServerErrorException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { ObjectLiteral, Repository } from 'typeorm'
import type { AuthUser } from '../../auth/auth-user'
import { Access } from '../entities/access.entity'
import { Article } from '../entities/article.entity'
import { Category } from '../entities/category.entity'
import { Role } from '../entities/role.entity'
import { Tag } from '../entities/tag.entity'
import { User } from '../entities/user.entity'
import { AccessType } from '../enum/access.enum'
import { ArticleApprovalStatus } from '../enum/article-approval-status.enum'
import {
  CreatedAtPeriods,
  DashboardRecentSetting,
  WebsiteSettingService,
} from './website-setting.service'

const RECENT_LIMIT = 5
const GROWTH_PERIOD_DAYS = 7
const DAY_IN_MS = 24 * 60 * 60 * 1000

type DashboardTrend = 'up' | 'down' | 'flat'

export interface DashboardGrowthMetric {
  current: number
  previous: number
  rate: number | null
  trend: DashboardTrend
}

export interface DashboardRecentArticle {
  id: number
  title: string
  approvalStatus: ArticleApprovalStatus
  category: { id: number; name: string } | null
  updatedAt: Date
}

export interface DashboardRecentNamedItem {
  id: number
  name: string
  description: string | null
  updatedAt: Date
}

export interface DashboardRecentUser {
  id: number
  username: string
  status: 0 | 1
  updatedAt: Date
}

export interface DashboardRecentAccess {
  id: number
  type: AccessType
  url: string
  description: string
  updatedAt: Date
}

export interface DashboardArticleMetrics {
  approval: Record<ArticleApprovalStatus, number>
  publication: { offline: number; online: number }
}

export interface DashboardOverview {
  generatedAt: Date
  metrics: {
    articles?: number
    categories?: number
    tags?: number
    users?: number
    roles?: number
    accesses?: number
    settings?: number
  }
  growth: {
    periodDays: 7
    currentFrom: Date
    currentTo: Date
    previousFrom: Date
    articles?: DashboardGrowthMetric
    categories?: DashboardGrowthMetric
    tags?: DashboardGrowthMetric
    users?: DashboardGrowthMetric
    roles?: DashboardGrowthMetric
    accesses?: DashboardGrowthMetric
    settings?: DashboardGrowthMetric
  }
  articles?: DashboardArticleMetrics
  recent: {
    articles?: DashboardRecentArticle[]
    categories?: DashboardRecentNamedItem[]
    tags?: DashboardRecentNamedItem[]
    users?: DashboardRecentUser[]
    roles?: Array<Pick<DashboardRecentNamedItem, 'id' | 'name' | 'updatedAt'>>
    accesses?: DashboardRecentAccess[]
    settings?: DashboardRecentSetting[]
  }
}

interface GrowthModuleData {
  total: number
  growth: DashboardGrowthMetric
}

interface ArticleDashboardData extends GrowthModuleData {
  approval: Record<ArticleApprovalStatus, number>
  publication: { offline: number; online: number }
  recent: DashboardRecentArticle[]
}

interface RecentModuleData<T> extends GrowthModuleData {
  recent: T[]
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Article)
    private readonly articleRepository: Repository<Article>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(Tag)
    private readonly tagRepository: Repository<Tag>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(Access)
    private readonly accessRepository: Repository<Access>,
    private readonly settingService: WebsiteSettingService,
  ) {}

  async getOverview(user: AuthUser): Promise<DashboardOverview> {
    const generatedAt = new Date()
    const periods = this.createPeriods(generatedAt)
    const [articles, categories, tags, users, roles, accesses, settings] =
      await Promise.all([
        this.hasPermission(user, 'article:list')
          ? this.getArticleMetrics(periods)
          : undefined,
        this.hasPermission(user, 'category:list')
          ? this.getCategoryMetrics(periods)
          : undefined,
        this.hasPermission(user, 'tag:list')
          ? this.getTagMetrics(periods)
          : undefined,
        this.hasPermission(user, 'user:list')
          ? this.getUserMetrics(periods)
          : undefined,
        this.hasPermission(user, 'role:list')
          ? this.getRoleMetrics(periods)
          : undefined,
        this.hasPermission(user, 'access:list')
          ? this.getAccessMetrics(periods)
          : undefined,
        this.hasPermission(user, 'setting:list')
          ? this.getSettingMetrics(periods)
          : undefined,
      ])

    const metrics: DashboardOverview['metrics'] = {}
    const growth: DashboardOverview['growth'] = {
      periodDays: GROWTH_PERIOD_DAYS,
      currentFrom: periods.currentFrom,
      currentTo: periods.currentTo,
      previousFrom: periods.previousFrom,
    }
    const recent: DashboardOverview['recent'] = {}
    if (articles) {
      metrics.articles = articles.total
      growth.articles = articles.growth
      recent.articles = articles.recent
    }
    if (categories) {
      metrics.categories = categories.total
      growth.categories = categories.growth
      recent.categories = categories.recent
    }
    if (tags) {
      metrics.tags = tags.total
      growth.tags = tags.growth
      recent.tags = tags.recent
    }
    if (users) {
      metrics.users = users.total
      growth.users = users.growth
      recent.users = users.recent
    }
    if (roles) {
      metrics.roles = roles.total
      growth.roles = roles.growth
      recent.roles = roles.recent
    }
    if (accesses) {
      metrics.accesses = accesses.total
      growth.accesses = accesses.growth
      recent.accesses = accesses.recent
    }
    if (settings) {
      metrics.settings = settings.total
      growth.settings = settings.growth
      recent.settings = settings.recent
    }

    return {
      generatedAt,
      metrics,
      growth,
      ...(articles && {
        articles: {
          approval: articles.approval,
          publication: articles.publication,
        },
      }),
      recent,
    }
  }

  private hasPermission(user: AuthUser, permission: string): boolean {
    return user.isSuper || user.permissions.includes(permission)
  }

  private createPeriods(currentTo: Date): CreatedAtPeriods {
    const currentFrom = new Date(
      currentTo.getTime() - GROWTH_PERIOD_DAYS * DAY_IN_MS,
    )
    return {
      currentTo,
      currentFrom,
      previousFrom: new Date(
        currentFrom.getTime() - GROWTH_PERIOD_DAYS * DAY_IN_MS,
      ),
    }
  }

  private async getArticleMetrics(
    periods: CreatedAtPeriods,
  ): Promise<ArticleDashboardData> {
    const [total, approvalRows, publicationRows, recentArticles, growth] =
      await Promise.all([
        this.articleRepository.count(),
        this.articleRepository
          .createQueryBuilder('article')
          .select('article.approvalStatus', 'status')
          .addSelect('COUNT(*)', 'count')
          .groupBy('article.approvalStatus')
          .getRawMany<{ status: ArticleApprovalStatus; count: string }>(),
        this.articleRepository
          .createQueryBuilder('article')
          .select('article.status', 'status')
          .addSelect('COUNT(*)', 'count')
          .groupBy('article.status')
          .getRawMany<{ status: string | number; count: string }>(),
        this.articleRepository
          .createQueryBuilder('article')
          .leftJoinAndSelect('article.category', 'category')
          .select([
            'article.id',
            'article.title',
            'article.approvalStatus',
            'article.updatedAt',
            'category.id',
            'category.name',
          ])
          .orderBy('article.updatedAt', 'DESC')
          .addOrderBy('article.id', 'DESC')
          .take(RECENT_LIMIT)
          .getMany(),
        this.getRelationalGrowth(this.articleRepository, periods),
      ])

    const approval = this.normalizeApproval(approvalRows)
    const publication = this.normalizePublication(publicationRows)
    if (
      Object.values(approval).reduce((sum, count) => sum + count, 0) !==
        total ||
      publication.offline + publication.online !== total
    ) {
      throw new InternalServerErrorException('文章状态统计不一致')
    }

    return {
      total,
      growth,
      approval,
      publication,
      recent: recentArticles.map((article) => ({
        id: article.id,
        title: article.title,
        approvalStatus: article.approvalStatus,
        category: article.category
          ? { id: article.category.id, name: article.category.name }
          : null,
        updatedAt: article.updatedAt,
      })),
    }
  }

  private async getCategoryMetrics(
    periods: CreatedAtPeriods,
  ): Promise<RecentModuleData<DashboardRecentNamedItem>> {
    const [total, items, growth] = await Promise.all([
      this.categoryRepository.count(),
      this.categoryRepository.find({
        select: { id: true, name: true, description: true, updatedAt: true },
        order: { updatedAt: 'DESC', id: 'DESC' },
        take: RECENT_LIMIT,
      }),
      this.getRelationalGrowth(this.categoryRepository, periods),
    ])
    return { total, growth, recent: items }
  }

  private async getTagMetrics(
    periods: CreatedAtPeriods,
  ): Promise<RecentModuleData<DashboardRecentNamedItem>> {
    const [total, items, growth] = await Promise.all([
      this.tagRepository.count(),
      this.tagRepository.find({
        select: { id: true, name: true, description: true, updatedAt: true },
        order: { updatedAt: 'DESC', id: 'DESC' },
        take: RECENT_LIMIT,
      }),
      this.getRelationalGrowth(this.tagRepository, periods),
    ])
    return { total, growth, recent: items }
  }

  private async getUserMetrics(
    periods: CreatedAtPeriods,
  ): Promise<RecentModuleData<DashboardRecentUser>> {
    const [total, items, growth] = await Promise.all([
      this.userRepository.count(),
      this.userRepository.find({
        select: { id: true, username: true, status: true, updatedAt: true },
        order: { updatedAt: 'DESC', id: 'DESC' },
        take: RECENT_LIMIT,
      }),
      this.getRelationalGrowth(this.userRepository, periods),
    ])
    return {
      total,
      growth,
      recent: items.map((item) => ({
        ...item,
        status: item.status as 0 | 1,
      })),
    }
  }

  private async getRoleMetrics(
    periods: CreatedAtPeriods,
  ): Promise<
    RecentModuleData<
      Pick<DashboardRecentNamedItem, 'id' | 'name' | 'updatedAt'>
    >
  > {
    const [total, items, growth] = await Promise.all([
      this.roleRepository.count(),
      this.roleRepository.find({
        select: { id: true, name: true, updatedAt: true },
        order: { updatedAt: 'DESC', id: 'DESC' },
        take: RECENT_LIMIT,
      }),
      this.getRelationalGrowth(this.roleRepository, periods),
    ])
    return { total, growth, recent: items }
  }

  private async getAccessMetrics(
    periods: CreatedAtPeriods,
  ): Promise<RecentModuleData<DashboardRecentAccess>> {
    const [total, items, growth] = await Promise.all([
      this.accessRepository.count(),
      this.accessRepository.find({
        select: {
          id: true,
          type: true,
          url: true,
          description: true,
          updatedAt: true,
        },
        order: { updatedAt: 'DESC', id: 'DESC' },
        take: RECENT_LIMIT,
      }),
      this.getRelationalGrowth(this.accessRepository, periods),
    ])
    return { total, growth, recent: items }
  }

  private async getSettingMetrics(
    periods: CreatedAtPeriods,
  ): Promise<RecentModuleData<DashboardRecentSetting>> {
    const [total, recent, periodCounts] = await Promise.all([
      this.settingService.count(),
      this.settingService.findRecent(RECENT_LIMIT),
      this.settingService.countCreatedByPeriods(periods),
    ])
    return { total, growth: this.toGrowthMetric(periodCounts), recent }
  }

  private async getRelationalGrowth<T extends ObjectLiteral>(
    repository: Repository<T>,
    periods: CreatedAtPeriods,
  ): Promise<DashboardGrowthMetric> {
    const [current, previous] = await Promise.all([
      repository
        .createQueryBuilder('item')
        .where(
          'item.createdAt >= :currentFrom AND item.createdAt < :currentTo',
          {
            currentFrom: periods.currentFrom,
            currentTo: periods.currentTo,
          },
        )
        .getCount(),
      repository
        .createQueryBuilder('item')
        .where(
          'item.createdAt >= :previousFrom AND item.createdAt < :currentFrom',
          {
            previousFrom: periods.previousFrom,
            currentFrom: periods.currentFrom,
          },
        )
        .getCount(),
    ])
    return this.toGrowthMetric({ current, previous })
  }

  private toGrowthMetric({
    current,
    previous,
  }: {
    current: number
    previous: number
  }): DashboardGrowthMetric {
    const rate =
      previous === 0
        ? current === 0
          ? 0
          : null
        : Math.round(((current - previous) / previous) * 1000) / 10
    return {
      current,
      previous,
      rate,
      trend: current > previous ? 'up' : current < previous ? 'down' : 'flat',
    }
  }

  private normalizeApproval(
    rows: { status: ArticleApprovalStatus; count: string }[],
  ): Record<ArticleApprovalStatus, number> {
    const approval: Record<ArticleApprovalStatus, number> = {
      [ArticleApprovalStatus.DRAFT]: 0,
      [ArticleApprovalStatus.PENDING]: 0,
      [ArticleApprovalStatus.APPROVED]: 0,
      [ArticleApprovalStatus.REJECTED]: 0,
      [ArticleApprovalStatus.WITHDRAWN]: 0,
    }
    const statuses = new Set(Object.values(ArticleApprovalStatus))

    for (const row of rows) {
      if (!statuses.has(row.status)) {
        throw new InternalServerErrorException('存在未知文章审批状态')
      }
      approval[row.status] = Number(row.count)
    }
    return approval
  }

  private normalizePublication(
    rows: { status: string | number; count: string }[],
  ): { offline: number; online: number } {
    const publication = { offline: 0, online: 0 }
    for (const row of rows) {
      if (String(row.status) === '0') publication.offline = Number(row.count)
      else if (String(row.status) === '1') {
        publication.online = Number(row.count)
      } else {
        throw new InternalServerErrorException('存在未知文章上架状态')
      }
    }
    return publication
  }
}
