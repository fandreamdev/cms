import { NotFoundException } from '@nestjs/common'

export function ensureFound<T>(
  entity: T | null | undefined,
  message: string,
): T {
  if (!entity) {
    throw new NotFoundException(message)
  }
  return entity
}
