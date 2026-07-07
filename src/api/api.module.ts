import { Module } from '@nestjs/common'
import { UserController } from './controller/user.controller'
import { RoleController } from './controller/role.controller'
import { AccessController } from './controller/access.controller'

@Module({
  controllers: [UserController, RoleController, AccessController],
})
export class ApiModule {}
