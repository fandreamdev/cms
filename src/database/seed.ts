import { INestApplicationContext } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { getRepositoryToken } from '@nestjs/typeorm'
import { getModelToken } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { DataSource, Repository, TreeRepository } from 'typeorm'
import { AppModule } from '../app.module'
import { Access } from '../shared/entities/access.entity'
import { Article } from '../shared/entities/article.entity'
import { Category } from '../shared/entities/category.entity'
import { Role } from '../shared/entities/role.entity'
import { Tag } from '../shared/entities/tag.entity'
import { User } from '../shared/entities/user.entity'
import { AccessType } from '../shared/enum/access.enum'
import { hashPassword } from '../shared/utils/pwd'
import { WebsiteSetting } from '../shared/schemas/website-setting.schema'

interface AccessSeedNode {
  type: AccessType
  url: string
  description: string
  children?: AccessSeedNode[]
}

interface ArticleSeed {
  title: string
  summary: string
  content: string
  coverUrl: string
  status: number
  publishedAt: Date | null
  sort: number
  tagNames: string[]
  categoryName: string
}

interface CategorySeedNode {
  name: string
  description: string
  sort: number
  children?: CategorySeedNode[]
}

interface WebsiteSettingSeed {
  key: string
  value: unknown
  description: string
  isPublic: boolean
}

const websiteSettings: WebsiteSettingSeed[] = [
  {
    key: 'site:name',
    value: 'CMS',
    description: '网站名称',
    isPublic: true,
  },
  {
    key: 'site:description',
    value: '内容管理系统',
    description: '网站描述',
    isPublic: true,
  },
  {
    key: 'site:contact-email',
    value: 'contact@example.com',
    description: '联系邮箱',
    isPublic: true,
  },
  {
    key: 'weather:location',
    value: { name: '上海', latitude: 31.2304, longitude: 121.4737 },
    description: '后台仪表盘天气位置',
    isPublic: false,
  },
]

const categoryTree: CategorySeedNode[] = [
  {
    name: '技术文章',
    description: '软件开发与工程实践',
    sort: 10,
    children: [
      {
        name: '后端开发',
        description: '服务端框架、数据库与接口开发',
        sort: 10,
      },
      {
        name: '前端开发',
        description: '前端工程、交互与页面实现',
        sort: 20,
      },
    ],
  },
  {
    name: '产品动态',
    description: '产品公告、版本更新与功能预告',
    sort: 20,
  },
  {
    name: '帮助中心',
    description: '系统使用说明与操作指南',
    sort: 30,
  },
]

const tags: Pick<Tag, 'name' | 'description' | 'sort'>[] = [
  { name: 'NestJS', description: 'NestJS 框架与后端开发', sort: 10 },
  { name: 'TypeScript', description: 'TypeScript 开发实践', sort: 20 },
  { name: 'TypeORM', description: 'TypeORM 与数据库开发', sort: 30 },
  { name: '前端开发', description: '前端工程与交互实现', sort: 40 },
  { name: '系统公告', description: 'CMS 系统公告与更新', sort: 50 },
  { name: '使用指南', description: 'CMS 功能使用说明', sort: 60 },
]

const articles: ArticleSeed[] = [
  {
    title: '欢迎使用 CMS 内容管理系统',
    summary: '快速了解 CMS 的文章、标签和权限管理能力。',
    content:
      '<h2>欢迎使用 CMS</h2><p>本系统提供文章、标签、用户、角色与资源管理功能。</p><img src="https://picsum.photos/seed/cms-welcome/1200/600" alt="CMS 欢迎图片"><p>你可以从文章管理开始创建第一篇内容。</p>',
    coverUrl: 'https://picsum.photos/seed/cms-welcome-cover/1200/630',
    status: 1,
    publishedAt: new Date('2026-07-01T08:00:00.000Z'),
    sort: 10,
    tagNames: ['系统公告', '使用指南'],
    categoryName: '产品动态',
  },
  {
    title: 'NestJS 项目结构实践',
    summary: '介绍控制器、服务、DTO 与实体之间的职责划分。',
    content:
      '<h2>清晰的模块边界</h2><p>控制器负责 HTTP 协议，服务负责业务逻辑，实体负责数据模型。</p><pre><code>nest generate module content</code></pre><img src="https://picsum.photos/seed/nest-structure/1200/600" alt="项目结构示意图">',
    coverUrl: 'https://picsum.photos/seed/nest-cover/1200/630',
    status: 1,
    publishedAt: new Date('2026-07-02T08:00:00.000Z'),
    sort: 20,
    tagNames: ['NestJS', 'TypeScript'],
    categoryName: '后端开发',
  },
  {
    title: 'TypeORM 多对多关系配置指南',
    summary: '使用 JoinTable 建立文章与标签的多对多关系。',
    content:
      '<h2>多对多关系</h2><p>文章可以拥有多个标签，一个标签也可以关联多篇文章。</p><img src="https://picsum.photos/seed/typeorm-relation/1200/600" alt="数据库关系图"><p>中间表使用联合主键防止重复关联。</p>',
    coverUrl: 'https://picsum.photos/seed/typeorm-cover/1200/630',
    status: 1,
    publishedAt: new Date('2026-07-03T08:00:00.000Z'),
    sort: 30,
    tagNames: ['TypeORM', 'TypeScript'],
    categoryName: '后端开发',
  },
  {
    title: '富文本文章编辑说明',
    summary: '说明如何在文章正文中插入标题、列表、代码和图片。',
    content:
      '<h2>富文本内容</h2><p>正文以 HTML 字符串保存，可以包含常见排版元素。</p><ul><li>标题与段落</li><li>有序和无序列表</li><li>链接、代码与图片</li></ul><img src="https://picsum.photos/seed/rich-editor/1200/600" alt="富文本编辑器">',
    coverUrl: 'https://picsum.photos/seed/editor-cover/1200/630',
    status: 1,
    publishedAt: new Date('2026-07-04T08:00:00.000Z'),
    sort: 40,
    tagNames: ['前端开发', '使用指南'],
    categoryName: '前端开发',
  },
  {
    title: 'CMS 权限配置入门',
    summary: '通过用户、角色和资源完成后台权限配置。',
    content:
      '<h2>权限模型</h2><p>先创建资源，再将资源分配给角色，最后为用户设置角色。</p><ol><li>维护资源树</li><li>创建角色</li><li>分配用户角色</li></ol>',
    coverUrl: 'https://picsum.photos/seed/permission-cover/1200/630',
    status: 1,
    publishedAt: new Date('2026-07-05T08:00:00.000Z'),
    sort: 50,
    tagNames: ['NestJS', '使用指南'],
    categoryName: '帮助中心',
  },
  {
    title: 'TypeScript DTO 参数校验',
    summary: '使用 class-validator 和 class-transformer 校验并转换请求参数。',
    content:
      '<h2>可靠的请求参数</h2><p>DTO 可以在数据进入业务逻辑之前完成类型转换与约束校验。</p><blockquote>不要依赖前端保证数据有效。</blockquote>',
    coverUrl: 'https://picsum.photos/seed/dto-cover/1200/630',
    status: 1,
    publishedAt: new Date('2026-07-06T08:00:00.000Z'),
    sort: 60,
    tagNames: ['TypeScript', 'NestJS'],
    categoryName: '后端开发',
  },
  {
    title: '文章封面设计建议',
    summary: '为文章选择清晰、统一且适合列表展示的封面。',
    content:
      '<h2>推荐尺寸</h2><p>建议使用接近 1.91:1 的横向图片，并控制文件大小。</p><img src="https://picsum.photos/seed/cover-design/1200/600" alt="封面设计示例">',
    coverUrl: 'https://picsum.photos/seed/design-cover/1200/630',
    status: 0,
    publishedAt: null,
    sort: 70,
    tagNames: ['前端开发'],
    categoryName: '前端开发',
  },
  {
    title: '下一版本功能预告',
    summary: '预告内容管理模块后续计划支持的能力。',
    content:
      '<h2>开发计划</h2><p>后续将持续完善图片上传、文章标签筛选和内容预览体验。</p>',
    coverUrl: 'https://picsum.photos/seed/roadmap-cover/1200/630',
    status: 0,
    publishedAt: null,
    sort: 80,
    tagNames: ['系统公告'],
    categoryName: '产品动态',
  },
]

const roles: Pick<Role, 'name'>[] = [
  { name: '超级管理员' },
  { name: '系统管理员' },
  { name: '运营管理员' },
  { name: '内容管理员' },
  { name: '客服主管' },
  { name: '客服专员' },
  { name: '财务主管' },
  { name: '只读访客' },
]

const userProfiles = [
  ['admin', '13900000001', 'admin@example.com', true],
  ['system_admin', '13900000002', 'system.admin@example.com', false],
  ['ops_manager', '13900000003', 'ops.manager@example.com', false],
  ['content_manager', '13900000004', 'content.manager@example.com', false],
  ['content_editor01', '13900000005', 'content.editor01@example.com', false],
  ['content_editor02', '13900000006', 'content.editor02@example.com', false],
  ['support_lead', '13900000007', 'support.lead@example.com', false],
  ['support_liu', '13900000008', 'support.liu@example.com', false],
  ['support_zhao', '13900000009', 'support.zhao@example.com', false],
  ['finance_manager', '13900000010', 'finance.manager@example.com', false],
  ['finance_ap', '13900000011', 'finance.ap@example.com', false],
  ['finance_ar', '13900000012', 'finance.ar@example.com', false],
  ['analyst_yang', '13900000013', 'analyst.yang@example.com', false],
  ['analyst_xu', '13900000014', 'analyst.xu@example.com', false],
  ['viewer_demo01', '13900000015', 'viewer.demo01@example.com', false],
  ['viewer_demo02', '13900000016', 'viewer.demo02@example.com', false],
  ['disabled_user', '13900000017', 'disabled.user@example.com', false],
] satisfies [string, string, string, boolean][]

function createFeatureNodes(
  resource: string,
  actions: string[],
): AccessSeedNode[] {
  return actions.map((action) => ({
    type: AccessType.FEATURE,
    url: `${resource}:${action}`,
    description: `${resource}:${action}`,
  }))
}

const accessTree: AccessSeedNode[] = [
  {
    type: AccessType.MODULE,
    url: '/admin/system',
    description: '系统模块',
    children: [
      {
        type: AccessType.MENU,
        url: '/admin/system/users',
        description: '用户管理',
        children: createFeatureNodes('user', [
          'list',
          'create',
          'view',
          'edit',
          'delete',
        ]),
      },
      {
        type: AccessType.MENU,
        url: '/admin/system/roles',
        description: '角色管理',
        children: createFeatureNodes('role', [
          'list',
          'create',
          'view',
          'edit',
          'delete',
        ]),
      },
      {
        type: AccessType.MENU,
        url: '/admin/system/accesses',
        description: '菜单管理',
        children: createFeatureNodes('access', [
          'list',
          'create',
          'view',
          'edit',
          'delete',
        ]),
      },
      {
        type: AccessType.MENU,
        url: '/admin/system/settings',
        description: '网站设置',
        children: createFeatureNodes('setting', [
          'list',
          'view',
          'edit',
          'delete',
        ]),
      },
      {
        type: AccessType.MENU,
        url: '/admin/system/status',
        description: '系统状态',
        children: [
          {
            type: AccessType.FEATURE,
            url: 'system:monitor',
            description: '系统监控',
          },
        ],
      },
    ],
  },
  {
    type: AccessType.MODULE,
    url: '/admin/content',
    description: '内容模块',
    children: [
      {
        type: AccessType.MENU,
        url: '/admin/content/articles',
        description: '文章管理',
        children: createFeatureNodes('article', [
          'list',
          'create',
          'view',
          'edit',
          'delete',
          'submit',
          'withdraw',
          'status',
        ]),
      },
      {
        type: AccessType.MENU,
        url: '/admin/content/categories',
        description: '分类管理',
        children: createFeatureNodes('category', [
          'list',
          'create',
          'view',
          'edit',
          'delete',
        ]),
      },
      {
        type: AccessType.MENU,
        url: '/admin/content/tags',
        description: '标签管理',
        children: createFeatureNodes('tag', [
          'list',
          'create',
          'view',
          'edit',
          'delete',
        ]),
      },
    ],
  },
  {
    type: AccessType.MODULE,
    url: '/admin/reviews',
    description: '审核模块',
    children: [
      {
        type: AccessType.MENU,
        url: '/admin/reviews/articles',
        description: '文章审核',
        children: createFeatureNodes('article', ['review:list', 'approve']),
      },
    ],
  },
]

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    bufferLogs: true,
  })

  try {
    await seed(app)
  } finally {
    await closeApplication(app)
  }
}

async function closeApplication(app: INestApplicationContext): Promise<void> {
  await Promise.race([
    app.close(),
    new Promise<void>((resolve) => setTimeout(resolve, 1000)),
  ])
}

async function seed(app: INestApplicationContext): Promise<void> {
  const dataSource = app.get(DataSource)
  const userRepository = app.get<Repository<User>>(getRepositoryToken(User))
  const roleRepository = app.get<Repository<Role>>(getRepositoryToken(Role))
  const accessRepository = app.get<TreeRepository<Access>>(
    getRepositoryToken(Access),
  )
  const articleRepository = app.get<Repository<Article>>(
    getRepositoryToken(Article),
  )
  const tagRepository = app.get<Repository<Tag>>(getRepositoryToken(Tag))
  const categoryRepository = app.get<TreeRepository<Category>>(
    getRepositoryToken(Category),
  )
  const settingModel = app.get<Model<WebsiteSetting>>(
    getModelToken(WebsiteSetting.name),
  )

  if (process.argv.includes('--reset')) {
    await resetTables(dataSource, ['roles', 'users'])
    await resetTables(dataSource, [
      'article_tags',
      'articles',
      'tags',
      'categories',
    ])
  }
  const password = await hashPassword('Test@123456')
  const savedRoles = await saveRoles(roleRepository)
  const savedUsers = await saveUsers(userRepository, password)
  const savedAccesses = await saveAccessTree(accessRepository, accessTree)
  await assignContentReviewer(
    roleRepository,
    userRepository,
    savedRoles,
    savedUsers,
    savedAccesses,
  )
  await assignSystemMonitor(
    roleRepository,
    userRepository,
    savedRoles,
    savedUsers,
    savedAccesses,
  )
  const savedTags = await saveTags(tagRepository)
  const savedCategories = await saveCategoryTree(
    categoryRepository,
    categoryTree,
  )
  const savedArticles = await saveArticles(
    articleRepository,
    savedTags,
    savedCategories,
    savedUsers,
  )
  const savedSettings = await saveWebsiteSettings(settingModel)

  console.log(
    [
      'Seed completed.',
      `Roles: ${savedRoles.length}`,
      `Users: ${savedUsers.length}`,
      `Accesses: ${savedAccesses.length}`,
      `Tags: ${savedTags.length}`,
      `Categories: ${savedCategories.length}`,
      `Articles: ${savedArticles.length}`,
      `Website settings: ${savedSettings}`,
      'Default password: Test@123456',
      process.argv.includes('--reset') ? 'Mode: reset' : 'Mode: upsert',
    ].join('\n'),
  )
}

async function saveWebsiteSettings(
  settingModel: Model<WebsiteSetting>,
): Promise<number> {
  await Promise.all(
    websiteSettings.map((setting) =>
      settingModel
        .findOneAndUpdate(
          { key: setting.key },
          {
            $set: {
              value: setting.value,
              isPublic: setting.isPublic,
              description: setting.description,
            },
          },
          { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
        )
        .exec(),
    ),
  )
  return websiteSettings.length
}

async function assignContentReviewer(
  roleRepository: Repository<Role>,
  userRepository: Repository<User>,
  savedRoles: Role[],
  savedUsers: User[],
  savedAccesses: Access[],
): Promise<void> {
  const role = savedRoles.find((item) => item.name === '内容管理员')
  const user = savedUsers.find((item) => item.username === 'content_manager')
  if (!role || !user) throw new Error('Content reviewer seed data not found')

  role.accesses = savedAccesses.filter((access) =>
    [
      '/admin/reviews',
      '/admin/reviews/articles',
      'article:list',
      'article:view',
      'article:review:list',
      'article:approve',
      'article:status',
    ].includes(access.url),
  )
  await roleRepository.save(role)

  user.roles = [role]
  await userRepository.save(user)
}

async function assignSystemMonitor(
  roleRepository: Repository<Role>,
  userRepository: Repository<User>,
  savedRoles: Role[],
  savedUsers: User[],
  savedAccesses: Access[],
): Promise<void> {
  const savedRole = savedRoles.find((item) => item.name === '运维管理员')
  const savedUser = savedUsers.find((item) => item.username === 'ops_manager')
  const access = savedAccesses.find((item) => item.url === 'system:monitor')
  if (!savedRole || !savedUser || !access) {
    throw new Error('System monitor seed data not found')
  }

  const role = await roleRepository.findOne({
    where: { id: savedRole.id },
    relations: { accesses: true },
  })
  const user = await userRepository.findOne({
    where: { id: savedUser.id },
    relations: { roles: true },
  })
  if (!role || !user) throw new Error('System monitor seed data not found')

  const accessIds = new Set(role.accesses.map((item) => item.id))
  if (!accessIds.has(access.id)) role.accesses = [...role.accesses, access]
  await roleRepository.save(role)

  const roleIds = new Set(user.roles.map((item) => item.id))
  if (!roleIds.has(role.id)) user.roles = [...user.roles, role]
  await userRepository.save(user)
}

async function saveTags(repository: Repository<Tag>): Promise<Tag[]> {
  const saved: Tag[] = []

  for (const payload of tags) {
    const existing = await repository.findOne({
      where: { name: payload.name },
    })
    saved.push(
      await repository.save(
        existing ? repository.merge(existing, payload) : payload,
      ),
    )
  }

  return saved
}

async function saveArticles(
  repository: Repository<Article>,
  savedTags: Tag[],
  savedCategories: Category[],
  savedUsers: User[],
): Promise<Article[]> {
  const saved: Article[] = []
  const tagMap = new Map(savedTags.map((tag) => [tag.name, tag]))
  const categoryMap = new Map(
    savedCategories.map((category) => [category.name, category]),
  )
  const author = savedUsers.find((user) => user.username === 'admin')
  if (!author) throw new Error('Seed admin user not found')

  for (const { tagNames, categoryName, ...payload } of articles) {
    const existing = await repository.findOne({
      where: { title: payload.title },
      relations: { tags: true },
    })
    const articleTags = tagNames.map((name) => {
      const tag = tagMap.get(name)
      if (!tag) throw new Error(`Seed tag not found: ${name}`)
      return tag
    })
    const category = categoryMap.get(categoryName)
    if (!category) throw new Error(`Seed category not found: ${categoryName}`)
    const article = existing
      ? repository.merge(existing, payload, {
          tags: articleTags,
          category,
          author,
        })
      : repository.create({ ...payload, tags: articleTags, category, author })
    saved.push(await repository.save(article))
  }

  return saved
}

async function saveCategoryTree(
  repository: TreeRepository<Category>,
  nodes: CategorySeedNode[],
  parent?: Category,
): Promise<Category[]> {
  const saved: Category[] = []

  for (const node of nodes) {
    const existing = await repository.findOne({ where: { name: node.name } })
    const current = await repository.save(
      existing
        ? repository.merge(existing, {
            description: node.description,
            sort: node.sort,
            parent: parent ?? null,
          })
        : repository.create({
            name: node.name,
            description: node.description,
            sort: node.sort,
            parent: parent ?? null,
          }),
    )
    saved.push(current)

    if (node.children?.length) {
      saved.push(
        ...(await saveCategoryTree(repository, node.children, current)),
      )
    }
  }

  return saved
}

async function saveRoles(repository: Repository<Role>): Promise<Role[]> {
  const saved: Role[] = []

  for (const role of roles) {
    const existing = await repository.findOne({ where: { name: role.name } })
    saved.push(existing ?? (await repository.save(role)))
  }

  return saved
}

async function saveUsers(
  repository: Repository<User>,
  password: string,
): Promise<User[]> {
  const saved: User[] = []

  for (const [username, mobile, email, isSuper] of userProfiles) {
    const payload = {
      username,
      mobile,
      email,
      password,
      isSuper,
      status: username === 'disabled_user' ? 0 : 1,
      sort: (saved.length + 1) * 10,
    }
    const existing = await repository.findOne({
      where: [{ username }, { mobile }, { email }],
    })
    saved.push(
      await repository.save(
        existing ? repository.merge(existing, payload) : payload,
      ),
    )
  }

  return saved
}

async function resetTables(
  dataSource: DataSource,
  tableNames: string[],
): Promise<void> {
  const type = String(dataSource.options.type)
  const isMysql = type === 'mysql' || type === 'mariadb'

  if (isMysql) {
    await dataSource.query('SET FOREIGN_KEY_CHECKS = 0')
  }

  for (const tableName of tableNames) {
    if (isMysql) {
      await dataSource.query(`TRUNCATE TABLE \`${tableName}\``)
    } else {
      await dataSource.query(`DELETE FROM "${tableName}"`)
    }
  }

  if (isMysql) {
    await dataSource.query('SET FOREIGN_KEY_CHECKS = 1')
  }
}

async function saveAccessTree(
  repository: TreeRepository<Access>,
  nodes: AccessSeedNode[],
  parent?: Access,
): Promise<Access[]> {
  const saved: Access[] = []

  for (const node of nodes) {
    const existing = await repository.findOne({ where: { url: node.url } })
    const values = {
      type: node.type,
      url: node.url,
      description: node.description,
      parent: parent ?? null,
    }
    const current = await repository.save(
      existing ? repository.merge(existing, values) : repository.create(values),
    )
    saved.push(current)

    if (node.children?.length) {
      saved.push(...(await saveAccessTree(repository, node.children, current)))
    }
  }

  return saved
}

bootstrap()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
