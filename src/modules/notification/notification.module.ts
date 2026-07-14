import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Article } from '../../shared/entities/article.entity'
import { User } from '../../shared/entities/user.entity'
import { ArticleSubmittedListener } from './article-submitted.listener'
import { EmailService } from './email.service'

@Module({
  imports: [TypeOrmModule.forFeature([Article, User])],
  providers: [EmailService, ArticleSubmittedListener],
  exports: [EmailService],
})
export class NotificationModule {}
