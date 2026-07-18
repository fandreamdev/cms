import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  RelationId,
  Tree,
  TreeChildren,
  TreeParent,
  UpdateDateColumn,
} from 'typeorm'
import { Article } from './article.entity'

@Entity('categories')
@Tree('materialized-path')
@Index('IDX_categories_updated_at_id', ['updatedAt', 'id'])
@Index('IDX_categories_created_at', ['createdAt'])
export class Category {
  @PrimaryGeneratedColumn({ comment: '唯一标识' })
  id!: number

  @Column({ length: 100, unique: true, comment: '分类名称' })
  name!: string

  @Column({
    type: 'varchar',
    length: 200,
    nullable: true,
    comment: '分类描述',
  })
  description!: string | null

  @Column({ type: 'int', default: 100, comment: '排序字段' })
  sort!: number

  @TreeChildren()
  children!: Category[]

  @TreeParent()
  parent!: Category | null

  @RelationId((category: Category) => category.parent)
  parentId!: number | null

  @OneToMany(() => Article, (article) => article.category)
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
