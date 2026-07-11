import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DeepPartial, FindOptionsOrder, In, Repository } from 'typeorm'
import { ArticleCreateDto, ArticleUpdateDto } from '../../api/dto'
import { ArticleQueryDto } from '../../api/dto/article/article-query.dto'
import { Article } from '../entities/article.entity'
import { Category } from '../entities/category.entity'
import { Tag } from '../entities/tag.entity'
import { BaseService, PaginatedResult } from './base.service'

@Injectable()
export class ArticleService extends BaseService<Article> {
  protected readonly logger = new Logger(ArticleService.name)
  protected fuzzyFields: (keyof Article)[] = ['title', 'summary', 'content']
  protected defaultOrder: FindOptionsOrder<Article> = { sort: 'ASC' }

  constructor(
    @InjectRepository(Article) protected repository: Repository<Article>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(Tag)
    private readonly tagRepository: Repository<Tag>,
  ) {
    super(repository)
  }

  async findAllWithCategory(
    query: ArticleQueryDto = {},
  ): Promise<PaginatedResult<Article>> {
    const page = query.page && query.page > 0 ? query.page : 1
    const pageSize = query.pageSize && query.pageSize > 0 ? query.pageSize : 10

    const { categoryId, ...filters } = query
    const where = this.buildWhere(filters)
    if (typeof categoryId === 'number') {
      where.category = { id: categoryId } as never
    }
    const [list, total] = await this.repository.findAndCount({
      where,
      relations: { category: true, tags: true },
      order: this.defaultOrder,
      skip: (page - 1) * pageSize,
      take: pageSize,
    })
    return {
      list,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    }
  }

  async findOneWithCategory(id: number): Promise<Article | null> {
    return this.repository.findOne({
      where: { id },
      relations: { category: true, tags: true },
    })
  }

  async createWithCategory(createDto: ArticleCreateDto): Promise<Article> {
    const { categoryId, tagIds, ...values } = createDto
    const category = await this.resolveCategory(categoryId)
    const tags = await this.resolveTags(tagIds ?? [])
    const article = this.repository.create({
      ...values,
      category,
      tags,
    } as DeepPartial<Article>)
    const saved = await this.repository.save(article)
    return (await this.findOneWithCategory(saved.id)) as Article
  }

  async updateWithCategory(
    id: number,
    updateDto: ArticleUpdateDto,
  ): Promise<Article> {
    const article = await this.findOneWithCategory(id)
    if (!article) throw new NotFoundException('Article not found')

    const { categoryId, tagIds, ...values } = updateDto
    Object.assign(article, values)
    if (categoryId !== undefined) {
      article.category = await this.resolveCategory(categoryId)
    }
    if (tagIds !== undefined) {
      article.tags = await this.resolveTags(tagIds)
    }
    await this.repository.save(article)
    return (await this.findOneWithCategory(id)) as Article
  }

  private async resolveCategory(id: number): Promise<Category> {
    const category = await this.categoryRepository.findOne({ where: { id } })
    if (!category) throw new NotFoundException('Category not found')
    return category
  }

  private async resolveTags(ids: number[]): Promise<Tag[]> {
    const uniqueIds = [...new Set(ids)]
    const tags = uniqueIds.length
      ? await this.tagRepository.findBy({ id: In(uniqueIds) })
      : []
    if (tags.length !== uniqueIds.length) {
      throw new BadRequestException('部分标签不存在')
    }
    return tags
  }
}
