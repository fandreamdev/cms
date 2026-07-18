import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'
import { Article } from './article.entity'

@Entity('tags')
@Index('IDX_tags_updated_at_id', ['updatedAt', 'id'])
@Index('IDX_tags_created_at', ['createdAt'])
export class Tag {
  @PrimaryGeneratedColumn({ comment: '唯一标识' })
  id!: number

  @Column({ length: 50, unique: true, comment: '标签名称' })
  name!: string

  @Column({
    type: 'varchar',
    length: 200,
    nullable: true,
    comment: '标签描述',
  })
  description!: string | null

  @Column({ type: 'int', default: 100, comment: '排序字段' })
  sort!: number

  @ManyToMany(() => Article, (article) => article.tags)
  articles!: Article[]

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
