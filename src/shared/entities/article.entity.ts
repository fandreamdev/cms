import {
  Column,
  CreateDateColumn,
  Entity,
  JoinTable,
  JoinColumn,
  ManyToOne,
  ManyToMany,
  PrimaryGeneratedColumn,
  RelationId,
  UpdateDateColumn,
} from 'typeorm'
import { Tag } from './tag.entity'
import { Category } from './category.entity'

@Entity('articles')
export class Article {
  @PrimaryGeneratedColumn({ comment: '唯一标识' })
  id!: number

  @Column({ length: 200, comment: '文章标题' })
  title!: string

  @Column({ type: 'varchar', length: 500, nullable: true, comment: '文章摘要' })
  summary!: string | null

  @Column({ type: 'longtext', comment: '文章富文本内容' })
  content!: string

  @Column({
    name: 'cover_url',
    type: 'varchar',
    length: 500,
    nullable: true,
    comment: '封面图片地址',
  })
  coverUrl!: string | null

  @Column({
    type: 'tinyint',
    default: 0,
    comment: '发布状态：0草稿，1已发布',
  })
  status!: number

  @Column({
    name: 'published_at',
    type: 'timestamp',
    nullable: true,
    comment: '发布时间',
  })
  publishedAt!: Date | null

  @Column({ type: 'int', default: 100, comment: '排序字段' })
  sort!: number

  @ManyToMany(() => Tag, (tag) => tag.articles)
  @JoinTable({
    name: 'article_tags',
    joinColumn: { name: 'article_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'tag_id', referencedColumnName: 'id' },
  })
  tags!: Tag[]

  @ManyToOne(() => Category, (category) => category.articles, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'category_id' })
  category!: Category

  @RelationId((article: Article) => article.category)
  categoryId!: number

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
