import { Inject, Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Article } from '../../shared/entities/article.entity'
import { User } from '../../shared/entities/user.entity'
import { emailConfig } from '../../shared/config'
import type { EmailConfigType } from '../../shared/config'
import { EmailService } from './email.service'
import { ARTICLE_SUBMITTED_EVENT } from '../../shared/events/article.events'
import type { ArticleSubmittedEvent } from '../../shared/events/article.events'

@Injectable()
export class ArticleSubmittedListener {
  private readonly logger = new Logger(ArticleSubmittedListener.name)
  constructor(
    @InjectRepository(Article)
    private readonly articleRepository: Repository<Article>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly emailService: EmailService,
    @Inject(emailConfig.KEY)
    private readonly emailConfig: EmailConfigType,
  ) {}

  @OnEvent(ARTICLE_SUBMITTED_EVENT, { async: true, suppressErrors: true })
  async handle(event: ArticleSubmittedEvent): Promise<void> {
    try {
      const article = await this.articleRepository.findOne({
        where: { id: event.articleId },
        relations: { author: true },
      })
      if (!article) {
        this.logger.warn(`文章[${event.articleId}]不存在，无法发送提交通知`)
        return
      }

      const administrators = await this.userRepository
        .createQueryBuilder('user')
        .where('user.isSuper = :isSuper', { isSuper: true })
        .andWhere('user.status = :status', { status: 1 })
        .andWhere('user.email IS NOT NULL')
        .andWhere("TRIM(user.email) <> ''")
        .getMany()
      const recipients = [
        ...new Set(administrators.map((user) => user.email.trim())),
      ]
      if (!recipients.length) {
        this.logger.warn(
          `文章[${article.title}]已提交，但没有可通知的超级管理员`,
        )
        return
      }

      const title = sanitizeHeader(article.title)
      const author = article.author?.username ?? `用户 ${article.authorId}`
      const reviewLink = this.emailConfig.reviewUrl
      const text = [
        `文章《${article.title}》已提交审批。`,
        `作者：${author}`,
        `文章 ID：${article.id}`,
        reviewLink ? `审核地址：${reviewLink}` : '',
      ]
        .filter(Boolean)
        .join('\n')
      const html = [
        `<p>文章《${escapeHtml(article.title)}》已提交审批。</p>`,
        `<p>作者：${escapeHtml(author)}</p>`,
        `<p>文章 ID：${article.id}</p>`,
        reviewLink
          ? `<p><a href="${escapeHtml(reviewLink)}">前往文章审核</a></p>`
          : '',
      ].join('')
      this.logger.log('send email to' + JSON.stringify(recipients))
      const sent = await this.emailService.send({
        to: recipients,
        subject: `[CMS] 文章《${title}》待审批`,
        text,
        html,
      })
      if (sent) {
        this.logger.log(
          `文章[${article.title}]提交通知已发送给${recipients.length}位超级管理员`,
        )
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.error(`文章提交邮件发送失败：${message}`)
    }
  }
}

function sanitizeHeader(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim()
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character] as string,
  )
}
