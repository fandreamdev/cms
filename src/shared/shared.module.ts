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
    TypeOrmModule.forFeature([User, Role]),
  ],
  providers: [UserService, IsUserAlreadyExistConstraint, RoleService],
  exports: [UserService, RoleService],
})
export class SharedModule {}
