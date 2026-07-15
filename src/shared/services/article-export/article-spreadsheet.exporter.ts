import ExcelJS from 'exceljs'
import { Article } from '../../entities/article.entity'
import { parseArticleContent } from './article-content-parser'

const COLORS = {
  header: 'FF1F4D78',
  white: 'FFFFFFFF',
  border: 'FFD7DBE2',
}

export async function createArticleSpreadsheet(
  articles: Article[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'CMS'
  workbook.lastModifiedBy = 'CMS'
  workbook.created = new Date()
  workbook.modified = new Date()
  workbook.title = '全部文章'
  workbook.subject = '全部文章导出'

  const sheet = workbook.addWorksheet('全部文章', {
    views: [
      { state: 'frozen', ySplit: 1, showGridLines: false, zoomScale: 85 },
    ],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
  })
  sheet.columns = [
    { header: '文章 ID', key: 'id', width: 11 },
    { header: '标题', key: 'title', width: 36 },
    { header: '摘要', key: 'summary', width: 44 },
    { header: '正文', key: 'content', width: 72 },
    { header: '分类', key: 'category', width: 18 },
    { header: '标签', key: 'tags', width: 28 },
    { header: '作者', key: 'author', width: 18 },
    { header: '有效状态', key: 'status', width: 12 },
    { header: '审批状态', key: 'approvalStatus', width: 14 },
    { header: '发布时间', key: 'publishedAt', width: 16 },
    { header: '创建时间', key: 'createdAt', width: 16 },
    { header: '更新时间', key: 'updatedAt', width: 16 },
    { header: '封面地址', key: 'coverUrl', width: 42 },
  ]

  const rows = articles.map((article) => [
    article.id,
    article.title,
    article.summary ?? '',
    articlePlainText(article),
    article.category?.name ?? '',
    article.tags?.map((tag) => tag.name).join('、') ?? '',
    article.author?.username ?? '',
    article.status === 1 ? '有效' : '失效',
    article.approvalStatus,
    article.publishedAt,
    article.createdAt,
    article.updatedAt,
    article.coverUrl ?? '',
  ])
  sheet.addTable({
    name: 'AllArticlesTable',
    ref: 'A1',
    headerRow: true,
    totalsRow: false,
    style: { theme: 'TableStyleMedium2', showRowStripes: true },
    columns: sheet.columns.map((column) => ({ name: String(column.header) })),
    rows,
  })

  sheet.getRow(1).height = 30
  sheet.getRow(1).font = {
    name: 'Microsoft YaHei',
    size: 11,
    bold: true,
    color: { argb: COLORS.white },
  }
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: COLORS.header },
  }
  sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' }

  for (let rowIndex = 2; rowIndex <= articles.length + 1; rowIndex++) {
    const row = sheet.getRow(rowIndex)
    row.font = { name: 'Microsoft YaHei', size: 10 }
    row.alignment = { vertical: 'top' }
    const contentValue = row.getCell(4).value
    const content = typeof contentValue === 'string' ? contentValue : ''
    const visualLines = content
      .split('\n')
      .reduce(
        (total, line) => total + Math.max(1, Math.ceil(line.length / 42)),
        0,
      )
    row.height = Math.min(300, Math.max(54, visualLines * 15 + 12))
    for (let column = 1; column <= 13; column++) {
      const cell = row.getCell(column)
      cell.alignment = {
        vertical: 'top',
        horizontal: [1, 8, 9].includes(column) ? 'center' : 'left',
        wrapText: true,
      }
      cell.border = {
        bottom: { style: 'thin', color: { argb: COLORS.border } },
      }
    }
    for (const column of [10, 11, 12]) row.getCell(column).numFmt = 'yyyy-mm-dd'
  }
  sheet.autoFilter = `A1:M${Math.max(1, articles.length + 1)}`

  const output = await workbook.xlsx.writeBuffer()
  return Buffer.from(output)
}

function articlePlainText(article: Article): string {
  const lines: string[] = []
  for (const block of parseArticleContent(article.content)) {
    if (block.type === 'heading') {
      lines.push(block.text)
    } else if (block.type === 'list') {
      block.items.forEach((item, index) =>
        lines.push(block.ordered ? `${index + 1}. ${item}` : `• ${item}`),
      )
    } else if (block.type === 'image') {
      lines.push(`[图片] ${block.alt}${block.source ? ` ${block.source}` : ''}`)
    } else if (block.type !== 'rule') {
      lines.push(block.text)
    }
  }
  return lines.join('\n')
}
