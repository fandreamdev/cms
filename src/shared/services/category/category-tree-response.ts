import { Category } from '../../entities/category.entity'

export function stripParentRelations(list: Category[]): Category[] {
  return list.map((item) => {
    const normalized = {
      ...item,
      children: stripParentRelations(item.children ?? []),
    }
    normalized.parent = undefined as unknown as null
    return normalized
  })
}
