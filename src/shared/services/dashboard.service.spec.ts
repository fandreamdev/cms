import type { Repository } from 'typeorm'
import type { AuthUser } from '../../auth/auth-user'
import { Access } from '../entities/access.entity'
import { Article } from '../entities/article.entity'
import { Category } from '../entities/category.entity'
import { Role } from '../entities/role.entity'
import { Tag } from '../entities/tag.entity'
import { User } from '../entities/user.entity'
import { ArticleApprovalStatus } from '../enum/article-approval-status.enum'
import { WebsiteSettingService } from './website-setting.service'
import { DashboardService } from './dashboard.service'

function createArticleRepository(): Repository<Article> {
  const approvalQuery = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue([
      { status: ArticleApprovalStatus.DRAFT, count: '1' },
      { status: ArticleApprovalStatus.APPROVED, count: '2' },
    ]),
  }
  const publicationQuery = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue([
      { status: 0, count: '1' },
      { status: 1, count: '2' },
    ]),
  }
  const recentQuery = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([
      {
        id: 3,
        title: '最近文章',
        approvalStatus: ArticleApprovalStatus.APPROVED,
        category: { id: 2, name: '公告' },
        updatedAt: new Date('2026-07-18T07:30:00.000Z'),
      },
    ]),
  }
  const currentGrowthQuery = {
    where: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockResolvedValue(2),
  }
  const previousGrowthQuery = {
    where: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockResolvedValue(1),
  }

  return {
    count: jest.fn().mockResolvedValue(3),
    createQueryBuilder: jest
      .fn()
      .mockReturnValueOnce(approvalQuery)
      .mockReturnValueOnce(publicationQuery)
      .mockReturnValueOnce(recentQuery)
      .mockReturnValueOnce(currentGrowthQuery)
      .mockReturnValueOnce(previousGrowthQuery),
  } as unknown as Repository<Article>
}

function createRepository<T>(count: number, items: T[]): Repository<T> {
  const currentGrowthQuery = {
    where: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockResolvedValue(2),
  }
  const previousGrowthQuery = {
    where: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockResolvedValue(1),
  }
  return {
    count: jest.fn().mockResolvedValue(count),
    find: jest.fn().mockResolvedValue(items),
    createQueryBuilder: jest
      .fn()
      .mockReturnValueOnce(currentGrowthQuery)
      .mockReturnValueOnce(previousGrowthQuery),
  } as unknown as Repository<T>
}

describe('DashboardService', () => {
  it('returns all metrics and all permission-scoped recent lists for a super administrator', async () => {
    const settingService = {
      count: jest.fn().mockResolvedValue(7),
      findRecent: jest.fn().mockResolvedValue([
        {
          key: 'site:name',
          isPublic: true,
          description: '网站名称',
          updatedAt: new Date('2026-07-18T07:00:00.000Z'),
        },
      ]),
      countCreatedByPeriods: jest.fn().mockResolvedValue({
        current: 2,
        previous: 1,
      }),
    } as unknown as WebsiteSettingService
    const service = new DashboardService(
      createArticleRepository(),
      createRepository(4, [
        {
          id: 4,
          name: '产品',
          description: null,
          updatedAt: new Date(),
        },
      ]) as Repository<Category>,
      createRepository(5, [
        {
          id: 5,
          name: 'NestJS',
          description: '标签',
          updatedAt: new Date(),
        },
      ]) as Repository<Tag>,
      createRepository(6, [
        { id: 6, username: 'editor', status: 1, updatedAt: new Date() },
      ]) as Repository<User>,
      createRepository(2, [
        { id: 2, name: '管理员', updatedAt: new Date() },
      ]) as Repository<Role>,
      createRepository(9, [
        {
          id: 9,
          type: 'feature',
          url: 'article:list',
          description: '文章列表',
          updatedAt: new Date(),
        },
      ]) as Repository<Access>,
      settingService,
    )

    const overview = await service.getOverview({
      isSuper: true,
      permissions: [],
    } as AuthUser)

    expect(overview.metrics).toEqual({
      articles: 3,
      categories: 4,
      tags: 5,
      users: 6,
      roles: 2,
      accesses: 9,
      settings: 7,
    })
    expect(overview.articles).toEqual({
      approval: {
        draft: 1,
        pending: 0,
        approved: 2,
        rejected: 0,
        withdrawn: 0,
      },
      publication: { offline: 1, online: 2 },
    })
    expect(overview.growth).toMatchObject({
      periodDays: 7,
      articles: { current: 2, previous: 1, rate: 100, trend: 'up' },
      categories: { current: 2, previous: 1, rate: 100, trend: 'up' },
      settings: { current: 2, previous: 1, rate: 100, trend: 'up' },
    })
    expect(overview.recent).toEqual(
      expect.objectContaining({
        articles: [expect.objectContaining({ id: 3 })],
        categories: [expect.objectContaining({ id: 4 })],
        tags: [expect.objectContaining({ id: 5 })],
        users: [expect.objectContaining({ id: 6, username: 'editor' })],
        roles: [expect.objectContaining({ id: 2 })],
        accesses: [expect.objectContaining({ id: 9 })],
        settings: [
          expect.objectContaining({
            key: 'site:name',
            isPublic: true,
          }),
        ],
      }),
    )
    expect(overview.recent.settings?.[0]).not.toHaveProperty('value')
  })

  it('only queries and returns modules for which the user has list permission', async () => {
    const articleRepository = createArticleRepository()
    const categoryCount = jest.fn().mockResolvedValue(4)
    const categoryFind = jest.fn().mockResolvedValue([])
    const categoryCurrentGrowth = {
      where: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
    }
    const categoryPreviousGrowth = {
      where: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
    }
    const categoryRepository = {
      count: categoryCount,
      find: categoryFind,
      createQueryBuilder: jest
        .fn()
        .mockReturnValueOnce(categoryCurrentGrowth)
        .mockReturnValueOnce(categoryPreviousGrowth),
    } as unknown as Repository<Category>
    const tagCount = jest.fn()
    const tagFind = jest.fn()
    const tagRepository = {
      count: tagCount,
      find: tagFind,
    } as unknown as Repository<Tag>
    const userCount = jest.fn()
    const userFind = jest.fn()
    const userRepository = {
      count: userCount,
      find: userFind,
    } as unknown as Repository<User>
    const roleCount = jest.fn()
    const roleFind = jest.fn()
    const roleRepository = {
      count: roleCount,
      find: roleFind,
    } as unknown as Repository<Role>
    const accessCount = jest.fn()
    const accessFind = jest.fn()
    const accessRepository = {
      count: accessCount,
      find: accessFind,
    } as unknown as Repository<Access>
    const settingCount = jest.fn()
    const settingFindRecent = jest.fn()
    const settingService = {
      count: settingCount,
      findRecent: settingFindRecent,
      countCreatedByPeriods: jest.fn(),
    } as unknown as WebsiteSettingService
    const service = new DashboardService(
      articleRepository,
      categoryRepository,
      tagRepository,
      userRepository,
      roleRepository,
      accessRepository,
      settingService,
    )

    const overview = await service.getOverview({
      isSuper: false,
      permissions: ['category:list'],
    } as AuthUser)

    expect(overview).toMatchObject({
      metrics: { categories: 4 },
      growth: {
        categories: { current: 0, previous: 0, rate: 0, trend: 'flat' },
      },
      recent: { categories: [] },
    })
    expect(overview.articles).toBeUndefined()
    expect(overview.recent.articles).toBeUndefined()
    expect(tagCount).not.toHaveBeenCalled()
    expect(tagFind).not.toHaveBeenCalled()
    expect(userCount).not.toHaveBeenCalled()
    expect(userFind).not.toHaveBeenCalled()
    expect(roleCount).not.toHaveBeenCalled()
    expect(roleFind).not.toHaveBeenCalled()
    expect(accessCount).not.toHaveBeenCalled()
    expect(accessFind).not.toHaveBeenCalled()
    expect(settingCount).not.toHaveBeenCalled()
    expect(settingFindRecent).not.toHaveBeenCalled()
  })
})
