import PptxGenJS from 'pptxgenjs'
import { Article } from '../../entities/article.entity'
import { parseArticleContent } from './article-content-parser'
import { formatArticleDate, truncateText } from './article-export.utils'

const FONT_FACE = 'Microsoft YaHei'
const COLORS = {
  ink: '000000',
  muted: '5F6368',
  panel: 'EDEDED',
  rule: 'B8BCC4',
  accent: '3D8DFF',
  accentLight: 'D0EDFA',
  white: 'FFFFFF',
}

export async function createArticlePresentation(
  articles: Article[],
): Promise<Buffer> {
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'
  pptx.author = 'CMS'
  pptx.company = 'CMS'
  pptx.subject = '全部文章导出'
  pptx.title = '全部文章'
  pptx.theme = {
    headFontFace: FONT_FACE,
    bodyFontFace: FONT_FACE,
  }

  if (!articles.length) addEmptySlide(pptx)
  articles.forEach((article, index) =>
    addArticleSlide(pptx, article, index + 1, articles.length),
  )

  const output = await pptx.write({ outputType: 'nodebuffer' })
  return Buffer.isBuffer(output) ? output : Buffer.from(output as ArrayBuffer)
}

function addArticleSlide(
  pptx: PptxGenJS,
  article: Article,
  page: number,
  total: number,
): void {
  const slide = pptx.addSlide()
  slide.background = { color: COLORS.white }

  slide.addText(article.category?.name ?? '未分类', {
    x: 0.6,
    y: 0.34,
    w: 4.4,
    h: 0.3,
    margin: 0,
    fontFace: FONT_FACE,
    fontSize: 16,
    bold: true,
    color: COLORS.accent,
  })
  slide.addText(`文章 ID：${article.id}`, {
    x: 10.25,
    y: 0.34,
    w: 2.45,
    h: 0.3,
    margin: 0,
    fontFace: FONT_FACE,
    fontSize: 14,
    color: COLORS.muted,
    align: 'right',
  })
  slide.addText(truncateText(article.title, 48), {
    x: 0.6,
    y: 0.78,
    w: 12.05,
    h: 0.78,
    margin: 0,
    fontFace: FONT_FACE,
    fontSize: 35,
    bold: true,
    color: COLORS.ink,
    fit: 'shrink',
  })
  slide.addShape(pptx.ShapeType.line, {
    x: 0.6,
    y: 1.72,
    w: 12.05,
    h: 0,
    line: { color: COLORS.rule, width: 1 },
  })

  if (article.summary) {
    slide.addShape(pptx.ShapeType.rect, {
      x: 0.6,
      y: 1.98,
      w: 12.05,
      h: 1.02,
      fill: { color: COLORS.accentLight },
      line: { color: COLORS.accentLight, transparency: 100 },
    })
    slide.addText(truncateText(article.summary, 180), {
      x: 0.86,
      y: 2.15,
      w: 11.5,
      h: 0.68,
      margin: 0,
      fontFace: FONT_FACE,
      fontSize: 18,
      color: COLORS.ink,
      valign: 'middle',
      fit: 'shrink',
    })
  }

  slide.addText(buildBodyText(article), {
    x: 0.62,
    y: article.summary ? 3.32 : 2.02,
    w: 12,
    h: article.summary ? 2.75 : 4.05,
    margin: 0,
    fontFace: FONT_FACE,
    fontSize: 18,
    color: COLORS.ink,
    breakLine: false,
    fit: 'shrink',
    valign: 'top',
  })

  const metadata = [
    article.author?.username ? `作者：${article.author.username}` : '',
    article.tags?.length
      ? `标签：${article.tags.map((tag) => tag.name).join('、')}`
      : '',
    article.publishedAt
      ? `发布：${formatArticleDate(article.publishedAt)}`
      : '',
    `状态：${article.status === 1 ? '有效' : '失效'}`,
  ]
    .filter(Boolean)
    .join('   |   ')
  slide.addText(metadata, {
    x: 0.62,
    y: 6.53,
    w: 10.9,
    h: 0.34,
    margin: 0,
    fontFace: FONT_FACE,
    fontSize: 13,
    color: COLORS.muted,
    fit: 'shrink',
  })
  slide.addText(`${page} / ${total}`, {
    x: 11.65,
    y: 6.53,
    w: 1,
    h: 0.34,
    margin: 0,
    fontFace: FONT_FACE,
    fontSize: 12,
    color: COLORS.muted,
    align: 'right',
  })
}

function addEmptySlide(pptx: PptxGenJS): void {
  const slide = pptx.addSlide()
  slide.background = { color: COLORS.white }
  slide.addText('暂无可导出的文章', {
    x: 0.8,
    y: 2.75,
    w: 11.7,
    h: 1,
    margin: 0,
    fontFace: FONT_FACE,
    fontSize: 44,
    bold: true,
    color: COLORS.ink,
    align: 'center',
  })
}

function buildBodyText(article: Article): string {
  const lines: string[] = []
  for (const block of parseArticleContent(article.content)) {
    if (block.type === 'heading') {
      lines.push(`【${block.text}】`)
    } else if (block.type === 'list') {
      block.items.forEach((item, index) =>
        lines.push(block.ordered ? `${index + 1}. ${item}` : `• ${item}`),
      )
    } else if (block.type === 'image') {
      lines.push(`[图片] ${block.alt}`)
    } else if (block.type !== 'rule') {
      lines.push(block.text)
    }
  }
  return truncateText(lines.join('\n'), 560)
}
