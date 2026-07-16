# MongoDB Docker 部署说明

网站设置使用 Docker Compose 中的 MongoDB 8 容器。项目根目录的 [`docker-compose.yml`](../docker-compose.yml) 已包含数据卷、健康检查和重启策略。

## 本地启动

```bash
docker compose up -d
docker compose ps
```

健康状态为 `healthy` 后启动 Nest 应用：

```bash
npm run start:dev
```

默认本地连接为：

```text
mongodb://cms:cms_local_password@localhost:27017/cms?authSource=admin
```

它已写入 `.env.example` 中的 `MONGODB_URI`。可复制 `.env.example` 的相应变量到实际 `.env`，并在非本地环境使用高强度密码：

```dotenv
MONGODB_ROOT_USERNAME=cms
MONGODB_ROOT_PASSWORD=<strong-password>
MONGODB_DATABASE=cms
MONGODB_PORT=27017
MONGODB_URI=mongodb://cms:<strong-password>@localhost:27017/cms?authSource=admin
```

如果 Nest 应用也运行在同一个 Compose 网络中，连接串主机名应改为 `mongodb`，例如：`mongodb://cms:<strong-password>@mongodb:27017/cms?authSource=admin`。

## 运维注意事项

- MongoDB 数据保存在命名卷 `cms_mongodb_data`，普通的 `docker compose down` 不会删除数据。
- `MONGO_INITDB_ROOT_*` 仅在空数据卷首次创建时生效。修改凭据前请先完成 MongoDB 用户迁移；本地需要完全重置时执行 `docker compose down -v`，该操作会删除所有 Mongo 数据。
- 生产环境不要直接暴露 `27017` 到公网。可移除 Compose 的 `ports` 配置，仅允许应用所在的私有网络访问。
