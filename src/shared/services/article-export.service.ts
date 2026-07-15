import {
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common'
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  LevelFormat,
  PageNumber,
  Packer,
  Paragraph,
  ShadingType,
  TextRun,
} from 'docx'
import { existsSync } from 'fs'
import PDFDocument from 'pdfkit'
import { Article } from '../entities/article.entity'
import {
  ArticleBulkExportFormat,
  ArticleExportFormat,
} from '../enum/article-export-format.enum'
import { articleExportConfig } from '../config/article-export.config'
import type { ArticleExportConfigType } from '../config/article-export.config'
import { ArticleService } from './article.service'
import {
  ArticleDocumentBlock,
  parseArticleContent,
} from './article-export/article-content-parser'
import { createArticlePresentation } from './article-export/article-presentation.exporter'
import { createArticleSpreadsheet } from './article-export/article-spreadsheet.exporter'
import { formatArticleDate } from './article-export/article-export.utils'

export interface ArticleExportFile {
  buffer: Buffer
  filename: string
  contentType: string
}

interface PdfFontDefinition {
  path: string
  family?: string
}

const PAGE_WIDTH_DXA = 12240
const PAGE_HEIGHT_DXA = 15840
const PAGE_MARGIN_DXA = 1440
const BODY_FONT = 'Microsoft YaHei'

@Injectable()
export class ArticleExportService {
  constructor(
    private readonly articleService: ArticleService,
    @Inject(articleExportConfig.KEY)
    private readonly config: ArticleExportConfigType,
  ) {}

  async export(
    articleId: number,
    format: ArticleExportFormat,
  ): Promise<ArticleExportFile> {
    const article = await this.articleService.findOneWithCategory(articleId)
    if (!article) throw new NotFoundException('文章不存在')

    if (format === ArticleExportFormat.PDF) return this.exportPdf(article)
    return this.exportWord(article)
  }

  async exportAll(format: ArticleBulkExportFormat): Promise<ArticleExportFile> {
    const articles = await this.articleService.findAllForExport()
    return format === ArticleBulkExportFormat.PPT
      ? this.exportPpt(articles)
      : this.exportExcel(articles)
  }

  private async exportWord(article: Article): Promise<ArticleExportFile> {
    const blocks = parseArticleContent(article.content)
    const document = new Document({
      creator: 'CMS',
      title: article.title,
      description: article.summary ?? undefined,
      styles: {
        default: {
          document: {
            run: { font: BODY_FONT, size: 22, color: '1F2937' },
            paragraph: { spacing: { after: 160, line: 320 } },
          },
        },
        paragraphStyles: [
          {
            id: 'ArticleTitle',
            name: 'Article Title',
            basedOn: 'Normal',
            next: 'Normal',
            run: { font: BODY_FONT, size: 52, color: '0B2545' },
            paragraph: { spacing: { before: 0, after: 160 } },
          },
          {
            id: 'ArticleSummary',
            name: 'Article Summary',
            basedOn: 'Normal',
            next: 'Normal',
            run: { font: BODY_FONT, size: 24, color: '4B5563', italics: true },
            paragraph: { spacing: { after: 280, line: 320 } },
          },
          {
            id: 'ArticleHeading1',
            name: 'Article Heading 1',
            basedOn: 'Normal',
            next: 'Normal',
            quickFormat: true,
            run: { font: BODY_FONT, size: 32, bold: true, color: '2E74B5' },
            paragraph: {
              outlineLevel: 0,
              spacing: { before: 360, after: 200 },
              keepNext: true,
            },
          },
          {
            id: 'ArticleHeading2',
            name: 'Article Heading 2',
            basedOn: 'Normal',
            next: 'Normal',
            quickFormat: true,
            run: { font: BODY_FONT, size: 26, bold: true, color: '2E74B5' },
            paragraph: {
              outlineLevel: 1,
              spacing: { before: 280, after: 140 },
              keepNext: true,
            },
          },
          {
            id: 'ArticleHeading3',
            name: 'Article Heading 3',
            basedOn: 'Normal',
            next: 'Normal',
            quickFormat: true,
            run: { font: BODY_FONT, size: 24, bold: true, color: '1F4D78' },
            paragraph: {
              outlineLevel: 2,
              spacing: { before: 200, after: 100 },
              keepNext: true,
            },
          },
        ],
      },
      numbering: {
        config: [
          {
            reference: 'article-bullets',
            levels: [
              {
                level: 0,
                format: LevelFormat.BULLET,
                text: '•',
                alignment: AlignmentType.LEFT,
                style: {
                  paragraph: {
                    indent: { left: 720, hanging: 360 },
                    spacing: { after: 80, line: 290 },
                  },
                },
              },
            ],
          },
          {
            reference: 'article-numbers',
            levels: [
              {
                level: 0,
                format: LevelFormat.DECIMAL,
                text: '%1.',
                alignment: AlignmentType.LEFT,
                style: {
                  paragraph: {
                    indent: { left: 720, hanging: 360 },
                    spacing: { after: 80, line: 290 },
                  },
                },
              },
            ],
          },
        ],
      },
      sections: [
        {
          properties: {
            page: {
              size: { width: PAGE_WIDTH_DXA, height: PAGE_HEIGHT_DXA },
              margin: {
                top: PAGE_MARGIN_DXA,
                right: PAGE_MARGIN_DXA,
                bottom: PAGE_MARGIN_DXA,
                left: PAGE_MARGIN_DXA,
                header: 708,
                footer: 708,
              },
            },
          },
          headers: {
            default: new Header({
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({
                      text: article.category?.name ?? 'CMS 文章',
                      color: '6B7280',
                      size: 18,
                      font: BODY_FONT,
                    }),
                  ],
                }),
              ],
            }),
          },
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({ text: '第 ', color: '6B7280', size: 18 }),
                    new TextRun({ children: [PageNumber.CURRENT], size: 18 }),
                    new TextRun({ text: ' 页', color: '6B7280', size: 18 }),
                  ],
                }),
              ],
            }),
          },
          children: [
            ...this.createWordTitle(article),
            ...blocks.flatMap((block) => this.createWordBlock(block)),
          ],
        },
      ],
    })

    return {
      buffer: await Packer.toBuffer(document),
      filename: `${sanitizeFilename(article.title)}.docx`,
      contentType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    }
  }

  private createWordTitle(article: Article): Paragraph[] {
    const metadata = [
      article.author?.username ? `作者：${article.author.username}` : '',
      article.category?.name ? `分类：${article.category.name}` : '',
      article.publishedAt
        ? `发布：${formatArticleDate(article.publishedAt)}`
        : '',
      article.tags?.length
        ? `标签：${article.tags.map((tag) => tag.name).join('、')}`
        : '',
    ]
      .filter(Boolean)
      .join('  |  ')

    return [
      new Paragraph({
        children: [
          new TextRun({
            text: article.category?.name ?? 'CMS 文章',
            bold: true,
            color: 'B7791F',
            size: 20,
            font: BODY_FONT,
          }),
        ],
        spacing: { after: 100 },
      }),
      new Paragraph({
        style: 'ArticleTitle',
        children: [new TextRun(article.title)],
      }),
      ...(article.summary
        ? [
            new Paragraph({
              style: 'ArticleSummary',
              children: [new TextRun(article.summary)],
            }),
          ]
        : []),
      new Paragraph({
        children: [
          new TextRun({
            text: metadata,
            color: '6B7280',
            size: 18,
            font: BODY_FONT,
          }),
        ],
        spacing: { after: 320 },
        border: {
          bottom: {
            color: 'D7DBE2',
            style: BorderStyle.SINGLE,
            size: 6,
            space: 12,
          },
        },
      }),
    ]
  }

  private createWordBlock(block: ArticleDocumentBlock): Paragraph[] {
    if (block.type === 'heading') {
      return [
        new Paragraph({
          style: `ArticleHeading${block.level}`,
          children: [new TextRun(block.text)],
        }),
      ]
    }
    if (block.type === 'list') {
      return block.items.map(
        (item) =>
          new Paragraph({
            numbering: {
              reference: block.ordered ? 'article-numbers' : 'article-bullets',
              level: 0,
            },
            children: [new TextRun(item)],
          }),
      )
    }
    if (block.type === 'quote') {
      return [
        new Paragraph({
          children: [
            new TextRun({ text: block.text, italics: true, color: '4B5563' }),
          ],
          indent: { left: 360, right: 180 },
          spacing: { before: 120, after: 160, line: 320 },
          border: {
            left: {
              color: '2E74B5',
              style: BorderStyle.SINGLE,
              size: 18,
              space: 12,
            },
          },
        }),
      ]
    }
    if (block.type === 'code') {
      return [
        new Paragraph({
          children: [
            new TextRun({ text: block.text, font: 'Consolas', size: 19 }),
          ],
          spacing: { before: 120, after: 160, line: 280 },
          shading: { type: ShadingType.CLEAR, fill: 'F2F4F7' },
          indent: { left: 240, right: 240 },
        }),
      ]
    }
    if (block.type === 'image') {
      const source = block.source ? `（${block.source}）` : ''
      return [
        new Paragraph({
          children: [
            new TextRun({
              text: `[图片] ${block.alt}${source}`,
              italics: true,
              color: '6B7280',
              size: 19,
            }),
          ],
          spacing: { before: 120, after: 160 },
        }),
      ]
    }
    if (block.type === 'rule') {
      return [
        new Paragraph({
          border: {
            bottom: {
              color: 'D7DBE2',
              style: BorderStyle.SINGLE,
              size: 4,
              space: 8,
            },
          },
          spacing: { before: 120, after: 160 },
        }),
      ]
    }
    return [new Paragraph({ children: [new TextRun(block.text)] })]
  }

  private async exportPdf(article: Article): Promise<ArticleExportFile> {
    const font = this.resolvePdfFont()
    if (!font) {
      throw new ServiceUnavailableException(
        'PDF 导出缺少中文字体，请配置 ARTICLE_EXPORT_PDF_FONT_PATH',
      )
    }

    const buffer = await this.createPdf(article, font)
    return {
      buffer,
      filename: `${sanitizeFilename(article.title)}.pdf`,
      contentType: 'application/pdf',
    }
  }

  private async exportPpt(articles: Article[]): Promise<ArticleExportFile> {
    return {
      buffer: await createArticlePresentation(articles),
      filename: `全部文章-${formatFilenameDate(new Date())}.pptx`,
      contentType:
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    }
  }

  private async exportExcel(articles: Article[]): Promise<ArticleExportFile> {
    return {
      buffer: await createArticleSpreadsheet(articles),
      filename: `全部文章-${formatFilenameDate(new Date())}.xlsx`,
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }
  }

  private createPdf(
    article: Article,
    font: PdfFontDefinition,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const document = new PDFDocument({
        size: 'LETTER',
        margins: { top: 72, right: 72, bottom: 72, left: 72 },
        bufferPages: true,
        info: {
          Title: article.title,
          Author: article.author?.username ?? 'CMS',
        },
      })
      const chunks: Buffer[] = []
      document.on('data', (chunk: Buffer) => chunks.push(chunk))
      document.on('error', reject)
      document.on('end', () => resolve(Buffer.concat(chunks)))

      document.registerFont('ArticleBody', font.path, font.family)
      document.font('ArticleBody')
      this.writePdfTitle(document, article)
      for (const block of parseArticleContent(article.content)) {
        this.writePdfBlock(document, block)
      }

      const range = document.bufferedPageRange()
      for (
        let index = range.start;
        index < range.start + range.count;
        index++
      ) {
        document.switchToPage(index)
        const bottomMargin = document.page.margins.bottom
        document.page.margins.bottom = 0
        document
          .font('ArticleBody')
          .fontSize(9)
          .fillColor('#6B7280')
          .text(`第 ${index + 1} 页`, 72, document.page.height - 48, {
            width: document.page.width - 144,
            align: 'right',
            lineBreak: false,
          })
        document.page.margins.bottom = bottomMargin
      }
      document.end()
    })
  }

  private writePdfTitle(document: PDFKit.PDFDocument, article: Article): void {
    document
      .fontSize(10)
      .fillColor('#B7791F')
      .text(article.category?.name ?? 'CMS 文章', { lineGap: 3 })
      .moveDown(0.5)
      .fontSize(26)
      .fillColor('#0B2545')
      .text(article.title, { lineGap: 5 })

    if (article.summary) {
      document
        .moveDown(0.5)
        .fontSize(12)
        .fillColor('#4B5563')
        .text(article.summary, { lineGap: 4 })
    }

    const metadata = [
      article.author?.username ? `作者：${article.author.username}` : '',
      article.category?.name ? `分类：${article.category.name}` : '',
      article.publishedAt
        ? `发布：${formatArticleDate(article.publishedAt)}`
        : '',
      article.tags?.length
        ? `标签：${article.tags.map((tag) => tag.name).join('、')}`
        : '',
    ]
      .filter(Boolean)
      .join('  |  ')

    document
      .moveDown(0.8)
      .fontSize(9)
      .fillColor('#6B7280')
      .text(metadata, { lineGap: 3 })
      .moveDown(0.8)
    document
      .strokeColor('#D7DBE2')
      .lineWidth(0.75)
      .moveTo(document.page.margins.left, document.y)
      .lineTo(document.page.width - document.page.margins.right, document.y)
      .stroke()
      .moveDown(1.2)
  }

  private writePdfBlock(
    document: PDFKit.PDFDocument,
    block: ArticleDocumentBlock,
  ): void {
    document.font('ArticleBody')
    if (block.type === 'heading') {
      const sizes = { 1: 16, 2: 13, 3: 12 }
      document
        .moveDown(block.level === 1 ? 0.9 : 0.65)
        .fontSize(sizes[block.level])
        .fillColor(block.level === 3 ? '#1F4D78' : '#2E74B5')
        .text(block.text, { lineGap: 4 })
        .moveDown(0.35)
      return
    }
    if (block.type === 'list') {
      block.items.forEach((item, index) => {
        const marker = block.ordered ? `${index + 1}.` : '-'
        document
          .fontSize(11)
          .fillColor('#1F2937')
          .text(`${marker}  ${item}`, { indent: 18, lineGap: 4 })
          .moveDown(0.25)
      })
      return
    }
    if (block.type === 'quote') {
      const top = document.y
      document
        .fontSize(11)
        .fillColor('#4B5563')
        .text(block.text, { indent: 18, lineGap: 5 })
      document
        .strokeColor('#2E74B5')
        .lineWidth(2)
        .moveTo(document.page.margins.left + 5, top)
        .lineTo(document.page.margins.left + 5, document.y)
        .stroke()
        .moveDown(0.6)
      return
    }
    if (block.type === 'code') {
      document
        .fontSize(9.5)
        .fillColor('#1F2937')
        .text(block.text, { indent: 16, lineGap: 4 })
        .moveDown(0.6)
      return
    }
    if (block.type === 'image') {
      const source = block.source ? `（${block.source}）` : ''
      document
        .fontSize(9.5)
        .fillColor('#6B7280')
        .text(`[图片] ${block.alt}${source}`, { lineGap: 3 })
        .moveDown(0.6)
      return
    }
    if (block.type === 'rule') {
      document
        .strokeColor('#D7DBE2')
        .lineWidth(0.5)
        .moveTo(document.page.margins.left, document.y)
        .lineTo(document.page.width - document.page.margins.right, document.y)
        .stroke()
        .moveDown(0.8)
      return
    }
    document
      .fontSize(11)
      .fillColor('#1F2937')
      .text(block.text, { align: 'justify', lineGap: 5 })
      .moveDown(0.55)
  }

  private resolvePdfFont(): PdfFontDefinition | null {
    if (this.config.pdfFontPath) {
      return existsSync(this.config.pdfFontPath)
        ? {
            path: this.config.pdfFontPath,
            family: this.config.pdfFontFamily || undefined,
          }
        : null
    }

    const candidates: PdfFontDefinition[] = [
      { path: 'C:\\Windows\\Fonts\\simhei.ttf' },
      {
        path: '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
        family: 'Noto Sans CJK SC',
      },
      {
        path: '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc',
        family: 'WenQuanYi Zen Hei',
      },
      {
        path: '/System/Library/Fonts/PingFang.ttc',
        family: 'PingFang SC',
      },
    ]
    return candidates.find((candidate) => existsSync(candidate.path)) ?? null
  }
}

function sanitizeFilename(title: string): string {
  const sanitized = [...title]
    .map((character) =>
      character.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(character)
        ? '_'
        : character,
    )
    .join('')
    .replace(/[. ]+$/g, '')
    .trim()
    .slice(0, 80)
  return sanitized || `article-${Date.now()}`
}

function formatFilenameDate(value: Date): string {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}${month}${day}`
}
