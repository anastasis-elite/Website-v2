type RecordedPeriodStart = { log_date?: unknown; period_started?: unknown }

const calendarDayMilliseconds = 86_400_000

function calendarDay(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const parsed = new Date(`${value}T00:00:00Z`)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return null
  return parsed.getTime() / calendarDayMilliseconds
}

export function periodContextWindowStart(today: string): string | null {
  const day = calendarDay(today)
  return day === null ? null : new Date((day - 7) * calendarDayMilliseconds).toISOString().slice(0, 10)
}

// These are recorded calendar dates, not predicted cycle phases or elapsed hours.
export function hasRecentRecordedPeriodStart(
  today: string,
  fallbackLastPeriodStart: unknown,
  logs: RecordedPeriodStart[] = [],
): boolean {
  const todayDay = calendarDay(today)
  if (todayDay === null) return false
  const recordedDates = [fallbackLastPeriodStart, ...logs.filter(log => log.period_started === true).map(log => log.log_date)]
  return recordedDates.some(value => {
    const startDay = calendarDay(value)
    if (startDay === null) return false
    const difference = todayDay - startDay
    return difference >= 0 && difference <= 7
  })
}
