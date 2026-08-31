/**
 * Journal date utilities
 * Handles date parsing and timezone-aware calendar calculations.
 */

export function getTodayInTimezone(tz: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  )

  return `${values.year}-${values.month}-${values.day}`
}

export function getMonthFromDate(dateStr: string): string {
  return dateStr.slice(0, 7)
}

/**
 * Return the Sunday which begins the current Journal Week in the supplied
 * environment timezone.
 */
export function getCurrentWeekStart(tz: string): string {
  const localDate = getTodayInTimezone(tz)
  const date = new Date(`${localDate}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() - date.getUTCDay())
  return date.toISOString().slice(0, 10)
}

/**
 * Return the inclusive Sunday-Saturday bounds for a valid Journal Week start.
 */
export function getWeekBounds(weekStart: string): { start: string; end: string } {
  const start = new Date(`${weekStart}T00:00:00Z`)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 6)

  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  }
}

export function addDays(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function getMonthBounds(monthStr: string): { start: string; end: string } {
  const [year, month] = monthStr.split('-')
  const start = new Date(`${year}-${month}-01T00:00:00Z`)
  const end = new Date(parseInt(year, 10), parseInt(month, 10), 0)
  
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  }
}

export function isValidDate(dateStr: string): boolean {
  const match = /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
  if (!match) return false
  
  const date = new Date(`${dateStr}T00:00:00Z`)
  return date.toISOString().startsWith(dateStr)
}

export function isValidWeekStart(dateStr: string): boolean {
  return (
    isValidDate(dateStr) &&
    new Date(`${dateStr}T00:00:00Z`).getUTCDay() === 0
  )
}

export function formatDateForDisplay(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00Z`)
  return date.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatWeekRangeForDisplay(weekStart: string): string {
  const { start, end } = getWeekBounds(weekStart)
  const dateFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return `Week of ${dateFormatter.format(new Date(`${start}T00:00:00Z`))} – ${dateFormatter.format(new Date(`${end}T00:00:00Z`))}`
}

export function getCurrentMonth(tz?: string): string {
  if (tz) {
    return getTodayInTimezone(tz).slice(0, 7)
  }

  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}
