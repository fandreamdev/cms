import { Transform } from 'class-transformer'

export function EmptyStringToUndefined() {
  return Transform(({ value }: { value: unknown }) =>
    value === '' ? undefined : value,
  )
}
