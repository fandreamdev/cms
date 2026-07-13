# 登录认证与文章审批前端变更文档

## 1. 变更范围

本次前端需要完成：

1. 新增登录页面和当前用户状态管理。
2. 所有后台 API 请求携带 accessToken，并使用 refreshToken 自动续期。
3. 统一处理 HTTP 401 和 403。
4. 文章列表新增审批状态、作者、审核员和拒绝理由展示。
5. 根据文章状态、当前用户和权限控制操作按钮。
6. 接入提交、通过、拒绝、撤回和上下架接口。

当前阶段没有发布表和公开文章页面。审核通过与撤回只改变后台文章状态。

## 2. 环境和认证约定

除以下接口外，所有 API 默认需要登录：

```text
POST /api/auth/login
POST /api/auth/refresh
GET  /
```

认证请求头：

```http
Authorization: Bearer <accessToken>
```

### 2.1 登录

```http
POST /api/auth/login
Content-Type: application/json
```

```json
{
  "username": "admin",
  "password": "Test@123456"
}
```

成功响应：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "accessToken": "JWT",
    "refreshToken": "JWT",
    "user": {
      "id": 1,
      "username": "admin",
      "isSuper": true,
      "permissions": []
    }
  }
}
```

### 2.2 获取当前用户

```http
GET /api/auth/me
```

页面刷新后，如果本地存在 Token，应调用该接口恢复用户信息并验证 Token 是否仍有效。
accessToken 过期时使用刷新接口轮换两个 Token，详细实现见
`docs/dual-token-frontend-changes.md`。

### 2.3 前端用户类型

```ts
interface CurrentUser {
  id: number
  username: string
  mobile: string | null
  email: string | null
  status: number
  isSuper: boolean
  roles: Role[]
  permissions: string[]
}
```

权限判断：

```ts
function hasPermission(user: CurrentUser, permission: string): boolean {
  return user.isSuper || user.permissions.includes(permission)
}
```

### 2.4 请求拦截器

```ts
http.interceptors.request.use((config) => {
  const token = authStore.accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})
```

响应处理：

- HTTP `401`：accessToken 失效时先尝试刷新；刷新失败后清除登录信息并跳转登录页。
- HTTP `403`：保留登录状态，提示“没有访问权限”。
- HTTP `409`：提示当前文章状态已变化，并刷新文章数据。

## 3. 登录态管理

建议认证状态至少保存：

```ts
interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: CurrentUser | null
  initialized: boolean
}
```

推荐启动流程：

1. 读取已保存的 Token。
2. 没有 Token 时进入登录页。
3. 有 Token 时请求 `GET /api/auth/me`。
4. 请求成功后恢复用户状态。
5. 请求返回 401 时清除 Token 并进入登录页。

## 4. 文章类型变更

```ts
type ArticleApprovalStatus =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'withdrawn'

interface Article {
  id: number
  title: string
  summary: string | null
  content: string
  coverUrl: string | null

  status: 0 | 1
  sort: number

  approvalStatus: ArticleApprovalStatus
  rejectionReason: string | null
  submittedAt: string | null
  reviewedAt: string | null
  publishedAt: string | null

  authorId: number | null
  author: User | null
  reviewerId: number | null
  reviewer: User | null

  categoryId: number
  category: Category
  tags: Tag[]

  createdAt: string
  updatedAt: string
}
```

存量文章可能暂时没有作者，因此前端需要兼容：

```ts
article.author?.username ?? '-'
```

新创建文章一定由后端绑定当前登录用户，前端不能提交 `authorId`。

## 5. 审批状态显示

| 值          | 中文       | 建议颜色   |
| ----------- | ---------- | ---------- |
| `draft`     | 草稿       | 灰色       |
| `pending`   | 审批中     | 蓝色或橙色 |
| `approved`  | 审核通过   | 绿色       |
| `rejected`  | 审核不通过 | 红色       |
| `withdrawn` | 已撤回     | 深灰色     |

状态映射：

```ts
const approvalStatusMap = {
  draft: { text: '草稿', color: 'default' },
  pending: { text: '审批中', color: 'processing' },
  approved: { text: '审核通过', color: 'success' },
  rejected: { text: '审核不通过', color: 'error' },
  withdrawn: { text: '已撤回', color: 'default' },
} as const
```

## 6. 文章列表变更

### 6.1 新增列

建议增加：

- 审批状态 `approvalStatus`
- 作者 `author.username`
- 审核员 `reviewer.username`
- 提交时间 `submittedAt`
- 审核时间 `reviewedAt`
- 有效状态 `status`

审核不通过时，可以在状态列或详情抽屉中显示 `rejectionReason`。

### 6.2 审批状态筛选

```http
GET /api/articles?approvalStatus=pending&page=1&pageSize=10
```

查询值必须使用英文枚举值，不能提交中文文本。

### 6.3 待审核列表

审核员页面可以复用文章列表：

```http
GET /api/articles?approvalStatus=pending
```

无需单独维护另一套待审核列表接口。

## 7. 操作按钮规则

```ts
const isAuthor = article.authorId === currentUser.id
const canApprove = hasPermission(currentUser, 'article:approve')
const canChangeStatus = hasPermission(currentUser, 'article:status')
```

| 状态        | 作者可编辑 | 作者可提交 | 作者可撤回 | 审核员可通过/拒绝 |
| ----------- | ---------- | ---------- | ---------- | ----------------- |
| `draft`     | 是         | 是         | 否         | 否                |
| `pending`   | 否         | 否         | 是         | 是                |
| `approved`  | 是         | 是         | 否         | 否                |
| `rejected`  | 是         | 是         | 否         | 否                |
| `withdrawn` | 否         | 否         | 否         | 否                |

补充规则：

- 审核按钮还要求 `article:approve` 权限。
- 上下架按钮要求 `article:status` 权限。
- 超级管理员拥有全部权限。
- 后端始终进行最终权限校验，前端隐藏按钮只用于交互优化。

## 8. 创建文章

```http
POST /api/articles
```

请求字段保持原有结构，但不再提交：

```text
authorId
approvalStatus
rejectionReason
reviewerId
publishedAt
```

创建成功后：

```text
approvalStatus = draft
authorId = 当前登录用户 ID
```

## 9. 编辑文章

```http
PUT /api/articles/:id
```

前端不通过该接口修改 `status`，上下架使用独立接口。

保存行为：

- 编辑草稿：保存后仍为 `draft`。
- 编辑审核通过文章：保存后直接变为 `pending`。
- 编辑审核不通过文章：保存后直接变为 `pending`。
- `pending`、`withdrawn` 状态不允许进入编辑页。

对于 `approved` 和 `rejected`，提交按钮建议显示“提交审核”，不要显示“保存草稿”。

## 10. 提交审批

```http
POST /api/articles/:id/submit
```

仅作者可操作。成功后刷新文章：

```text
approvalStatus = pending
submittedAt = 当前时间
rejectionReason = null
```

建议提交前弹出确认框：

```text
提交后文章将进入审批中，审批完成或撤回前不能继续编辑。
```

## 11. 审核通过

```http
POST /api/articles/:id/approve
```

要求当前用户拥有 `article:approve` 权限。

当前阶段成功后：

```text
approvalStatus = approved
reviewer = 当前用户
reviewedAt = 当前时间
publishedAt = 当前时间
```

暂时没有发布表和公开文章页面。

## 12. 审核拒绝

```http
POST /api/articles/:id/reject
Content-Type: application/json
```

```json
{
  "reason": "文章中的数据来源不明确，请补充引用。"
}
```

前端校验：

- 必填。
- 去除首尾空格后不能为空。
- 最大 500 字符。

成功后状态变为 `rejected`，作者可以重新编辑；编辑保存后直接进入下一轮审批。

## 13. 撤回审批

```http
POST /api/articles/:id/withdraw
```

仅作者可以撤回 `pending` 文章。

成功后状态变为 `withdrawn`。根据当前业务规则，已撤回文章不能继续编辑或再次提交。

建议确认文案：

```text
撤回后文章将变为已撤回状态，不能继续编辑或重新提交，是否继续？
```

## 14. 上下架

```http
PUT /api/articles/:id/status
Content-Type: application/json
```

```json
{
  "status": 0
}
```

- `0`：失效/下架。
- `1`：有效。
- 需要 `article:status` 权限。
- 不影响 `approvalStatus`。

## 15. 错误处理

| HTTP 状态 | 场景                           | 前端行为                 |
| --------- | ------------------------------ | ------------------------ |
| 400       | 参数格式错误、拒绝理由为空     | 显示接口消息             |
| 401       | 未登录、Token 过期、用户已停用 | 清除登录态并跳转登录页   |
| 403       | 不是作者或缺少权限             | 提示没有权限             |
| 404       | 文章、分类或标签不存在         | 提示数据不存在并返回列表 |
| 409       | 当前状态不允许操作             | 提示状态已变化并刷新数据 |

## 16. 联调账号

执行种子脚本后可以使用：

| 用户名            | 密码          | 用途                             |
| ----------------- | ------------- | -------------------------------- |
| `admin`           | `Test@123456` | 超级管理员、文章作者             |
| `content_manager` | `Test@123456` | 内容管理员，拥有审核和上下架权限 |

## 17. 前端改造验收清单

- [ ] 登录成功后保存 Token 和当前用户。
- [ ] 后台请求自动携带 Bearer Token。
- [ ] 页面刷新后通过 `/api/auth/me` 恢复用户。
- [ ] 401 自动退出登录，403 正确提示。
- [ ] 文章列表展示审批状态、作者和审核员。
- [ ] 支持按审批状态筛选。
- [ ] 按作者、状态和权限正确控制按钮。
- [ ] 草稿可以保存和提交。
- [ ] 审批中的文章不能编辑。
- [ ] 审核员可以通过或拒绝。
- [ ] 拒绝理由可以显示和重新编辑。
- [ ] 作者可以撤回审批中的文章。
- [ ] 已撤回文章不能继续编辑。
- [ ] 上下架不改变审批状态。
