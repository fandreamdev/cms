import {
  BadRequestException,
  Body,
  Delete,
  Get,
  Param,
  Put,
} from '@nestjs/common'
import { ApiResourceController } from '../common'
import { RequirePermissions } from '../../auth/permissions.decorator'
import { Public } from '../../auth/public.decorator'
import { SettingUpsertDto } from '../dto/setting/setting-upsert.dto'
import {
  WebsiteSettingResponse,
  WebsiteSettingService,
} from '../../shared/services/website-setting.service'

@ApiResourceController('api/settings')
export class WebsiteSettingController {
  constructor(private readonly settingService: WebsiteSettingService) {}

  /** Returns only settings explicitly marked as safe for anonymous clients. */
  @Public()
  @Get('public')
  async findPublic(): Promise<Record<string, unknown>> {
    return this.settingService.findPublicValues()
  }

  @Get()
  @RequirePermissions('setting:list')
  async findAll(): Promise<WebsiteSettingResponse[]> {
    return this.settingService.findAll()
  }

  @Get(':key')
  @RequirePermissions('setting:view')
  async findOne(@Param('key') key: string): Promise<WebsiteSettingResponse> {
    return this.settingService.findOne(this.validateKey(key))
  }

  @Put(':key')
  @RequirePermissions('setting:edit')
  async upsert(
    @Param('key') key: string,
    @Body() dto: SettingUpsertDto,
  ): Promise<WebsiteSettingResponse> {
    return this.settingService.upsert(this.validateKey(key), dto)
  }

  @Delete(':key')
  @RequirePermissions('setting:delete')
  async remove(@Param('key') key: string): Promise<null> {
    await this.settingService.remove(this.validateKey(key))
    return null
  }

  private validateKey(key: string): string {
    if (!/^[A-Za-z0-9][A-Za-z0-9:_-]{0,99}$/.test(key)) {
      throw new BadRequestException(
        '设置键仅支持字母、数字、冒号、下划线和连字符，且长度不超过 100',
      )
    }
    return key
  }
}
