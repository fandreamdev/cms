# Home 仪表盘聚合接口

Home 页面使用一次受权限保护的聚合请求，替代文章、分类、标签、用户、角色、权限资源和网站设置的多个统计请求。

```http
GET /api/dashboard/overview
Authorization: Bearer <accessToken>
```

成功响应沿用 `{ code, message, data }`。`data` 中的 `metrics` 和 `recent` 子字段会按当前用户的列表权限裁剪；无权限时字段不存在，而非 `0` 或空数组。有权限但没有数据时，`recent` 对应字段为 `[]`。

`growth` 始终包含两个 UTC 连续 7 天区间的边界；其中各模块增长字段也会按同一列表权限裁剪。

```ts
interface DashboardOverview {
  generatedAt: string
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
    currentFrom: string
    currentTo: string
    previousFrom: string
    articles?: GrowthMetric
    categories?: GrowthMetric
    tags?: GrowthMetric
    users?: GrowthMetric
    roles?: GrowthMetric
    accesses?: GrowthMetric
    settings?: GrowthMetric
  }
  articles?: {
    approval: Record<
      'draft' | 'pending' | 'approved' | 'rejected' | 'withdrawn',
      number
    >
    publication: { offline: number; online: number }
  }
  recent: {
    articles?: Array<{
      id: number
      title: string
      approvalStatus:
        | 'draft'
        | 'pending'
        | 'approved'
        | 'rejected'
        | 'withdrawn'
      category: { id: number; name: string } | null
      updatedAt: string
    }>
    categories?: Array<{
      id: number
      name: string
      description: string | null
      updatedAt: string
    }>
    tags?: Array<{
      id: number
      name: string
      description: string | null
      updatedAt: string
    }>
    users?: Array<{
      id: number
      username: string
      status: 0 | 1
      updatedAt: string
    }>
    roles?: Array<{ id: number; name: string; updatedAt: string }>
    accesses?: Array<{
      id: number
      type: 'module' | 'menu' | 'feature'
      url: string
      description: string
      updatedAt: string
    }>
    settings?: Array<{
      key: string
      isPublic: boolean
      description: string | null
      updatedAt: string
    }>
  }
}

interface GrowthMetric {
  current: number
  previous: number
  rate: number | null
  trend: 'up' | 'down' | 'flat'
}
```

每个最新数据列表最多 5 条，按 `updatedAt DESC` 排序；数字 ID 表在同一时间下按 `id DESC`，设置按 `key ASC`。`recent.settings` 绝不返回设置 `value`。

| 字段                                              | 所需权限        |
| ------------------------------------------------- | --------------- |
| `metrics.articles`、`articles`、`recent.articles` | `article:list`  |
| `metrics.categories`、`recent.categories`         | `category:list` |
| `metrics.tags`、`recent.tags`                     | `tag:list`      |
| `metrics.users`、`recent.users`                   | `user:list`     |
| `metrics.roles`、`recent.roles`                   | `role:list`     |
| `metrics.accesses`、`recent.accesses`             | `access:list`   |
| `metrics.settings`、`recent.settings`             | `setting:list`  |

`growth.<module>` 使用相同的模块列表权限。它表示新增记录数的变化而不是总数变化：当前区间为 `[currentFrom, currentTo)`，上一周期为 `[previousFrom, currentFrom)`。`rate` 保留一位小数；上一周期为 0 且本期新增大于 0 时为 `null`，此时请展示“本期新增 N”，不要显示无穷大。

接口返回 `Cache-Control: private, max-age=30`，不能存入共享 CDN 缓存。网站名称、描述与联系邮箱仍从 `GET /api/settings/public` 获取；种子数据提供 `site:name`、`site:description`、`site:contact-email` 三项公开设置。

## 列表排序

以下既有列表接口新增可选排序参数，以保持前端回退请求的排序口径：

```http
GET /api/articles?orderBy=updatedAt&order=desc
GET /api/tags?orderBy=updatedAt&order=desc
GET /api/users?orderBy=updatedAt&order=desc
GET /api/roles?orderBy=updatedAt&order=desc
```

`orderBy` 仅接受 `updatedAt`，`order` 仅接受 `asc` 或 `desc`；非法参数会由 DTO 校验返回 HTTP 400。快捷操作继续使用 `/api/auth/me` 的 `permissions` 与 `isSuper`；文章审核入口对应 `article:review:list`。

同四个列表接口还支持用于回退统计的创建时间半开区间：

```http
GET /api/articles?page=1&pageSize=1&createdFrom=2026-07-11T00:00:00.000Z&createdTo=2026-07-18T00:00:00.000Z
```

`createdFrom` 与 `createdTo` 必须是 ISO 8601 时间，且 `createdFrom < createdTo`；查询条件为 `createdAt >= createdFrom AND createdAt < createdTo`。

## 天气

```http
GET /api/dashboard/weather
Authorization: Bearer <accessToken>
```

天气接口只要求登录，不需要额外权限；它与 `/api/dashboard/overview` 独立，天气服务故障不会影响其他仪表盘统计。响应数据：

```ts
interface DashboardWeather {
  location: { name: string; region?: string | null; country?: string | null }
  current: {
    conditionCode: number // WMO code
    conditionText: string // 中文天气描述
    temperature: number // 摄氏度
    feelsLike: number // 摄氏度
    humidity: number // 0–100
    windSpeed: number // km/h
    windDirection?: string | null
    observedAt: string
  }
  forecast?: { high: number; low: number } | null
}
```

后端使用私有 `weather:location` 网站设置（`name`、`latitude`、`longitude`）；缺失时使用 `WEATHER_DEFAULT_*` 环境变量。不要由浏览器传入经纬度。响应会携带 `X-Weather-Cache: HIT|MISS|STALE`，正常缓存为 15 分钟；外部服务失败时如存在旧缓存会返回陈旧缓存。无缓存且超时时返回 503，供应商无效响应返回 502，位置配置不合法返回 500。

## 服务器状态

```http
GET /api/dashboard/system
Authorization: Bearer <accessToken>
```

该接口要求 `system:monitor`；超级管理员通过 `isSuper` 放行。它只用于页面首屏快照，返回最近一次已完成采样；请勿用 HTTP 轮询。

实时更新流程：先调用：

```http
POST /api/dashboard/system/socket-ticket
Authorization: Bearer <accessToken>
```

该请求返回一次性、30 秒有效的 `ticket` 和 `expiresAt`。随后建立：

```text
WS(S) /api/dashboard/system/stream?ticket=<ticket>
```

票据只能使用一次，权限变更、票据过期或权限被撤销时连接会被拒绝或关闭。生产环境必须使用 `wss://`。服务端每 3 秒推送一次：

```ts
{ type: 'system.status', sequence: number, data: DashboardSystemStatus }
```

客户端应在收到 `{ type: 'ping' }` 后回复 `{ type: 'pong', timestamp }`；断线时按 1、2、4、8、15 秒上限重连，并重新申请票据。

接口返回全部业务磁盘分区、有效网卡、逐核心 CPU、内存、Node 进程及最近最多 60 个采样点：

```ts
interface DashboardSystemStatus {
  status: 'healthy' | 'warning' | 'critical'
  sampledAt: string
  instance: {
    id: string
    hostname: string
    platform: string
    arch: string
    release: string
    uptime: number
    virtualization?: string | null
    containerized?: boolean
  }
  cpu: {
    usage: number
    cores: number
    physicalCores?: number | null
    model: string
    speedMHz?: number | null
    temperature?: number | null
    loadAverage: [number, number, number]
    perCore: Array<{ index: number; usage: number; speedMHz?: number | null; temperature?: number | null }>
  }
  memory: {
    total: number; used: number; available: number; free: number
    active?: number | null; cached?: number | null; buffers?: number | null
    usage: number
    swap: { total: number; used: number; free: number; usage: number }
  }
  disks: Array<{
    device: string
    mount: string
    filesystem?: string | null
    type?: string | null
    total: number
    used: number
    available: number
    usage: number
    readPerSecond?: number | null
    writePerSecond?: number | null
    readIops?: number | null
    writeIops?: number | null
  }>
  network: {
    inboundPerSecond: number
    outboundPerSecond: number
    totalReceived?: number | null
    totalSent?: number | null
    interfaces: Array<{
      name: string
      state: 'up' | 'down' | 'unknown'
      type?: string | null
      speedMbps?: number | null
      inboundPerSecond: number
      outboundPerSecond: number
      totalReceived?: number | null
      totalSent?: number | null
    }>
  }
  process: {
    uptime: number
    cpuUsage: number
    rss: number
    heapUsed: number
    heapTotal: number
    external: number
    arrayBuffers: number
    nodeVersion: string
    activeHandles?: number | null
    activeRequests?: number | null
    eventLoopLag?: number | null
  }
  history: Array<{
    sampledAt: string
    cpuUsage: number
    memoryUsage: number
    inboundPerSecond: number
    outboundPerSecond: number
    diskReadPerSecond?: number | null
    diskWritePerSecond?: number | null
  }>
}
```

数值均为有限数字：使用率为 0–100，内存/磁盘/网络累计量为字节，网络速率为字节/秒，时长为秒。后端不返回环境变量、连接串、密钥、启动参数、IP 地址、MAC 地址或内部网络拓扑。监控采样默认每 3 秒一次，配置可通过 `SYSTEM_MONITOR_*` 环境变量调整阈值、历史长度和每用户连接数。

文章审核页面可使用受 `article:review:list` 保护的列表接口：

```http
GET /api/articles/review?page=1&pageSize=10
```
