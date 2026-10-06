export function isValidTimeZone(timeZone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone })
    return true
  } catch {
    return false
  }
}

export function localDateInTimeZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function weekStartForDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  const value = new Date(Date.UTC(year!, month! - 1, day!))
  const offset = (value.getUTCDay() + 6) % 7
  value.setUTCDate(value.getUTCDate() - offset)
  return value.toISOString().slice(0, 10)
}

export function addDaysToDate(value: string, days: number): string {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year!, month! - 1, day!))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year!, month! - 1, day!))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month! - 1 && date.getUTCDate() === day
}

export function formatDateOnly(value: string): string {
  if (!isValidDateOnly(value)) return value
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat(undefined, {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(Date.UTC(year!, month! - 1, day!)))
}

export function dateOnlyParts(value: string): { month: string; day: string } {
  const [, month, day] = value.split('-')
  const monthLabel = new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' })
    .format(new Date(Date.UTC(2000, Number(month) - 1, 1)))
  return { month: monthLabel, day: String(Number(day)) }
}
