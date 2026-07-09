import { Access } from '../../entities/access.entity'

export function stripParentRelations(list: Access[]): Access[] {
  return list.map((item) => {
    const normalized = {
      ...item,
      children: stripParentRelations(item.children ?? []),
    }
    normalized.parent = undefined as unknown as null
    return normalized
  })
}
