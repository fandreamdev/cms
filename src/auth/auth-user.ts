import { User } from '../shared/entities/user.entity'

export type AuthUser = User & {
  permissions: string[]
}
