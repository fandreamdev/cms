import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AccessController } from '../../api/controller/access.controller'
import { RoleController } from '../../api/controller/role.controller'
import { UserController } from '../../api/controller/user.controller'
import { Access } from '../../shared/entities/access.entity'
import { Role } from '../../shared/entities/role.entity'
import { User } from '../../shared/entities/user.entity'
import { AccessParentResolver } from '../../shared/services/access/access-parent.resolver'
import { AccessService } from '../../shared/services/access.service'
import { RoleService } from '../../shared/services/role.service'
import { UserService } from '../../shared/services/user.service'
import { IsUserAlreadyExistConstraint } from '../../shared/validators/is-username-unique.validator'

@Module({
  imports: [TypeOrmModule.forFeature([User, Role, Access])],
  controllers: [UserController, RoleController, AccessController],
  providers: [
    UserService,
    RoleService,
    AccessService,
    AccessParentResolver,
    IsUserAlreadyExistConstraint,
  ],
  exports: [UserService, RoleService, AccessService],
})
export class SystemModule {}
