import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToMany,
  PrimaryGeneratedColumn,
  RelationId,
  Tree,
  TreeChildren,
  TreeParent,
  UpdateDateColumn,
} from 'typeorm'
import { IsEnum } from 'class-validator'
import { AccessType } from '../enum/access.enum'
import { Role } from './role.entity'

@Entity('accesses')
@Tree('materialized-path')
@Index('IDX_accesses_updated_at_id', ['updatedAt', 'id'])
@Index('IDX_accesses_created_at', ['createdAt'])
export class Access {
  @PrimaryGeneratedColumn({ comment: '唯一标识' })
  id!: number

  @Column({ type: 'enum', enum: AccessType, comment: '资源类型' })
  @IsEnum(AccessType)
  type!: AccessType

  @Column({ length: 200, nullable: true, comment: 'url地址' })
  url!: string

  @Column({ length: 200, nullable: true, comment: '描述' })
  description!: string

  @TreeChildren()
  children!: Access[]

  @TreeParent()
  parent!: Access | null

  @RelationId((access: Access) => access.parent)
  parentId!: number | null

  @ManyToMany(() => Role, (role) => role.accesses)
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
