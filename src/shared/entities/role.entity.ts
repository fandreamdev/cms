import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'
import { User } from './user.entity'
import { Access } from './access.entity'

@Entity('roles')
@Index('IDX_roles_updated_at_id', ['updatedAt', 'id'])
@Index('IDX_roles_created_at', ['createdAt'])
export class Role {
  @PrimaryGeneratedColumn({ comment: '唯一标识' })
  id!: number

  @Column({ length: 50, unique: true, comment: '角色名称' })
  name!: string

  @ManyToMany(() => User, (user) => user.roles)
  users!: User[]

  @ManyToMany(() => Access, (access) => access.roles)
  @JoinTable({
    name: 'role_accesses',
    joinColumn: { name: 'role_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'access_id', referencedColumnName: 'id' },
  })
  accesses!: Access[]

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    comment: '创建时间',
  })
  createdAt!: Date

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamp',
    comment: '更新时间',
  })
  updatedAt!: Date
}
