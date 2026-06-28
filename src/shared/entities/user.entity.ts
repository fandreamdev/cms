import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'

@Entity('users')
export class User {
  @PrimaryGeneratedColumn({ comment: '唯一标识' })
  id!: number

  @Column({ length: 50, unique: true, comment: '用户名称' })
  username!: string

  @Column({ comment: '密码' })
  password!: string

  @Column({ length: 15, unique: true, comment: '手机号码' })
  mobile!: string

  @Column({ length: 100, unique: true, comment: '邮箱地址' })
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
