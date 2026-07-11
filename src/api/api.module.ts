import { Module } from '@nestjs/common'
import { UserController } from './controller/user.controller'
import { RoleController } from './controller/role.controller'
import { AccessController } from './controller/access.controller'
import { TagController } from './controller/tag.controller'
import { ArticleController } from './controller/article.controller'
import { CategoryController } from './controller/category.controller'
import { UploadController } from './controller/upload.controller'

@Module({
  controllers: [
    UserController,
    RoleController,
    AccessController,
    TagController,
    ArticleController,
    CategoryController,
    UploadController,
  ],
})
export class ApiModule {}
