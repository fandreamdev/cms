import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm'
import config, {
  databaseConfig,
  DatabaseConfigType,
  appConfigSchema,
} from '../shared/config'

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [...config],
      envFilePath: ['.development.env', '.env'],
      isGlobal: true,
      validationSchema: appConfigSchema,
    }),
    TypeOrmModule.forRootAsync({
      inject: [databaseConfig.KEY],
      useFactory: (database: DatabaseConfigType) =>
        database as TypeOrmModuleOptions,
    }),
  ],
})
export class InfrastructureModule {}
