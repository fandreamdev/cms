# 双 Token 认证前端变更文档

双 Token 的完整原理、后端设计、安全边界和演进方案见
[`dual-token-auth-design.md`](./dual-token-auth-design.md)。

## 1. 变更概览

登录接口现在返回短期 `accessToken` 和长期 `refreshToken`。普通 API 只能使用
`accessToken`；当它过期并返回 HTTP 401 时，前端使用 `refreshToken` 换取一对新
Token，再重试原请求。

公开接口：

```text
POST /api/auth/login
POST /api/auth/refresh
GET  /
```

## 2. 登录接口

```http
POST /api/auth/login
Content-Type: application/json
```

```json
{
  "username": "admin",
  "password": "123456"
}
```

成功响应：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "accessToken": "access JWT",
    "refreshToken": "refresh JWT",
    "user": {
      "id": 1,
      "username": "admin",
      "isSuper": true,
      "permissions": []
    }
  }
}
```

## 3. 刷新接口

```http
POST /api/auth/refresh
Content-Type: application/json
```

```json
{
  "refreshToken": "当前 refreshToken"
}
```

成功时会轮换两个 Token，并返回最新用户、角色和权限：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "accessToken": "new access JWT",
    "refreshToken": "new refresh JWT",
    "user": {}
  }
}
```

前端收到响应后必须同时替换旧的两个 Token。刷新失败返回 HTTP 401，此时应清理
登录态并跳转登录页。

## 4. 状态结构

```ts
interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: CurrentUser | null
  initialized: boolean
}

interface AuthResult {
  accessToken: string
  refreshToken: string
  user: CurrentUser
}
```

推荐将 accessToken 保存在内存中。当前接口通过 JSON 返回 refreshToken，前端可先
持久化保存；如果后续改为 HttpOnly Cookie，前端应删除直接读取 refreshToken 的逻辑。

## 5. 请求与自动刷新

普通请求始终只携带 accessToken：

```http
Authorization: Bearer <accessToken>
```

Axios 示例：

```ts
let refreshPromise: Promise<void> | null = null

http.interceptors.request.use((config) => {
  if (authStore.accessToken) {
    config.headers.Authorization = `Bearer ${authStore.accessToken}`
  }
  return config
})

http.interceptors.response.use(
  (response) => response,
  async (error) => {
    const request = error.config
    const isUnauthorized = error.response?.status === 401
    const isAuthRequest =
      request.url?.includes('/api/auth/login') ||
      request.url?.includes('/api/auth/refresh')

    if (!isUnauthorized || isAuthRequest || request._retried) {
      throw error
    }

    if (!authStore.refreshToken) {
      authStore.clear()
      throw error
    }

    request._retried = true
    refreshPromise ??= authStore.refresh().finally(() => {
      refreshPromise = null
    })

    try {
      await refreshPromise
      request.headers.Authorization = `Bearer ${authStore.accessToken}`
      return http(request)
    } catch (refreshError) {
      authStore.clear()
      router.replace('/login')
      throw refreshError
    }
  },
)
```

`authStore.refresh()` 必须使用不触发上述自动刷新逻辑的请求实例，或确保刷新接口被
`isAuthRequest` 排除，否则刷新失败时会产生无限循环。

## 6. 并发请求

多个请求可能同时因 accessToken 过期返回 401。必须使用共享的 `refreshPromise`：

1. 第一个 401 发起一次刷新。
2. 其他 401 等待同一个 Promise。
3. 刷新成功后分别重试原请求。
4. 刷新失败只执行一次退出登录。

禁止每个 401 独立刷新，因为 refreshToken 会轮换，容易造成状态覆盖和重复请求。

## 7. 页面启动与退出

页面启动：

1. 恢复两个 Token。
2. accessToken 存在时请求 `GET /api/auth/me`。
3. 返回 401 时自动刷新并重试 `/api/auth/me`。
4. 刷新成功后更新用户和权限。
5. refreshToken 不存在或刷新失败时进入登录页。

当前为无状态 JWT，前端退出登录时清除本地 Token 即可。后端暂时没有 Token 撤销
列表，因此已经签发的 refreshToken 在到期前无法由服务端主动撤销。

## 8. 错误处理

| 状态码 | 场景 | 前端处理 |
| --- | --- | --- |
| 400 | refreshToken 格式不合法 | 清理登录态并进入登录页 |
| 401 | accessToken 或 refreshToken 失效 | access 失效时尝试刷新；刷新失败时退出 |
| 403 | 用户已登录但缺少资源权限 | 保留登录态并提示无权限 |
| 409 | 文章状态冲突 | 保留登录态并刷新业务数据 |
