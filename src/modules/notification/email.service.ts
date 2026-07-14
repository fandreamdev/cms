import { Inject, Injectable, Logger } from '@nestjs/common'
import nodemailer, { Transporter } from 'nodemailer'
import { emailConfig } from '../../shared/config'
import type { EmailConfigType } from '../../shared/config'

export interface SendEmailOptions {
  to: string[]
  subject: string
  text: string
  html: string
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name)
  private readonly transporter: Transporter | null

  constructor(
    @Inject(emailConfig.KEY)
    private readonly config: EmailConfigType,
  ) {
    this.transporter = this.config.enabled
      ? nodemailer.createTransport({
          host: this.config.host,
          port: this.config.port,
          secure: this.config.secure,
          connectionTimeout: this.config.connectionTimeout,
          greetingTimeout: this.config.connectionTimeout,
          socketTimeout: this.config.connectionTimeout,
          auth: this.config.user
            ? {
                user: this.config.user,
                pass: this.config.password,
              }
            : undefined,
        })
      : null
  }

  async send(options: SendEmailOptions): Promise<boolean> {
    if (!this.transporter) {
      this.logger.warn('邮件通知未启用，跳过邮件发送')
      return false
    }
    if (!options.to.length) {
      this.logger.warn('邮件没有有效收件人，跳过邮件发送')
      return false
    }

    await this.transporter.sendMail({
      from: this.config.from,
      bcc: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    })
    return true
  }
}
