# CMS 前端接口开发文档

本文档根据当前后端代码整理，接口基础路径为 `/api`。

## 1. 通用约定

### 1.1 统一响应

成功响应：

```json
{
  "code": 0,
  "message": "success",
  "data": {}
}
```

失败响应：

```json
{
  "code": 400,
  "message": "错误说明",
  "data": null
}
```

- `code = 0` 表示成功。
- 失败时 `code` 通常与 HTTP 状态码一致。
- 删除成功时 `data` 为 `null`。
- 参数校验失败通常返回 HTTP `400`。
- 资源不存在返回 HTTP `404`。
- 名称冲突等资源冲突返回 HTTP `409`。

### 1.2 分页响应

列表接口统一支持：

| 参数       | 类型   | 必填 | 默认值 | 说明                   |
| ---------- | ------ | ---- | ------ | ---------------------- |
| `page`     | number | 否   | `1`    | 页码，最小为 1         |
| `pageSize` | number | 否   | `10`   | 每页数量，范围 1～1000 |

分页数据结构：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "list": [],
    "total": 0,
    "page": 1,
    "pageSize": 10,
    "totalPages": 1
  }
}
```

## 2. 文章管理

### 2.1 文章数据结构

```ts
interface Article {
  id: number
  title: string
  summary: string | null
  content: string
  categoryId: number
  category: Category
  tags: Tag[]
  coverUrl: string | null
  status: number
  publishedAt: string | null
  sort: number
  createdAt: string
  updatedAt: string
}
```

- `content` 为富文本字符串，可以保存包含 `<img>` 的 HTML。
- `coverUrl` 保存封面图片 URL，不接收图片二进制文件。
- `status` 当前约定为 `0` 草稿、`1` 已发布。
- 日期字段使用 ISO 8601 字符串传输。

### 2.2 获取文章列表

```http
GET /api/articles
```

查询参数：

| 参数          | 类型     | 匹配方式 | 说明     |
| ------------- | -------- | -------- | -------- |
| `page`        | number   | -        | 页码     |
| `pageSize`    | number   | -        | 每页数量 |
| `title`       | string   | 模糊匹配 | 标题     |
| `content`     | string   | 模糊匹配 | 正文     |
| `summary`     | string   | 模糊匹配 | 摘要     |
| `coverUrl`    | string   | 精确匹配 | 封面地址 |
| `status`      | number   | 精确匹配 | 发布状态 |
| `publishedAt` | ISO 日期 | 精确匹配 | 发布时间 |
| `sort`        | number   | 精确匹配 | 排序值   |

列表默认按 `sort` 升序排列。

### 2.3 获取文章详情

```http
GET /api/articles/:id
```

成功时 `data` 为 `Article`，不存在时返回 HTTP `404`。

### 2.4 创建文章

```http
POST /api/articles
Content-Type: application/json
```

请求字段：

| 字段          | 类型           | 必填 | 说明                           |
| ------------- | -------------- | ---- | ------------------------------ |
| `title`       | string         | 是   | 文章标题                       |
| `content`     | string         | 是   | 富文本 HTML                    |
| `categoryId`  | number         | 是   | 文章所属分类 ID                |
| `tagIds`      | number[]       | 否   | 文章标签 ID，支持多个          |
| `summary`     | string \| null | 否   | 摘要，空字符串会按未传处理     |
| `coverUrl`    | string \| null | 否   | 封面 URL，空字符串会按未传处理 |
| `status`      | number         | 否   | `0` 草稿，`1` 已发布           |
| `publishedAt` | ISO 日期       | 否   | 发布时间                       |
| `sort`        | number         | 否   | 排序值，默认 100               |

示例：

```json
{
  "title": "CMS 使用指南",
  "summary": "文章摘要",
  "content": "<p>正文内容</p><img src=\"https://example.com/uploads/content.png\" alt=\"正文图片\">",
  "categoryId": 2,
  "tagIds": [1, 2],
  "coverUrl": "https://example.com/uploads/cover.png",
  "status": 1,
  "publishedAt": "2026-07-11T10:00:00.000Z",
  "sort": 100
}
```

### 2.5 更新文章

```http
PUT /api/articles/:id
Content-Type: application/json
```

请求字段与创建接口相同，所有字段均可选。成功时返回更新后的文章。

### 2.6 删除文章

```http
DELETE /api/articles/:id
```

## 3. 标签管理

### 3.1 标签数据结构

```ts
interface Tag {
  id: number
  name: string
  description: string | null
  sort: number
  createdAt: string
  updatedAt: string
}
```

### 3.2 获取标签列表

```http
GET /api/tags
```

查询参数：

| 参数          | 类型   | 匹配方式 | 说明     |
| ------------- | ------ | -------- | -------- |
| `page`        | number | -        | 页码     |
| `pageSize`    | number | -        | 每页数量 |
| `name`        | string | 模糊匹配 | 标签名称 |
| `description` | string | 精确匹配 | 标签描述 |
| `sort`        | number | 精确匹配 | 排序值   |

列表默认按 `sort` 升序排列。

### 3.3 获取标签详情

```http
GET /api/tags/:id
```

### 3.4 创建标签

```http
POST /api/tags
Content-Type: application/json
```

```json
{
  "name": "NestJS",
  "description": "NestJS 相关文章",
  "sort": 100
}
```

| 字段          | 类型           | 必填 | 说明                       |
| ------------- | -------------- | ---- | -------------------------- |
| `name`        | string         | 是   | 标签名称，数据库中不可重复 |
| `description` | string \| null | 否   | 标签描述                   |
| `sort`        | number         | 否   | 排序值，默认 100           |

### 3.5 更新标签

```http
PUT /api/tags/:id
Content-Type: application/json
```

请求字段与创建接口相同，所有字段均可选。

### 3.6 删除标签

```http
DELETE /api/tags/:id
```

## 4. 用户管理

| 方法   | 地址                    | 说明                                |
| ------ | ----------------------- | ----------------------------------- |
| GET    | `/api/users`            | 用户分页列表                        |
| GET    | `/api/users/:id`        | 用户详情，包含 `roles`              |
| POST   | `/api/users`            | 创建用户，可通过 `roleIds` 分配角色 |
| PUT    | `/api/users/:id`        | 更新用户，可通过 `roleIds` 更新角色 |
| PUT    | `/api/users/:id/status` | 切换用户启用状态                    |
| DELETE | `/api/users/:id`        | 删除用户                            |

创建用户示例：

```json
{
  "username": "editor",
  "password": "123456",
  "mobile": "13800138000",
  "email": "editor@example.com",
  "status": 1,
  "isSuper": false,
  "sort": 100,
  "roleIds": [1, 2]
}
```

- `username`、`password`、`status` 必填。
- 密码至少 4 个字符，响应中不会返回密码。
- `mobile`、`email`、`isSuper`、`sort`、`roleIds` 可选。
- `roleIds` 会去重；任一角色不存在时整个请求失败。
- 更新时 `roleIds: []` 表示清空角色，不传表示保持原角色。
- 列表支持 `username`、`mobile`、`email` 模糊查询，以及 `status`、`isSuper` 精确查询。

## 5. 角色管理

| 方法   | 地址             | 说明                                  |
| ------ | ---------------- | ------------------------------------- |
| GET    | `/api/roles`     | 角色分页列表，支持按 `name` 模糊查询  |
| GET    | `/api/roles/:id` | 角色详情，包含 `accesses`             |
| POST   | `/api/roles`     | 创建角色，可通过 `accessIds` 分配资源 |
| PUT    | `/api/roles/:id` | 更新角色及资源                        |
| DELETE | `/api/roles/:id` | 删除角色                              |

创建或更新示例：

```json
{
  "name": "内容管理员",
  "accessIds": [1, 2, 3]
}
```

- `name` 必填，会自动去除首尾空格。
- `accessIds` 可选，资源 ID 会自动去重。
- 创建时未传 `accessIds` 等同于空数组。
- 更新时 `accessIds: []` 表示清空资源，不传表示保持原资源。
- 任一资源不存在时整个请求失败。

## 6. 资源管理

资源类型：

```ts
type AccessType = 'module' | 'menu' | 'feature'
```

| 方法   | 地址                 | 说明                   |
| ------ | -------------------- | ---------------------- |
| GET    | `/api/accesses`      | 资源分页列表           |
| GET    | `/api/accesses/tree` | 获取完整资源树，不分页 |
| GET    | `/api/accesses/:id`  | 获取资源详情           |
| POST   | `/api/accesses`      | 创建资源               |
| PUT    | `/api/accesses/:id`  | 更新资源               |
| DELETE | `/api/accesses/:id`  | 删除资源               |

创建资源示例：

```json
{
  "type": "menu",
  "url": "/content/articles",
  "description": "文章管理",
  "parentId": 1
}
```

- `type` 必填，只能是 `module`、`menu` 或 `feature`。
- `url`、`description`、`parentId` 可选。
- 顶级资源的 `parentId` 为 `null` 或不传。
- 树接口通过 `children` 返回子资源。
- 列表支持按 `type` 精确查询，按 `url`、`description` 模糊查询。

## 7. 图片上传

项目提供 `POST /api/uploads/images` 图片上传接口，支持本地存储和阿里云 OSS。前端上传成功后，将返回的 `data.url` 写入文章 `coverUrl`，或插入富文本正文。

详细配置与调用方式见 [图片上传与存储配置](./image-upload.md)。
