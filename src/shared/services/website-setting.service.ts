import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { SettingUpsertDto } from '../../api/dto/setting/setting-upsert.dto'
import {
  WebsiteSetting,
  WebsiteSettingDocument,
} from '../schemas/website-setting.schema'

export interface WebsiteSettingResponse {
  id: string
  key: string
  value: unknown
  isPublic: boolean
  description: string | null
  createdAt: Date
  updatedAt: Date
}

@Injectable()
export class WebsiteSettingService {
  constructor(
    @InjectModel(WebsiteSetting.name)
    private readonly settingModel: Model<WebsiteSetting>,
  ) {}

  async findAll(): Promise<WebsiteSettingResponse[]> {
    const settings = await this.settingModel.find().sort({ key: 1 }).exec()
    return settings.map((setting) => this.toResponse(setting))
  }

  async findOne(key: string): Promise<WebsiteSettingResponse> {
    const setting = await this.settingModel.findOne({ key }).exec()
    if (!setting) throw new NotFoundException('网站设置不存在')
    return this.toResponse(setting)
  }

  async upsert(
    key: string,
    dto: SettingUpsertDto,
  ): Promise<WebsiteSettingResponse> {
    const values: Record<string, unknown> = { value: dto.value }
    if (dto.isPublic !== undefined) values.isPublic = dto.isPublic
    if (Object.hasOwn(dto, 'description'))
      values.description = dto.description ?? null

    const setting = await this.settingModel
      .findOneAndUpdate(
        { key },
        { $set: values },
        {
          returnDocument: 'after',
          upsert: true,
          runValidators: true,
          setDefaultsOnInsert: true,
        },
      )
      .exec()

    return this.toResponse(setting)
  }

  async remove(key: string): Promise<void> {
    const result = await this.settingModel.deleteOne({ key }).exec()
    if (!result.deletedCount) throw new NotFoundException('网站设置不存在')
  }

  async findPublicValues(): Promise<Record<string, unknown>> {
    const settings = await this.settingModel
      .find({ isPublic: true })
      .select({ key: 1, value: 1 })
      .sort({ key: 1 })
      .lean()
      .exec()

    return Object.fromEntries(
      settings.map((setting) => [setting.key, setting.value]),
    )
  }

  private toResponse(setting: WebsiteSettingDocument): WebsiteSettingResponse {
    return {
      id: setting.id,
      key: setting.key,
      value: setting.value,
      isPublic: setting.isPublic,
      description: setting.description ?? null,
      createdAt: setting.createdAt,
      updatedAt: setting.updatedAt,
    }
  }
}
