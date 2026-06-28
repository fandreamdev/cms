## cms

- Admin 后台管理模块
- API 接口模块
- 共享模块

## 创建模块

```js
nest generate module admin;
nest generate module api;
nest generate module shared;
```

## admin

- 后台管理模块直接使用 nest+handlerbar
  - 会话 session
- api
  - jwt token htmlx

## 支持会话

```
npm install cookie-parser express-session @nestjs/platform-express
```

## 支持模版引擎

```
npm install express-handlebars
```
