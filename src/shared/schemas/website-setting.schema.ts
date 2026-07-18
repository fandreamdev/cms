import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument, SchemaTypes } from 'mongoose'

export type WebsiteSettingDocument = HydratedDocument<WebsiteSetting>

/**
 * A key/value store for site-wide configuration. The value is intentionally
 * schema-free so new setting types do not require a database migration.
 */
@Schema({
  collection: 'website_settings',
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  versionKey: false,
})
export class WebsiteSetting {
  @Prop({ required: true, unique: true, trim: true, maxlength: 100 })
  key!: string

  @Prop({ type: SchemaTypes.Mixed, required: true })
  value!: unknown

  @Prop({ default: false, index: true })
  isPublic!: boolean

  @Prop({ type: String, default: null, trim: true, maxlength: 500 })
  description!: string | null

  createdAt!: Date
  updatedAt!: Date
}

export const WebsiteSettingSchema = SchemaFactory.createForClass(WebsiteSetting)
WebsiteSettingSchema.index({ updatedAt: -1, key: 1 })
WebsiteSettingSchema.index({ createdAt: 1 })
