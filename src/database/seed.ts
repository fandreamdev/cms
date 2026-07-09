import { INestApplicationContext } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { getRepositoryToken } from '@nestjs/typeorm'
import { DataSource, Repository, TreeRepository } from 'typeorm'
import { AppModule } from '../app.module'
import { Access } from '../shared/entities/access.entity'
import { Role } from '../shared/entities/role.entity'
import { User } from '../shared/entities/user.entity'
import { AccessType } from '../shared/enum/access.enum'
import { hashPassword } from '../shared/utils/pwd'

interface AccessSeedNode {
  type: AccessType
  url: string
  description: string
  children?: AccessSeedNode[]
}

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

const accessTree: AccessSeedNode[] = [
  {
    type: AccessType.MODULE,
    url: '/system',
    description: '系统模块',
    children: [
      {
        type: AccessType.MENU,
        url: '/system/users',
        description: '用户管理',
      },
      {
        type: AccessType.MENU,
        url: '/system/roles',
        description: '角色管理',
      },
      {
        type: AccessType.MENU,
        url: '/system/accesses',
        description: '菜单管理',
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

  if (process.argv.includes('--reset')) {
    await resetTables(dataSource, ['roles', 'users'])
  }
  await resetTables(dataSource, ['accesses'])

  const password = await hashPassword('Test@123456')
  const savedRoles = await saveRoles(roleRepository)
  const savedUsers = await saveUsers(userRepository, password)
  const savedAccesses = await saveAccessTree(accessRepository, accessTree)

  console.log(
    [
      'Seed completed.',
      `Roles: ${savedRoles.length}`,
      `Users: ${savedUsers.length}`,
      `Accesses: ${savedAccesses.length}`,
      'Default password: Test@123456',
      process.argv.includes('--reset') ? 'Mode: reset' : 'Mode: upsert',
    ].join('\n'),
  )
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
    const current = await repository.save(
      repository.create({
        type: node.type,
        url: node.url,
        description: node.description,
        ...(parent ? { parent } : {}),
      }),
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
