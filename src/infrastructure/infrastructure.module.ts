import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm'
import { MongooseModule } from '@nestjs/mongoose'
import config, {
  databaseConfig,
  DatabaseConfigType,
  appConfigSchema,
  mongoConfig,
  MongoConfigType,
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
    MongooseModule.forRootAsync({
      inject: [mongoConfig.KEY],
      useFactory: (mongo: MongoConfigType) => ({
        uri: mongo.uri,
        serverSelectionTimeoutMS: mongo.serverSelectionTimeoutMs,
      }),
    }),
  ],
})
export class InfrastructureModule {}
