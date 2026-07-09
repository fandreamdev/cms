import { AccessType } from '../../enum/access.enum'

export type AccessPayload = {
  type?: AccessType
  url?: string
  description?: string
  parentId?: number | null
}
