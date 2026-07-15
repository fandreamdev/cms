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
- `approved`、`rejected`：保存后审批状态不变。
- `pending`：禁止编辑，返回 HTTP 409。
- `withdrawn`：允许编辑，保存后仍为已撤回，可再次提交审批。
- 任意审批状态下，`status = 0` 的已下架文章都禁止编辑和提交。
- 只有作者可以编辑文章。

## 6. 提交审批

```http
POST /api/articles/:id/submit
```

只有作者可以提交。允许从 `draft`、`approved`、`rejected` 或 `withdrawn` 进入
`pending`。已下架或审批中的文章不能提交。

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

只有作者可以撤回已上架且审批中的文章。当前阶段尚未创建发布表，接口会：

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

要求 `article:status` 权限。下架只允许已上架且非审批中的文章；上架只允许已下架文章。
该操作不改变审批状态。

## 11. 删除

```http
DELETE /api/articles/:id
```

只有作者本人可以删除已上架且处于 `draft` 或 `rejected` 状态的文章。其他状态返回
HTTP 409。

## 12. 导出 Word/PDF/PPT/Excel

### 12.1 导出单篇文章

```http
GET /api/articles/:id/export?format=word
GET /api/articles/:id/export?format=pdf
```

要求 `article:view` 权限。接口直接返回二进制附件，不使用统一的
`{ code, message, data }` 响应结构：

- `format=word` 返回 `.docx`，Content-Type 为
  `application/vnd.openxmlformats-officedocument.wordprocessingml.document`。
- `format=pdf` 返回 `.pdf`，Content-Type 为 `application/pdf`。
- 文件名优先使用文章标题，并同时提供 ASCII 回退文件名。
- 导出内容包含标题、摘要、作者、分类、标签、发布日期和正文。
- 正文支持标题、段落、列表、引用、代码块和图片说明。服务端不会主动下载正文中的
  外部图片，避免任意 URL 抓取造成 SSRF。

PDF 导出会自动探测常见操作系统中的中文字体。部署环境没有可用字体时，应配置：

```dotenv
ARTICLE_EXPORT_PDF_FONT_PATH=/path/to/chinese-font.ttf
# TTC 字体集合还需要指定字体名称
ARTICLE_EXPORT_PDF_FONT_FAMILY=Noto Sans CJK SC
```

### 12.2 导出全部文章

```http
GET /api/articles/export?format=ppt
GET /api/articles/export?format=excel
```

要求 `article:list` 权限，导出范围为全部文章，不受列表分页参数影响：

- `format=ppt` 返回 `.pptx`，每一页对应一篇文章。单页包含文章标题、摘要、正文摘录、
  分类、标签、作者、发布时间及有效状态。
- `format=excel` 返回 `.xlsx`，每一行对应一篇文章。工作表提供筛选、冻结表头、日期
  格式和自动换行，包含完整的正文纯文本及文章元数据。
- 当文章正文过长时，PPT 为保证“一页一篇文章”会截取适合单页展示的内容；Excel
  保留完整正文。
