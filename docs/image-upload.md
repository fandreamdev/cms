# CMS 图片上传与存储配置

## 上传接口

```http
POST /api/uploads/images
Content-Type: multipart/form-data
```

表单字段固定为 `file`，最大 5MB，支持 JPG、PNG、GIF 和 WebP。后端会同时校验 MIME、扩展名和文件签名，不支持 SVG。

成功响应：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "url": "/uploads/images/2026/07/11/550e8400-e29b-41d4-a716-446655440000.jpg"
  }
}
```

前端将 `data.url` 写入文章的 `coverUrl`，或插入富文本正文的 `<img src="...">`。

## 本地存储（默认）

不设置 `UPLOAD_STORAGE` 时自动使用本地存储：

```env
UPLOAD_STORAGE=local
UPLOAD_LOCAL_DIRECTORY=uploads
UPLOAD_PUBLIC_BASE_URL=
```

文件保存在：

```text
uploads/images/YYYY/MM/DD/UUID.ext
```

应用通过 `/uploads/*` 提供静态访问。`UPLOAD_PUBLIC_BASE_URL` 留空时返回同域相对地址；生产环境可以设置完整域名：

```env
UPLOAD_PUBLIC_BASE_URL=https://cms.example.com
```

## 阿里云 OSS

```env
UPLOAD_STORAGE=oss
OSS_REGION=oss-cn-hangzhou
OSS_BUCKET=example-bucket
OSS_ACCESS_KEY_ID=your-access-key-id
OSS_ACCESS_KEY_SECRET=your-access-key-secret
OSS_ENDPOINT=
OSS_CDN_URL=https://cdn.example.com
```

- `OSS_REGION`、`OSS_BUCKET`、`OSS_ACCESS_KEY_ID`、`OSS_ACCESS_KEY_SECRET` 必填。
- `OSS_ENDPOINT` 仅在使用自定义 Endpoint 时配置。
- 配置 `OSS_CDN_URL` 后返回 CDN 地址；未配置时返回 OSS SDK 提供的公开地址。
- OSS Bucket 或 CDN 必须允许浏览器读取图片。

## 前端示例

```ts
const formData = new FormData()
formData.append('file', file)

const response = await fetch('/api/uploads/images', {
  method: 'POST',
  body: formData,
})
const result = await response.json()
const coverUrl = result.data.url
```

浏览器会自动设置 multipart boundary，不要手动设置 `Content-Type`。
