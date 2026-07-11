# 文章分类功能前端变更文档

## 1. 变更概览

本次新增树形文章分类管理，并将文章与分类调整为必填的多对一关系：

- 一个分类可以包含多篇文章。
- 一篇文章必须且只能属于一个分类。
- 创建文章时必须提交 `categoryId`。
- 更新文章时可以提交 `categoryId` 更换分类；不传表示保持原分类。
- 文章列表可以通过 `categoryId` 筛选。
- 文章列表与详情会返回 `categoryId` 和完整的 `category` 对象。
- 已被文章使用的分类不能删除。

## 2. 分类数据结构

```ts
interface Category {
  id: number
  name: string
  description: string | null
  sort: number
  parentId: number | null
  children?: Category[]
  createdAt: string
  updatedAt: string
}
```

顶级分类的 `parentId` 为 `null`。树接口通过 `children` 返回下级分类。

## 3. 分类接口

### 3.1 获取分类树

```http
GET /api/categories/tree
```

该接口不分页，适合文章表单的树形选择器以及分类管理页面。

### 3.2 获取分类列表

```http
GET /api/categories?page=1&pageSize=10&name=技术
```

查询参数：

| 参数          | 类型   | 必填 | 说明              |
| ------------- | ------ | ---- | ----------------- |
| `page`        | number | 否   | 页码，默认 1      |
| `pageSize`    | number | 否   | 每页数量，默认 10 |
| `name`        | string | 否   | 分类名称模糊查询  |
| `description` | string | 否   | 分类描述精确查询  |
| `sort`        | number | 否   | 排序值精确查询    |

### 3.3 获取分类详情

```http
GET /api/categories/:id
```

### 3.4 创建分类

```http
POST /api/categories
Content-Type: application/json
```

```json
{
  "name": "数据库",
  "description": "数据库相关文章",
  "sort": 30,
  "parentId": 1
}
```

| 字段          | 类型           | 必填 | 说明                                |
| ------------- | -------------- | ---- | ----------------------------------- |
| `name`        | string         | 是   | 分类名称，数据库中不可重复          |
| `description` | string \| null | 否   | 分类描述                            |
| `sort`        | number         | 否   | 排序值，默认 100                    |
| `parentId`    | number \| null | 否   | 父分类 ID；顶级分类传 `null` 或不传 |

### 3.5 更新分类

```http
PUT /api/categories/:id
Content-Type: application/json
```

所有字段均可选。传入 `parentId: null` 可以将分类移动到顶级。后端会拒绝将分类设为自己的父分类，或移动到自己的子孙分类下。

### 3.6 删除分类

```http
DELETE /api/categories/:id
```

分类已被文章使用时，数据库外键会阻止删除。前端应提示用户先移动或删除该分类下的文章。

## 4. 文章接口变更

### 4.1 新增响应字段

文章列表与详情新增：

```ts
interface ArticleCategoryFields {
  categoryId: number
  category: Category
}
```

### 4.2 创建文章

`POST /api/articles` 的 `categoryId` 现在是必填正整数：

```json
{
  "title": "文章标题",
  "content": "<p>文章正文</p>",
  "categoryId": 2,
  "tagIds": [1, 2],
  "status": 0,
  "sort": 100
}
```

未传、传 `null`、传非正整数或传不存在的分类都会导致创建失败。

`tagIds` 为可选的正整数数组，可以同时指定多个标签。重复 ID 会自动去重；任一标签不存在时整个创建请求失败。未传或传空数组表示创建无标签文章。

### 4.3 更新文章

```http
PUT /api/articles/:id
```

- 不传 `categoryId`：保持文章当前分类。
- 传有效 `categoryId`：将文章移动到指定分类。
- 不允许传 `categoryId: null` 清空分类。
- `tagIds: [1, 2]`：将文章标签更新为指定标签。
- `tagIds: []`：清空文章标签。
- 不传 `tagIds`：保持原标签。

### 4.4 按分类筛选文章

```http
GET /api/articles?categoryId=2&page=1&pageSize=10
```

当前只筛选直接属于该分类的文章，不会自动包含子分类文章。

## 5. 前端改造清单

### 5.1 文章新增与编辑表单

1. 页面打开时请求 `GET /api/categories/tree`。
2. 使用树形单选组件展示分类，并设置为必填。
3. 提交时将选中节点 ID 作为 `categoryId`。
4. 编辑回显使用文章响应中的 `categoryId`。

### 5.2 文章列表

1. 新增分类列，显示 `article.category.name`。
2. 新增分类树筛选器。
3. 选中分类后将节点 ID 作为 `categoryId` 查询参数。

### 5.3 分类管理

建议使用树形表格，提供新增子分类、编辑、删除操作。新增子分类时将当前节点 ID 填入 `parentId`。

## 6. 错误处理

| 场景                   | HTTP 状态            | 典型消息                                 |
| ---------------------- | -------------------- | ---------------------------------------- |
| 文章分类未传或格式错误 | 400                  | 参数校验错误                             |
| 指定分类不存在         | 404                  | `Category not found`                     |
| 父分类不存在           | 404                  | `Parent category not found`              |
| 父分类是自身           | 400                  | `Parent category cannot be itself`       |
| 父分类是当前分类的子孙 | 400                  | `Parent category cannot be a descendant` |
| 删除正在使用的分类     | 500 或数据库冲突响应 | 外键约束失败                             |
