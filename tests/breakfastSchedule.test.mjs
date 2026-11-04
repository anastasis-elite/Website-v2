import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'

const { breakfastScheduleEventForDate } = await importTs('lib/schedule/dailyPlanAdapter.ts')
const { localDateKey } = await importTs('lib/timezone.ts')
const { getActionRouteForEvent } = await importTs('lib/schedule/engine.ts')
const { applyScheduleCheckoffs } = await importTs('lib/schedule/checkoffs.ts')
const { getDailyScheduleState } = await importTs('lib/schedule/service.ts', {
  '@/lib/calendar/service': 'export const importedScheduleEvents = async () => []',
  '@/lib/day/getDailyExecutionPlan': 'export const getDailyExecutionPlan = async () => ({ date: "2026-11-04", timing: {} })',
  '@/lib/dashboard/logic/getProgramLogicForClient': 'export const getProgramLogicForClient = async () => null',
})
const client = { client_id: 'SYNTHETIC-BREAKFAST', timezone: 'America/New_York',
  onboarding_data: { routinePreferences: { revision: 1, answers: { breakfast_window_time: '07:30' } } } }
const eventsFor = (date, extra = {}) => breakfastScheduleEventForDate({ userId: 'owner', client, date, timezone: client.timezone, ...extra })

test('optional breakfast projects a local-day attendance occurrence across DST and distant timezones', () => {
  for (const [date, timezone, expected] of [
    ['2026-03-08', 'America/New_York', '2026-03-08T11:30:00.000Z'],
    ['2026-11-01', 'America/New_York', '2026-11-01T12:30:00.000Z'],
    ['2026-11-04', 'Pacific/Kiritimati', '2026-11-03T17:30:00.000Z'],
    ['2026-11-04', 'Pacific/Honolulu', '2026-11-04T17:30:00.000Z'],
  ]) {
    const [event] = eventsFor(date, { timezone })
    assert.equal(event.id, `virtual-breakfast-${date}`)
    assert.equal(event.start_at, expected)
    assert.equal(localDateKey(new Date(event.start_at), timezone), date)
    assert.equal(event.status, 'scheduled', 'elapsed time is not breakfast evidence')
    assert.equal(event.completed_at, null)
    assert.equal(event.schedule_response_kind, 'breakfast')
    assert.equal(event.event_type, 'meal')
    assert.equal(getActionRouteForEvent(event), `/dashboard/schedule?date=${date}#event-${event.id}`)
    assert.equal(Object.keys(event).some(key => /calories|protein|carbs|fat|meal_entry/.test(key)), false)
  }
  assert.deepEqual(eventsFor('2026-11-04', { client: { ...client, onboarding_data: {} } }), [])
})

test('breakfast identity survives routine time edits and selected-day projection does not depend on today’s health plan', async () => {
  const before = eventsFor('2026-11-04')[0]
  const changed = structuredClone(client)
  changed.onboarding_data.routinePreferences.answers.breakfast_window_time = '08:15'
  assert.equal(eventsFor('2026-11-04', { client: changed })[0].id, before.id)
  const writes = []
  const supabase = { from(table) {
    assert.ok(['client_schedule_blocks', 'anastasis_schedule_events', 'schedule_occurrence_checkoffs'].includes(table))
    const query = { select() { return query }, eq() { return query }, or() { return query }, order() { return query },
      update(value) { writes.push(value); return query },
      then(resolve, reject) { return Promise.resolve({ data: [], error: null }).then(resolve, reject) } }
    return query
  } }
  for (const date of ['2026-11-03', '2026-11-04', '2026-11-05']) {
    const state = await getDailyScheduleState({ supabase, user: { id: 'owner' }, client, date, includeVirtualPlan: false })
    assert.equal(state.events.filter(event => event.id === `virtual-breakfast-${date}`).length, 1)
    assert.equal(state.events.find(event => event.id === `virtual-breakfast-${date}`).schedule_date, date)
  }
  assert.equal(writes.length, 0, 'projection never writes intake, profile or completion evidence')
})

test('completed breakfast retains saved occurrence timing after anchor edits or removal, without accepting arbitrary snapshot fields', () => {
  const date = '2026-11-04', [original] = eventsFor(date)
  const row = { user_id: 'owner', client_id: client.client_id, occurrence_date: date, event_id: original.id,
    completed: true, response_status: 'completed', completed_at: '2026-11-04T13:10:00Z', revision: 1,
    occurrence_snapshot: { id: original.id, title: original.title, start_at: original.start_at, end_at: original.end_at,
      timezone: original.timezone, schedule_date: date, schedule_response_kind: 'breakfast',
      action_route: 'https://arbitrary.invalid', external_calendar_source: 'injected', calories: 999 },
  }
  const changed = structuredClone(client)
  changed.onboarding_data.routinePreferences.answers.breakfast_window_time = '09:00'
  for (const chosen of [changed, { ...client, onboarding_data: {} }]) {
    const events = eventsFor(date, { client: chosen, checkoffs: [row] })
    assert.equal(events.length, 1)
    assert.equal(events[0].start_at, original.start_at)
    assert.equal(events[0].end_at, original.end_at)
    assert.equal(events[0].external_calendar_source, null)
    assert.equal(events[0].calories, undefined)
    assert.equal(getActionRouteForEvent(events[0]), `/dashboard/schedule?date=${date}#event-${original.id}`)
    const saved = applyScheduleCheckoffs(events, [row])[0]
    assert.equal(saved.status, 'completed')
    assert.equal(saved.completed_at, row.completed_at)
  }
  const progress = { ...row, completed: false, response_status: 'in_progress', completed_at: null }
  assert.equal(eventsFor(date, { client: changed, checkoffs: [progress] })[0].start_at,
    '2026-11-04T14:00:00.000Z', 'in-progress follows the current accepted anchor')
  for (const corrupt of [
    { ...row, user_id: 'other' }, { ...row, client_id: 'other' }, { ...row, occurrence_date: '2026-11-05' },
    { ...row, occurrence_snapshot: { ...row.occurrence_snapshot, id: 'not-breakfast' } },
    { ...row, occurrence_snapshot: { ...row.occurrence_snapshot, timezone: 'invalid' } },
    { ...row, occurrence_snapshot: { ...row.occurrence_snapshot, start_at: '2026-11-05T14:00:00Z', end_at: '2026-11-05T14:30:00Z' } },
  ]) assert.deepEqual(eventsFor(date, { client: { ...client, onboarding_data: {} }, checkoffs: [corrupt] }), [])
})
