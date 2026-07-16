# 网站设置前端变更说明

## 概览

网站设置改为存入 MongoDB 的 `website_settings` 集合。每条设置由稳定的 `key` 和任意 JSON `value` 组成，因此新增设置项时无需修改数据库结构或后端实体。

- 后台维护接口均需登录，并分别需要 `setting:list`、`setting:view`、`setting:edit`、`setting:delete` 权限。
- `admin` 超级管理员可直接使用；重新执行 `npm run seed` 会补齐设置菜单和权限资源。
- 只有 `isPublic: true` 的项会由公开接口返回。令牌、第三方密钥等敏感项必须保持 `false`（默认值）。

所有响应沿用项目统一格式：`{ code: 0, message: 'success', data }`。以下示例只展示 `data`。

## 数据类型

```ts
interface WebsiteSetting {
  id: string
  key: string
  value: unknown
  isPublic: boolean
  description: string | null
  createdAt: string
  updatedAt: string
}
```

`key` 长度为 1–100，只能使用字母、数字、冒号、下划线和连字符；推荐用冒号划分命名空间，例如 `site:branding`、`site:footer`、`feature:registration`。

## 管理后台接口

| 用途           | 方法与地址                  | 权限             |
| -------------- | --------------------------- | ---------------- |
| 设置列表       | `GET /api/settings`         | `setting:list`   |
| 单项详情       | `GET /api/settings/:key`    | `setting:view`   |
| 创建或整体更新 | `PUT /api/settings/:key`    | `setting:edit`   |
| 删除           | `DELETE /api/settings/:key` | `setting:delete` |

`PUT` 是幂等接口：键不存在时创建，存在时更新。`value` 必填，可提交对象、数组、字符串、数字或布尔值；其余字段可选，未传字段保持原值。传入 `description: null` 可清空描述。

```http
PUT /api/settings/site:branding
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "value": {
    "name": "示例 CMS",
    "logoUrl": "https://cdn.example.com/logo.svg",
    "faviconUrl": "/uploads/favicon.png"
  },
  "isPublic": true,
  "description": "站点品牌信息"
}
```

对应返回：

```json
{
  "id": "68772d85d5f9c378d2193365",
  "key": "site:branding",
  "value": {
    "name": "示例 CMS",
    "logoUrl": "https://cdn.example.com/logo.svg",
    "faviconUrl": "/uploads/favicon.png"
  },
  "isPublic": true,
  "description": "站点品牌信息",
  "createdAt": "2026-07-16T10:00:00.000Z",
  "updatedAt": "2026-07-16T10:00:00.000Z"
}
```

建议后台使用“设置键 + JSON 编辑器/表单”的通用设置页面。保存时调用单项 `PUT`；删除操作需要二次确认。对于已知的键，可在前端用本地 TypeScript 类型约束其 `value`，但不要将该类型假设为接口层的固定限制。

## 公开读取接口

```http
GET /api/settings/public
```

该接口无需 `Authorization`，适合在网站启动时获取主题、站名、页脚、功能开关等公开配置。`data` 是以设置键为属性名的对象，不包含元数据，也不会包含 `isPublic: false` 的设置。

```json
{
  "site:branding": {
    "name": "示例 CMS",
    "logoUrl": "https://cdn.example.com/logo.svg"
  },
  "feature:registration": true
}
```

推荐在应用初始化时请求一次，并为缺失键准备默认值：

```ts
const response = await api.get('/api/settings/public')
const settings = response.data.data as Record<string, unknown>
const branding = (settings['site:branding'] as
  | { name?: string }
  | undefined) ?? {
  name: 'CMS',
}
```

公开接口可能被 CDN 缓存；若前端加入缓存，请在后台保存成功后刷新本地缓存或重新请求。切勿把管理接口返回的完整设置列表直接用于公开页面。
