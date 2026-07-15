import { NotFoundException } from '@nestjs/common'
import { existsSync } from 'fs'
import ExcelJS from 'exceljs'
import type { ArticleExportConfigType } from '../config/article-export.config'
import { Article } from '../entities/article.entity'
import {
  ArticleBulkExportFormat,
  ArticleExportFormat,
} from '../enum/article-export-format.enum'
import { ArticleExportService } from './article-export.service'
import { parseArticleContent } from './article-export/article-content-parser'
import { ArticleService } from './article.service'

describe('ArticleExportService', () => {
  const pdfTest = [
    'C:\\Windows\\Fonts\\simhei.ttf',
    '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
    '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc',
    '/System/Library/Fonts/PingFang.ttc',
  ].some(existsSync)
    ? it
    : it.skip
  const article = {
    id: 7,
    title: '中文导出测试',
    summary: '验证 Word 与 PDF 导出。',
    content:
      '<h2>正文标题</h2><p>第一段内容。</p><ul><li>列表一</li><li>列表二</li></ul><blockquote>引用内容</blockquote><pre><code>const ok = true</code></pre>',
    category: { name: '技术文章' },
    tags: [{ name: 'NestJS' }, { name: 'TypeScript' }],
    author: { username: 'admin' },
    status: 1,
    approvalStatus: 'approved',
    publishedAt: new Date('2026-07-15T00:00:00.000Z'),
    createdAt: new Date('2026-07-14T00:00:00.000Z'),
    updatedAt: new Date('2026-07-15T00:00:00.000Z'),
  } as Article

  function createService(found: Article | null = article) {
    const articleService = {
      findOneWithCategory: jest.fn().mockResolvedValue(found),
      findAllForExport: jest.fn().mockResolvedValue(found ? [found] : []),
    } as unknown as ArticleService
    const config: ArticleExportConfigType = {
      pdfFontPath: '',
      pdfFontFamily: '',
    }
    return new ArticleExportService(articleService, config)
  }

  it('exports a valid DOCX buffer', async () => {
    const file = await createService().export(7, ArticleExportFormat.WORD)

    expect(file.filename).toBe('中文导出测试.docx')
    expect(file.contentType).toContain('wordprocessingml.document')
    expect(file.buffer.subarray(0, 2).toString()).toBe('PK')
  })

  pdfTest('exports a valid PDF buffer', async () => {
    const file = await createService().export(7, ArticleExportFormat.PDF)

    expect(file.filename).toBe('中文导出测试.pdf')
    expect(file.contentType).toBe('application/pdf')
    expect(file.buffer.subarray(0, 5).toString()).toBe('%PDF-')
  })

  it('rejects an unknown article', async () => {
    await expect(
      createService(null).export(999, ArticleExportFormat.WORD),
    ).rejects.toBeInstanceOf(NotFoundException)
  })

  // PptxGenJS uses native dynamic import, which Jest's VM disables in this repo.
  // The PPT path is covered by the external render QA used for this feature.
  it.skip('exports all articles with one PPT slide per article', async () => {
    const file = await createService().exportAll(ArticleBulkExportFormat.PPT)

    expect(file.filename).toMatch(/^全部文章-\d{8}\.pptx$/)
    expect(file.contentType).toContain('presentationml.presentation')
    expect(file.buffer.subarray(0, 2).toString()).toBe('PK')
  })

  it('exports all articles as Excel rows', async () => {
    const file = await createService().exportAll(ArticleBulkExportFormat.EXCEL)

    expect(file.filename).toMatch(/^全部文章-\d{8}\.xlsx$/)
    expect(file.contentType).toContain('spreadsheetml.sheet')
    expect(file.buffer.subarray(0, 2).toString()).toBe('PK')

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(file.buffer as unknown as ArrayBuffer)
    const sheet = workbook.getWorksheet('全部文章')
    expect(sheet?.actualRowCount).toBe(2)
    expect(sheet?.getCell('A2').value).toBe(article.id)
  })
})

describe('parseArticleContent', () => {
  it('preserves common rich-text block semantics', () => {
    expect(
      parseArticleContent(
        '<h2>标题</h2><p>段落</p><ol><li>第一项</li><li>第二项</li></ol><img src="/a.png" alt="示意图">',
      ),
    ).toEqual([
      { type: 'heading', level: 2, text: '标题' },
      { type: 'paragraph', text: '段落' },
      { type: 'list', ordered: true, items: ['第一项', '第二项'] },
      { type: 'image', alt: '示意图', source: '/a.png' },
    ])
  })

  it('strips code wrappers and ignores executable markup', () => {
    expect(
      parseArticleContent(
        '<pre><code>const ok = true</code></pre><script>alert(1)</script>',
      ),
    ).toEqual([{ type: 'code', text: 'const ok = true' }])
  })
})
