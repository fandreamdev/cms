/** 把数字补足两位（个位数前面补 0） */
function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

/**
 * Handlebars 日期格式化 helper，输出 `YYYY-MM-DD HH:mm:ss`。
 * 接受 Date、时间戳或可被 Date 解析的字符串；无效值返回空串。
 */
export function formatDate(value: unknown): string {
  if (value === undefined || value === null || value === '') return ''
  const date =
    value instanceof Date ? value : new Date(value as string | number)
  if (Number.isNaN(date.getTime())) return ''
  const y = date.getFullYear()
  const m = pad(date.getMonth() + 1)
  const d = pad(date.getDate())
  const hh = pad(date.getHours())
  const mm = pad(date.getMinutes())
  const ss = pad(date.getSeconds())
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`
}
