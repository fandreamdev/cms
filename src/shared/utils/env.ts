export function env<T>(key: string, transfer?: (source: string) => T) {
  const source = process.env[key]
  if (source === undefined || source === null) {
    return source
  }
  if (transfer) {
    return transfer(source)
  }
  return source
}

export function envString(key: string, defaultValue?: string) {
  return env(key) ?? defaultValue
}

export function envBoolean(key: string) {
  return env<boolean>(key, (source: string) => {
    if (!source) {
      return false
    }
    return source.toUpperCase() === 'TRUE'
  })
}

export function envNumber(key: string, defaultValue?: number) {
  try {
    return env<number>(key, Number) ?? defaultValue
  } catch (err: any) {
    console.error(err)
    throw new Error(`${key} is not a number`)
  }
}
