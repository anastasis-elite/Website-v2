import { getLocalParts, zonedDateTimeToUtc } from '@/lib/schedule/time'
import { addLocalDays } from '@/lib/timezone'

export type CalendarEventDraft = {
  title: string; event_type: string; calendar_id: string; start_date: string; end_date: string
  start_time: string; end_time: string; timezone: string; all_day: boolean; location: string; description: string
  repeat: string; recurrence_text: string; repeat_count: string; reminder: string
}

export function dateTimeInZone(value: string, timezone: string) {
  const parts = getLocalParts(new Date(value), timezone)
  return { date: [parts.year, parts.month, parts.day].map((part, index) => String(part).padStart(index === 0 ? 4 : 2, '0')).join('-'), time: `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}` }
}

export function checkedZonedDateTime(date: string, time: string, timezone: string) {
  const converted = zonedDateTimeToUtc(date, time, timezone)
  const local = dateTimeInZone(converted.toISOString(), timezone)
  if (local.date !== date || local.time !== time) throw new Error('That local time does not exist because the clocks change. Choose another time.')
  return converted.toISOString()
}

export function eventPayloadFromDraft(draft: CalendarEventDraft) {
  if (!draft.title.trim()) throw new Error('Add an event title.')
  const endDate = draft.all_day ? addLocalDays(draft.end_date, 1) : draft.end_date
  // All-day events use civil dates, including days whose clock skips midnight.
  const startAt = draft.all_day ? zonedDateTimeToUtc(draft.start_date, '00:00', draft.timezone).toISOString() : checkedZonedDateTime(draft.start_date, draft.start_time, draft.timezone)
  const endAt = draft.all_day ? zonedDateTimeToUtc(endDate, '00:00', draft.timezone).toISOString() : checkedZonedDateTime(endDate, draft.end_time, draft.timezone)
  if (draft.all_day ? endDate <= draft.start_date : endAt <= startAt) throw new Error('The event must end after it starts.')
  const count = Number(draft.repeat_count)
  if (draft.repeat !== 'none' && draft.repeat !== 'custom' && (!Number.isInteger(count) || count < 2 || count > 500)) throw new Error('Choose a repeat count between 2 and 500.')
  const recurrence = draft.repeat === 'none' ? [] : draft.repeat === 'custom' ? draft.recurrence_text.split('\n').map(line => line.trim()).filter(Boolean) : [`RRULE:FREQ=${draft.repeat.toUpperCase()};COUNT=${count}`]
  if (draft.repeat === 'custom' && !recurrence.some(line => line.startsWith('RRULE:'))) throw new Error('Enter a recurrence rule beginning with RRULE:.')
  const reminders = draft.reminder === '' || draft.reminder === 'default' ? [] : draft.reminder.split(',').map(value => Number(value.trim()))
  if (reminders.some(minutes => !Number.isInteger(minutes) || minutes < 0 || minutes > 40320)) throw new Error('Choose valid reminder minutes.')
  return {
    title: draft.title.trim(), event_type: draft.event_type, calendar_id: draft.calendar_id || null,
    start_at: startAt, end_at: endAt, timezone: draft.timezone, all_day: draft.all_day,
    start_date: draft.all_day ? draft.start_date : null, end_date: draft.all_day ? endDate : null,
    location: draft.location.trim() || null, description: draft.description.trim() || null,
    recurrence, reminders, reminders_default: draft.reminder === 'default',
  }
}
