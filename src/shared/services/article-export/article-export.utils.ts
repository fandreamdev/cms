export function formatArticleDate(value: Date): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Shanghai',
  }).format(value)
}

export function truncateText(value: string, maxLength: number): string {
  const normalized = value.trim()
  return normalized.length > maxLength
    ? `${normalized.slice(0, Math.max(1, maxLength - 1))}…`
    : normalized
}
