import { Global, Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import config, {
  AppConfigType,
  DatabaseConfigType,
  appConfigSchema,
} from './config'
import { UserService } from './services/user.service'
import { User } from './entities/user.entity'
import { IsUserAlreadyExistConstraint } from './validators/is-username-unique.validator'
import { RoleService } from './services/role.service'
import { Role } from './entities/role.entity'
import { AccessService } from './services/access.service'
import { Access } from './entities/access.entity'
import { AccessParentResolver } from './services/access/access-parent.resolver'
import { TagService } from './services/tag.service'
import { Tag } from './entities/tag.entity'
import { ArticleService } from './services/article.service'
import { Article } from './entities/article.entity'
import { CategoryService } from './services/category.service'
import { CategoryParentResolver } from './services/category/category-parent.resolver'
import { Category } from './entities/category.entity'
import { UploadService } from './services/upload.service'

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      load: [...config],
      envFilePath: ['.development.env', '.env'],
      isGlobal: true,
      validationSchema: appConfigSchema,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfigType>) => {
        const databaseConfig =
          configService.get<DatabaseConfigType>('database') ?? {}
        return databaseConfig
      },
    }),
    TypeOrmModule.forFeature([User, Role, Access, Tag, Article, Category]),
  ],
  providers: [
    UserService,
    IsUserAlreadyExistConstraint,
    RoleService,
    AccessParentResolver,
    AccessService,
    TagService,
    ArticleService,
    CategoryParentResolver,
    CategoryService,
    UploadService,
  ],
  exports: [
    UserService,
    RoleService,
    AccessService,
    TagService,
    ArticleService,
    CategoryService,
    UploadService,
  ],
})
export class SharedModule {}
