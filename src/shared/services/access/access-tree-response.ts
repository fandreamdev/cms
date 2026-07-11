import { Access } from '../../entities/access.entity'

export function stripParentRelations(list: Access[]): Access[] {
  return list.map((item) => {
    const normalized = {
      ...item,
      parentId: item.parent?.id ?? item.parentId ?? null,
      children: stripParentRelations(item.children ?? []),
    }
    normalized.parent = undefined as unknown as null
    return normalized
  })
}
