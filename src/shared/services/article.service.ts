import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import {
  DataSource,
  DeepPartial,
  FindOptionsOrder,
  In,
  Repository,
} from 'typeorm'
import { ArticleCreateDto, ArticleUpdateDto } from '../../api/dto'
import { ArticleQueryDto } from '../../api/dto/article/article-query.dto'
import { Article } from '../entities/article.entity'
import { Category } from '../entities/category.entity'
import { Tag } from '../entities/tag.entity'
import { User } from '../entities/user.entity'
import { ArticleApprovalStatus } from '../enum/article-approval-status.enum'
import { BaseService, PaginatedResult } from './base.service'
import { EventEmitter2 } from '@nestjs/event-emitter'
import {
  ARTICLE_SUBMITTED_EVENT,
  ArticleSubmittedEvent,
} from '../events/article.events'

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
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
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
      relations: { category: true, tags: true, author: true, reviewer: true },
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
      relations: { category: true, tags: true, author: true, reviewer: true },
    })
  }

  async findAllForExport(): Promise<Article[]> {
    return this.repository.find({
      relations: { category: true, tags: true, author: true, reviewer: true },
      order: { sort: 'ASC', id: 'ASC' },
    })
  }

  async createWithCategory(
    createDto: ArticleCreateDto,
    author: User,
  ): Promise<Article> {
    const { categoryId, tagIds, ...values } = createDto
    const category = await this.resolveCategory(categoryId)
    const tags = await this.resolveTags(tagIds ?? [])
    const article = this.repository.create({
      ...values,
      category,
      tags,
      author,
      approvalStatus: ArticleApprovalStatus.DRAFT,
      rejectionReason: null,
    } as DeepPartial<Article>)
    const saved = await this.repository.save(article)
    return (await this.findOneWithCategory(saved.id)) as Article
  }

  async updateWithCategory(
    id: number,
    updateDto: ArticleUpdateDto,
    userId: number,
  ): Promise<Article> {
    const { categoryId, tagIds, ...values } = updateDto
    const [category, tags] = await Promise.all([
      categoryId === undefined ? undefined : this.resolveCategory(categoryId),
      tagIds === undefined ? undefined : this.resolveTags(tagIds),
    ])
    await this.withLockedArticle(id, (article) => {
      this.assertAuthor(article, userId)
      this.assertActive(article)
      this.assertNotPending(article)
      Object.assign(article, values)
      if (category) article.category = category
      if (tags) article.tags = tags
    })
    return (await this.findOneWithCategory(id)) as Article
  }

  async submit(id: number, userId: number): Promise<Article> {
    await this.withLockedArticle(id, (article) => {
      this.assertAuthor(article, userId)
      this.assertActive(article)
      this.assertNotPending(article)
      article.approvalStatus = ArticleApprovalStatus.PENDING
      article.rejectionReason = null
      article.submittedAt = new Date()
      article.reviewedAt = null
      article.reviewer = null
    })
    const event: ArticleSubmittedEvent = { articleId: id }
    await this.eventEmitter.emitAsync(ARTICLE_SUBMITTED_EVENT, event)
    return (await this.findOneWithCategory(id)) as Article
  }

  async approve(id: number, reviewer: User): Promise<Article> {
    const title = await this.withLockedArticle(id, (article) => {
      this.assertActive(article)
      this.assertPending(article)
      article.approvalStatus = ArticleApprovalStatus.APPROVED
      article.rejectionReason = null
      article.reviewedAt = new Date()
      article.publishedAt = new Date()
      article.reviewer = reviewer
      return article.title
    })
    this.logger.log(`文章[${title}]已发布`)
    return (await this.findOneWithCategory(id)) as Article
  }

  async reject(id: number, reason: string, reviewer: User): Promise<Article> {
    await this.withLockedArticle(id, (article) => {
      this.assertActive(article)
      this.assertPending(article)
      article.approvalStatus = ArticleApprovalStatus.REJECTED
      article.rejectionReason = reason.trim()
      article.reviewedAt = new Date()
      article.reviewer = reviewer
    })
    return (await this.findOneWithCategory(id)) as Article
  }

  async withdraw(id: number, userId: number): Promise<Article> {
    const title = await this.withLockedArticle(id, (article) => {
      this.assertAuthor(article, userId)
      this.assertActive(article)
      this.assertPending(article)
      article.approvalStatus = ArticleApprovalStatus.WITHDRAWN
      article.rejectionReason = null
      return article.title
    })
    this.logger.log(`文章[${title}]已撤回`)
    return (await this.findOneWithCategory(id)) as Article
  }

  async setStatus(id: number, status: number): Promise<Article> {
    await this.withLockedArticle(id, (article) => {
      if (status === article.status) this.throwStateConflict()
      if (status === 0) {
        this.assertActive(article)
        this.assertNotPending(article)
      } else if (article.status !== 0) {
        this.throwStateConflict()
      }
      article.status = status
    })
    return (await this.findOneWithCategory(id)) as Article
  }

  async deleteByAuthor(id: number, userId: number): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Article)
      const article = await repository.findOne({
        where: { id },
        relations: { author: true },
        lock: { mode: 'pessimistic_write' },
      })
      if (!article) throw new NotFoundException('文章不存在')
      this.assertAuthor(article, userId)
      this.assertActive(article)
      if (
        ![ArticleApprovalStatus.DRAFT, ArticleApprovalStatus.REJECTED].includes(
          article.approvalStatus,
        )
      ) {
        this.throwStateConflict()
      }
      await repository.remove(article)
    })
  }

  private async resolveCategory(id: number): Promise<Category> {
    const category = await this.categoryRepository.findOne({ where: { id } })
    if (!category) throw new NotFoundException('分类不存在')
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

  private assertAuthor(article: Article, userId: number): void {
    if (article.authorId !== userId) {
      throw new ForbiddenException('只有文章作者可以执行此操作')
    }
  }

  private assertActive(article: Article): void {
    if (article.status !== 1) this.throwStateConflict()
  }

  private assertNotPending(article: Article): void {
    if (article.approvalStatus === ArticleApprovalStatus.PENDING) {
      this.throwStateConflict()
    }
  }

  private assertPending(article: Article): void {
    if (article.approvalStatus !== ArticleApprovalStatus.PENDING) {
      this.throwStateConflict()
    }
  }

  private throwStateConflict(): never {
    throw new ConflictException('当前文章状态不允许执行此操作')
  }

  private async withLockedArticle<T>(
    id: number,
    action: (article: Article) => Promise<T> | T,
  ): Promise<T> {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Article)
      const article = await repository.findOne({
        where: { id },
        relations: { author: true, reviewer: true },
        lock: { mode: 'pessimistic_write' },
      })
      if (!article) throw new NotFoundException('文章不存在')
      const result = await action(article)
      await repository.save(article)
      return result
    })
  }
}
