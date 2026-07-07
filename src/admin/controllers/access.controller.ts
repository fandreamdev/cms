import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Redirect,
  Render,
  UseFilters,
} from '@nestjs/common'
import { AccessCreateDto, AccessUpdateDto } from '../../api/dto'
import { AccessQueryDto } from '../../api/dto/access/access-query.dto'
import { AccessService } from '../../shared/services/access.service'
import { buildPaginationView } from '../../shared/utils/pagination'
import { AdminExceptionFilter } from '../filters/admin-exception.filter'

@Controller('admin/accesses')
@UseFilters(AdminExceptionFilter)
export class AccessController {
  constructor(private readonly accessService: AccessService) {}

  @Get()
  @Render('access/access-list')
  async findAll(@Query() queryDto: AccessQueryDto) {
    const result = await this.accessService.findAll(queryDto)
    return {
      accesses: result.list,
      pagination: buildPaginationView(result, { ...queryDto }),
      query: queryDto,
    }
  }

  @Get('create')
  @Render('access/access-form')
  createForm() {
    return { access: {} }
  }

  @Post()
  @Redirect('/admin/accesses')
  async create(@Body() createDto: AccessCreateDto) {
    return this.accessService.create(createDto)
  }

  @Get(':id/detail')
  @Render('access/access-detail')
  async detail(@Param('id', ParseIntPipe) id: number) {
    const access = await this.accessService.findOne({ where: { id } })
    if (!access) {
      throw new HttpException('Access not Found', 404)
    }
    return { access }
  }

  @Get(':id/edit')
  @Render('access/access-form')
  async updateForm(@Param('id', ParseIntPipe) id: number) {
    const access = await this.accessService.findOne({ where: { id } })
    if (!access) {
      throw new HttpException('Access not Found', 404)
    }
    return { access }
  }

  @Put(':id')
  @Redirect('/admin/accesses')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: AccessUpdateDto,
  ) {
    return this.accessService.update(id, updateDto)
  }

  @Delete(':id')
  async delete(@Param('id', ParseIntPipe) id: number) {
    return this.accessService.delete(id)
  }
}
