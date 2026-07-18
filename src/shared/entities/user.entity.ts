import { Exclude } from 'class-transformer'
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
import { Role } from './role.entity'

@Entity('users')
@Index('IDX_users_updated_at_id', ['updatedAt', 'id'])
@Index('IDX_users_created_at', ['createdAt'])
export class User {
  @PrimaryGeneratedColumn({ comment: '唯一标识' })
  id!: number

  @Column({ length: 50, unique: true, comment: '用户名称' })
  username!: string

  @Exclude()
  @Column({ comment: '密码' })
  password!: string

  @Column({ length: 15, unique: true, comment: '手机号码', nullable: true })
  mobile!: string

  @Column({ length: 100, unique: true, comment: '邮箱地址', nullable: true })
  email!: string

  @Column({ type: 'int', default: 1, comment: '是否生效 0表示无效，1表示有效' })
  status!: number

  @Column({
    name: 'is_super',
    type: 'tinyint',
    default: false,
    comment: '是否是超级管理员',
  })
  isSuper!: boolean

  @Column({ type: 'int', default: 100, comment: '排序字段' })
  sort!: number

  @ManyToMany(() => Role, (role) => role.users)
  @JoinTable({
    name: 'user_roles',
    joinColumn: { name: 'user_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'role_id', referencedColumnName: 'id' },
  })
  roles!: Role[]

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
