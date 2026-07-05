import { Module } from '@nestjs/common'
import { UserController } from './controller/user.controller'
import { RoleController } from './controller/role.controller'

@Module({
  controllers: [UserController, RoleController],
})
export class ApiModule {}
