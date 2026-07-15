import {
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  Query,
  StreamableFile,
  UseFilters,
} from '@nestjs/common'
import { RequirePermissions } from '../../auth/permissions.decorator'
import {
  ArticleBulkExportFormat,
  ArticleExportFormat,
} from '../../shared/enum/article-export-format.enum'
import { ArticleExportService } from '../../shared/services/article-export.service'
import { ApiExceptionFilter } from '../common'

@Controller('api/articles')
@UseFilters(ApiExceptionFilter)
export class ArticleExportController {
  constructor(private readonly articleExportService: ArticleExportService) {}

  @Get('export')
  @RequirePermissions('article:list')
  async exportAll(
    @Query('format', new ParseEnumPipe(ArticleBulkExportFormat))
    format: ArticleBulkExportFormat,
  ): Promise<StreamableFile> {
    const file = await this.articleExportService.exportAll(format)
    return new StreamableFile(file.buffer, {
      type: file.contentType,
      disposition: createContentDisposition(file.filename, 'all'),
      length: file.buffer.length,
    })
  }

  @Get(':id/export')
  @RequirePermissions('article:view')
  async export(
    @Param('id', ParseIntPipe) id: number,
    @Query('format', new ParseEnumPipe(ArticleExportFormat))
    format: ArticleExportFormat,
  ): Promise<StreamableFile> {
    const file = await this.articleExportService.export(id, format)
    return new StreamableFile(file.buffer, {
      type: file.contentType,
      disposition: createContentDisposition(file.filename, id),
      length: file.buffer.length,
    })
  }
}

function createContentDisposition(
  filename: string,
  resourceId: number | 'all',
): string {
  const extension = filename.split('.').pop() ?? 'bin'
  const encoded = encodeURIComponent(filename).replace(
    /[!'()*]/g,
    (value) => `%${value.charCodeAt(0).toString(16).toUpperCase()}`,
  )
  return `attachment; filename="articles-${resourceId}.${extension}"; filename*=UTF-8''${encoded}`
}
