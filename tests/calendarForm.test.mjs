import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'

const form = await importTs('lib/calendar/form.ts')
const view = await importTs('lib/calendar/view.ts')
const draft = (overrides = {}) => ({ title: 'Personal time', event_type: 'personal', calendar_id: '', start_date: '2026-03-08', end_date: '2026-03-08', start_time: '09:00', end_time: '09:30', timezone: 'America/Chicago', all_day: false, location: '', description: '', repeat: 'none', recurrence_text: '', repeat_count: '12', reminder: '', ...overrides })

test('calendar composer rejects the spring DST gap rather than silently changing the time', () => {
  assert.throws(() => form.eventPayloadFromDraft(draft({ start_time: '02:30', end_time: '03:30' })), /does not exist/)
})
test('calendar composer uses the chosen IANA time zone across DST changes', () => {
  assert.equal(form.eventPayloadFromDraft(draft()).start_at, '2026-03-08T14:00:00.000Z')
  assert.equal(form.eventPayloadFromDraft(draft({ start_date: '2026-03-07', end_date: '2026-03-07' })).start_at, '2026-03-07T15:00:00.000Z')
  assert.equal(form.eventPayloadFromDraft(draft({ timezone: 'Asia/Tokyo' })).start_at, '2026-03-08T00:00:00.000Z')
})
test('all-day calendar composer preserves local dates and exclusive ends across a 23-hour DST day', () => {
  const event = form.eventPayloadFromDraft(draft({ all_day: true }))
  assert.equal(event.start_date, '2026-03-08')
  assert.equal(event.end_date, '2026-03-09')
  assert.equal((Date.parse(event.end_at) - Date.parse(event.start_at)) / 3600000, 23)
})
test('Chicago fall daylight-saving fold uses the first occurrence and all-day dates span 25 hours', () => {
  const timed = form.eventPayloadFromDraft(draft({ start_date: '2026-11-01', end_date: '2026-11-01', start_time: '01:30', end_time: '02:30' }))
  assert.equal(timed.start_at, '2026-11-01T06:30:00.000Z')
  assert.equal(timed.end_at, '2026-11-01T08:30:00.000Z')
  const day = form.eventPayloadFromDraft(draft({ start_date: '2026-11-01', end_date: '2026-11-01', all_day: true }))
  assert.equal((Date.parse(day.end_at) - Date.parse(day.start_at)) / 3600000, 25)
})
test('all-day date authoring remains available when daylight saving skips midnight', () => {
  const event = form.eventPayloadFromDraft(draft({ all_day: true, timezone: 'America/Havana' }))
  assert.equal(event.start_date, '2026-03-08')
  assert.equal(event.end_date, '2026-03-09')
})
test('editing repeating calendar events preserves rules and multiple existing reminders', () => {
  const event = form.eventPayloadFromDraft(draft({ repeat: 'custom', recurrence_text: 'RRULE:FREQ=WEEKLY;COUNT=8\nEXDATE;TZID=America/Chicago:20260315T090000', reminder: '10,1440' }))
  assert.deepEqual(event.recurrence, ['RRULE:FREQ=WEEKLY;COUNT=8', 'EXDATE;TZID=America/Chicago:20260315T090000'])
  assert.deepEqual(event.reminders, [10, 1440])
})
test('Google calendar default reminders remain enabled when explicitly selected', () => {
  const event = form.eventPayloadFromDraft(draft({ reminder: 'default' }))
  assert.deepEqual(event.reminders, [])
  assert.equal(event.reminders_default, true)
})
test('multiday all-day appointments appear on each included date without shifting to the display zone', () => {
  const dates = view.visibleEventDates({ start_at: '2026-03-08T06:00:00.000Z', end_at: '2026-03-10T05:00:00.000Z', all_day: true, start_date: '2026-03-08', end_date: '2026-03-10' }, 'Pacific/Honolulu', '2026-03-01', '2026-04-01')
  assert.deepEqual(dates, ['2026-03-08', '2026-03-09'])
})
test('timed overnight appointments appear on both local days but an exclusive midnight end is not duplicated', () => {
  const overnight = { start_at: '2026-03-09T04:00:00.000Z', end_at: '2026-03-09T06:00:00.000Z', all_day: false }
  assert.deepEqual(view.visibleEventDates(overnight, 'America/Chicago', '2026-03-01', '2026-04-01'), ['2026-03-08', '2026-03-09'])
  assert.deepEqual(view.visibleEventDates({ ...overnight, end_at: '2026-03-09T05:00:00.000Z' }, 'America/Chicago', '2026-03-01', '2026-04-01'), ['2026-03-08'])
})
test('dashboard queries include every week day when the month begins on Sunday', () => {
  const range = view.calendarQueryDateRange('2026-11-01')
  assert.equal(range.start, '2026-10-26')
  for (const day of view.buildWeekDays('2026-11-01', [])) assert.ok(day.date >= range.start && day.date < range.end)
})
test('month navigation clamps long month-end dates rather than skipping the next month', () => {
  assert.equal(view.addMonths('2026-01-31', 1), '2026-02-28')
  assert.equal(view.addMonths('2028-01-31', 1), '2028-02-29')
  assert.equal(view.addMonths('2026-03-31', -1), '2026-02-28')
})
test('unconfirmed program recommendations retain their suggested label on the dashboard calendar', () => {
  const items = view.buildCalendarItems([{ id: 'recommendation', title: 'Workout', start_at: '2026-10-12T14:00:00Z', end_at: '2026-10-12T14:30:00Z', source: 'program', suggested: true, event_type: 'workout', status: 'scheduled' }])
  assert.equal(items[0].suggested, true)
})
