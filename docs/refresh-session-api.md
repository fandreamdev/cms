# Redis refresh 会话与设备管理接口

登录成功后，服务端会在 Redis 仅保存 refreshToken 的 HMAC 和脱敏会话元数据。accessToken 与 refreshToken 都绑定 `sid`；会话失效后，已有 accessToken 也会立即失效。

> 上线迁移：旧版无状态 Token 不含 `sid`，不会通过新的会话校验。发布后应让已登录用户重新登录。

## 轮换与重放处理

`POST /api/auth/refresh` 的请求体保持不变：

```json
{ "refreshToken": "当前 refreshToken" }
```

每次成功刷新都会原子撤销旧 refresh 会话并签发新的 Token 对。如果旧 refreshToken 再次被提交，系统将识别为重放并撤销该 Token 家族的全部会话。刷新按 IP 限流并记录脱敏审计事件。

## 会话接口

所有接口均要求有效的 accessToken。

| 方法     | 路径                     | 作用                                   |
| -------- | ------------------------ | -------------------------------------- |
| `POST`   | `/api/auth/logout`       | 注销当前设备会话。                     |
| `POST`   | `/api/auth/logout-all`   | 注销当前用户的全部会话。               |
| `GET`    | `/api/auth/sessions`     | 列出当前用户的有效会话。               |
| `DELETE` | `/api/auth/sessions/:id` | 注销指定设备会话；仅可操作自己的会话。 |

会话列表 `data` 中每项包含 `id`、`createdAt`、`lastUsedAt`、`expiresAt`、脱敏 `ip` 以及可选的 `userAgent`、`deviceName`；不包含 refreshToken、其 HMAC 或 Token 家族标识。
