# 登录验证码接口

## 获取验证码

```http
GET /api/auth/captcha
```

无需登录态。响应头为 `Cache-Control: no-store, no-cache, must-revalidate`，禁止浏览器及中间层缓存。

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "captchaId": "a7c2f0d8-9b70-4cde-9f1c-6ffea4ea11aa",
    "image": "data:image/png;base64,iVBORw0KGgo..."
  }
}
```

`image` 可直接赋给 HTML `img.src`。验证码为可含前导零的随机 4 位数字，有效期默认 5 分钟。

## 登录

```http
POST /api/auth/login
Content-Type: application/json
```

```json
{
  "username": "admin",
  "password": "Test@123456",
  "captchaId": "a7c2f0d8-9b70-4cde-9f1c-6ffea4ea11aa",
  "captcha": "0427"
}
```

`captchaId` 和 `captcha` 现为必填项。验证码缺失、格式错误、过期、已使用或校验失败均返回 HTTP 400：

```json
{
  "code": "CAPTCHA_INVALID",
  "message": "验证码错误或已过期，请刷新后重试",
  "data": null
}
```

验证码答案仅以 HMAC 形式保存在 Redis 中。登录校验采用原子读取并删除：任一次登录提交（包括密码错误）都会使该验证码立即失效，不能并发重放。获取验证码按 IP 限流；登录按 IP 和用户名限流，触发后返回 HTTP 429。OpenAPI/Swagger 中的 `LoginDto` 已同步要求这两个字段，可作为 API 网关请求体校验的来源。
