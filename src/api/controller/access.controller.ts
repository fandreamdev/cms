import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common'
import { I18nValidationPipe } from 'nestjs-i18n'
import { AccessService } from '../../shared/services/access.service'
import { AccessCreateDto, AccessUpdateDto } from '../dto'
import { AccessQueryDto } from '../dto/access/access-query.dto'

@Controller('api/accesses')
export class AccessController {
  constructor(private readonly accessService: AccessService) {}

  @Get()
  async list(@Query() queryDto: AccessQueryDto) {
    return this.accessService.findAll(queryDto)
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.accessService.findOne({ where: { id } })
  }

  @Post()
  async create(
    @Body(new I18nValidationPipe({ transform: true }))
    createDto: AccessCreateDto,
  ) {
    return this.accessService.create(createDto)
  }

  @Put(':id')
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
