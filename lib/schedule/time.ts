import { addLocalDays, getClientLocalDate, getClientTimeZone } from '@/lib/timezone'

export function getLocalParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const value = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value || 0)

  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour') % 24,
    minute: value('minute'),
    second: value('second'),
  }
}

function getOffsetMinutes(date: Date, timeZone: string) {
  const parts = getLocalParts(date, timeZone)
  const localAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  )

  return Math.round((localAsUtc - date.getTime()) / 60000)
}

export function zonedDateTimeToUtc(
  date: string,
  time: string,
  timeZone: string,
) {
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  const firstPass = new Date(Date.UTC(year, month - 1, day, hour, minute || 0))
  // Sample both sides of a transition. A two-pass offset correction can oscillate
  // around a nonexistent midnight and accidentally put an all-day event on yesterday.
  const offsets = new Set([-2, 0, 2].map(days =>
    getOffsetMinutes(new Date(firstPass.getTime() + days * 86400000), timeZone),
  ))
  const candidates = [...offsets].map(offset => {
    const instant = new Date(firstPass.getTime() - offset * 60000)
    const local = getLocalParts(instant, timeZone)
    const wallTime = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second)
    return { instant, wallTime }
  })
  const exact = candidates.filter(candidate => candidate.wallTime === firstPass.getTime())
    .sort((a, b) => a.instant.getTime() - b.instant.getTime())
  if (exact.length) return exact[0].instant
  // Match civil-time "compatible" disambiguation: move forward through gaps.
  // Timed-event forms still reject a gap by checking the returned local time.
  const forward = candidates.filter(candidate => candidate.wallTime > firstPass.getTime())
    .sort((a, b) => a.wallTime - b.wallTime || a.instant.getTime() - b.instant.getTime())
  return (forward[0] || candidates[0]).instant
}

export function getClientDayRange(client: any, date?: string) {
  const timezone = getClientTimeZone(client)
  const localDate = date || getClientLocalDate(client)
  const start = zonedDateTimeToUtc(localDate, '00:00', timezone)
  const nextStart = zonedDateTimeToUtc(addLocalDays(localDate, 1), '00:00', timezone)

  return {
    date: localDate,
    timezone,
    start,
    end: nextStart,
  }
}

export function formatLocalTime(value: string | null, timeZone: string) {
  if (!value) return ''
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}
