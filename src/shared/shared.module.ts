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
    TypeOrmModule.forFeature([User]),
  ],
  providers: [UserService],
  exports: [UserService],
})
export class SharedModule {}
