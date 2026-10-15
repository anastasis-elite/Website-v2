export type BusyInterval = { start_at: string; end_at: string; busy?: boolean; suggested?: boolean }
export type PreferredHours = { start: number; end: number; bufferMinutes: number }

/** Device-local dates preserve wall-clock preferred hours across DST changes. */
export function suggestOpenings(
  date: Date,
  durationMinutes: number,
  events: BusyInterval[],
  preferred: PreferredHours,
  now = new Date(),
) {
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0 || durationMinutes > 1440) return []
  if (preferred.start < 0 || preferred.end > 24 || preferred.start >= preferred.end || preferred.bufferMinutes < 0) return []
  const start = new Date(date); start.setHours(preferred.start, 0, 0, 0)
  const end = new Date(date); end.setHours(preferred.end, 0, 0, 0)
  const duration = durationMinutes * 60000
  const buffer = preferred.bufferMinutes * 60000
  const busy = events.filter((event) => event.busy !== false && !event.suggested).map((event) => ({
    start: Date.parse(event.start_at) - buffer,
    end: Date.parse(event.end_at) + buffer,
  })).filter((event) => Number.isFinite(event.start) && event.end > event.start).sort((a, b) => a.start - b.start)
  let cursor = Math.max(start.getTime(), now.getTime())
  cursor = Math.ceil(cursor / 900000) * 900000
  const slots: { start_at: string; end_at: string }[] = []
  while (cursor + duration <= end.getTime() && slots.length < 5) {
    const conflict = busy.find((event) => event.start < cursor + duration && event.end > cursor)
    if (conflict) cursor = Math.ceil(conflict.end / 900000) * 900000
    else {
      slots.push({ start_at: new Date(cursor).toISOString(), end_at: new Date(cursor + duration).toISOString() })
      cursor += Math.max(duration, 30 * 60000)
    }
  }
  return slots
}

export function occurrenceKey(event: { id: string; start_at: string }) {
  return `${event.id}:${event.start_at}`
}

/** An explicit canonical-calendar mapping avoids unreliable title/time matching. */
export function shouldSuppressDeviceCalendar(
  calendarId: string,
  cloudMappings: Record<string, string>,
  cloudCalendars: string[],
) {
  const mapped = cloudMappings[calendarId]
  return Boolean(mapped && cloudCalendars.includes(mapped))
}

export function validateEventTimes(start: string, end: string, timezone: string) {
  try { new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date()) }
  catch { throw new Error('Enter a valid IANA time zone, such as America/Chicago.') }
  const parse = (value: string) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)
    ? wallTimeToDate(value.slice(0, 10), value.slice(11), timezone) : new Date(value)
  const startDate = parse(start); const endDate = parse(end)
  if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime()) || endDate <= startDate) {
    throw new Error('Enter valid dates with the end after the start.')
  }
  return { startDate, endDate }
}

export function dateInZone(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  const get = (type: string) => parts.find((part) => part.type === type)?.value
  return `${get('year')}-${get('month')}-${get('day')}`
}

export function timeInZone(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date)
  return `${parts.find((part) => part.type === 'hour')?.value}:${parts.find((part) => part.type === 'minute')?.value}`
}

export function wallDateTime(date: Date, timezone: string) { return `${dateInZone(date, timezone)}T${timeInZone(date, timezone)}` }

/** Chosen IANA zone determines the instant. Reject DST gaps; choose first instant in folds. */
export function wallTimeToDate(date: string, time: string, timezone: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Enter a valid date and time.')
  const nominal = new Date(`${date}T${time}:00Z`)
  if (!Number.isFinite(nominal.getTime()) || nominal.toISOString().slice(0, 10) !== date) throw new Error('Enter a valid date.')
  const offsets = new Set([-2, 0, 2].map((days) => {
    const instant = new Date(nominal.getTime() + days * 86400000)
    const local = new Date(`${wallDateTime(instant, timezone)}:00Z`)
    return (local.getTime() - instant.getTime()) / 60000
  }))
  const candidates = [...offsets].map((offset) => new Date(nominal.getTime() - offset * 60000))
    .filter((instant) => wallDateTime(instant, timezone) === `${date}T${time}`)
    .sort((a, b) => a.getTime() - b.getTime())
  if (!candidates.length) throw new Error('That time does not exist because of a daylight saving change. Choose another time.')
  return candidates[0]
}

/** Resolve a civil all-day date to its first valid instant (including midnight DST gaps). */
export function calendarDayToDate(value: string, timezone: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Enter all-day dates as YYYY-MM-DD.')
  const nominal = new Date(`${value}T00:00:00Z`)
  if (!Number.isFinite(nominal.getTime()) || nominal.toISOString().slice(0, 10) !== value) throw new Error('Enter a valid calendar date.')
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' })
  for (let offset = -16 * 60; offset <= 36 * 60; offset++) {
    const candidate = new Date(nominal.getTime() + offset * 60000)
    const parts = formatter.formatToParts(candidate)
    const get = (type: string) => parts.find((part) => part.type === type)?.value
    if (`${get('year')}-${get('month')}-${get('day')}` === value) return candidate
  }
  throw new Error('This date does not exist in the selected time zone.')
}
