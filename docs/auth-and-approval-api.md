# 登录认证与文章审批接口

双 Token 的完整设计与安全注意事项见
[`dual-token-auth-design.md`](./dual-token-auth-design.md)。

## 1. JWT 配置

服务启动前必须配置：

```env
JWT_SECRET=至少32位随机字符串
JWT_EXPIRES_IN=7200
JWT_ACCESS_SECRET=accessToken专用的至少32位随机字符串
JWT_ACCESS_EXPIRES_IN=900
JWT_REFRESH_SECRET=refreshToken专用的至少32位随机字符串
JWT_REFRESH_EXPIRES_IN=604800
```

新配置未提供时会兼容旧的 `JWT_SECRET` 和 `JWT_EXPIRES_IN`。生产环境推荐使用两个
不同的专用密钥。除登录、刷新接口和根路径外，API 默认要求 accessToken。

## 2. 登录

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

响应：

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
      "permissions": []
    }
  }
}
```

后续请求携带：

```http
Authorization: Bearer <accessToken>
```

刷新 Token：

```http
POST /api/auth/refresh
Content-Type: application/json
```

```json
{
  "refreshToken": "JWT"
}
```

刷新成功会返回新的一对 Token 和最新用户权限；旧 Token 应由客户端立即替换。

获取当前用户：

```http
GET /api/auth/me
```

## 3. 权限

- 超级管理员自动拥有全部权限。
- 普通用户权限来自其角色关联资源的 `url`。
- 文章审核权限：`article:approve`。
- 文章上下架权限：`article:status`。
- 种子数据中的“内容管理员”角色拥有上述权限。

## 4. 文章审批状态

```ts
type ArticleApprovalStatus =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'withdrawn'
```

文章列表支持：

```http
GET /api/articles?approvalStatus=pending
```

## 5. 创建和编辑

创建文章时，后端自动将当前登录用户设置为作者，审批状态默认为 `draft`。

编辑规则：

- `draft`：保存后仍为草稿。
- `approved`、`rejected`：保存后直接进入 `pending`。
- `pending`、`withdrawn`：禁止编辑，返回 HTTP 409。
- 只有作者可以编辑文章。

## 6. 提交审批

```http
POST /api/articles/:id/submit
```

只有作者可以提交。允许从 `draft`、`approved` 或 `rejected` 进入 `pending`。

## 7. 审核通过

```http
POST /api/articles/:id/approve
```

要求 `article:approve` 权限。当前阶段尚未创建发布表，接口会：

1. 将审批状态改为 `approved`。
2. 设置审核员、审核时间和发布时间。
3. 输出日志 `文章[标题]已发布`。

## 8. 审核拒绝

```http
POST /api/articles/:id/reject
Content-Type: application/json
```

```json
{
  "reason": "内容中的数据来源不明确"
}
```

要求 `article:approve` 权限，拒绝理由长度为 1～500 字符。

## 9. 撤回

```http
POST /api/articles/:id/withdraw
```

只有作者可以撤回审批中的文章。当前阶段尚未创建发布表，接口会：

1. 将审批状态改为 `withdrawn`。
2. 输出日志 `文章[标题]已撤回`。

## 10. 上下架

```http
PUT /api/articles/:id/status
Content-Type: application/json
```

```json
{
  "status": 0
}
```

要求 `article:status` 权限。`0` 表示失效，`1` 表示有效，该操作不改变审批状态。
