import assert from 'node:assert/strict'
import test, { after, mock } from 'node:test'
import { importTs } from './typescriptModule.mjs'

const now = Date.parse('2026-10-15T19:51:00Z'), date = '2026-10-15'
mock.timers.enable({ apis: ['Date'], now })
after(() => mock.timers.reset())
const { mutatePersistedScheduleEvent, mutateVirtualScheduleEvent, dismissScheduleEvent } = await importTs('lib/schedule/mutations.ts', {
  '@/lib/schedule/service': `export const getDailyScheduleState = async () => structuredClone(globalThis.securityScheduleState)`,
})
const task = extra => ({ id: 'task', user_id: 'owner', client_id: 'client', title: 'School drop-off',
  event_type: 'school', source: 'manual', status: 'scheduled', completed_at: null,
  start_at: '2026-10-15T13:00:00Z', end_at: '2026-10-15T13:30:00Z', timezone: 'America/Chicago',
  required: true, flexibility_type: 'flexible', movable: true, approval_required: false,
  reschedule_allowed: true, reschedule_requires_approval: false, updated_at: '2026-10-15T12:00:00Z', ...extra })
function fixture(extra = {}, initialOnboarding = {}) {
  const row = task(extra), client = { client_id: 'client', auth_user_id: 'owner', timezone: 'America/Chicago', onboarding_data: structuredClone(initialOnboarding) }
  const writes = [], comparisons = []
  const db = { beforeClientWrite: null, from(table) {
    let change
    const filters = []
    const result = () => {
      if (change && table === 'clients' && db.beforeClientWrite) {
        const callback = db.beforeClientWrite; db.beforeClientWrite = null; callback(client)
      }
      const target = table === 'clients' ? client : row
      const match = filters.every(([key, value]) => key === 'onboarding_data' && typeof value === 'string'
        ? JSON.stringify(target[key]) === value : target[key] == null && value == null ? true : target[key] === value)
      if (change) comparisons.push({ table, filters: structuredClone(filters), match })
      if (match && change) { writes.push({ table, change: structuredClone(change) }); Object.assign(target, structuredClone(change)) }
      return { data: match ? structuredClone(target) : null, error: null }
    }
    const q = { select() { return q }, update(value) { change = value; return q },
      eq(key, value) { filters.push([key, value]); return q }, is(key, value) { filters.push([key, value]); return q },
      async maybeSingle() { return result() } }
    return q
  } }
  globalThis.securityScheduleState = { date, events: [structuredClone(row)], unavailableSources: [], preferences: { transitionMinutes: 10 } }
  const context = { supabase: db, user: { id: 'owner' }, client: structuredClone(client) }
  return { row, client, db, writes, comparisons, context }
}
const move = { start_at: '2026-10-15T22:00:00Z', end_at: '2026-10-15T22:30:00Z' }
const rejects = (promise, status = 409) => assert.rejects(promise, error => error.status === status)

test('two time changes with unchanged scheduled status cannot both win, including legacy NULL updated_at rows', async () => {
  for (const updated_at of [null, '2026-10-15T12:00:00Z']) {
    const f = fixture({ updated_at })
    const results = await Promise.allSettled([
      mutatePersistedScheduleEvent(f.context, 'task', 'move', move),
      mutatePersistedScheduleEvent(f.context, 'task', 'move', { start_at: '2026-10-15T23:00:00Z', end_at: '2026-10-15T23:30:00Z' }),
    ])
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
    assert.equal(results.find(result => result.status === 'rejected').reason.status, 409)
    assert.equal(f.writes.length, 1)
    assert.equal(f.row.status, 'scheduled')
    assert.ok(f.comparisons.every(value => value.filters.some(([key, value]) => key === 'updated_at' && value === updated_at)))
  }
})

test('virtual outcome CAS preserves a concurrent preference change and rejects a concurrent move of the same occurrence', async () => {
  let f = fixture({ virtual: true }, { kept: 'original', scheduleOverrides: { other: { status: 'skipped' } } })
  f.db.beforeClientWrite = row => { row.onboarding_data.preference = 'saved on another screen' }
  await mutateVirtualScheduleEvent(f.context, { eventId: 'task', date, action: 'complete' })
  assert.equal(f.client.onboarding_data.kept, 'original')
  assert.equal(f.client.onboarding_data.preference, 'saved on another screen')
  assert.equal(f.client.onboarding_data.scheduleOverrides.other.status, 'skipped')
  assert.equal(f.client.onboarding_data.scheduleOverrides.task.status, 'completed')
  assert.equal(f.comparisons.length, 2)

  f = fixture({ virtual: true })
  const otherMove = { status: 'scheduled', adjusted_start_at: move.start_at, adjusted_end_at: move.end_at, updated_at: new Date(now).toISOString() }
  f.db.beforeClientWrite = row => { row.onboarding_data.scheduleOverrides = { task: otherMove } }
  await rejects(mutateVirtualScheduleEvent(f.context, { eventId: 'task', date, action: 'skip' }))
  assert.deepEqual(f.client.onboarding_data.scheduleOverrides.task, otherMove)
  assert.equal(f.writes.length, 0)
})

test('all reschedule boundaries and incomplete source reads fail before persistence', async () => {
  for (const [extra, body] of [
    [{ earliest_start_at: '2026-10-15T22:15:00Z' }, move],
    [{ latest_end_at: '2026-10-15T22:15:00Z' }, move],
    [{ reschedule_requires_approval: true }, move],
    [{ reschedule_allowed: false }, move],
    [{ virtual: true }, { start_at: '2026-10-16T22:00:00Z', end_at: '2026-10-16T22:30:00Z' }],
    [{ virtual: true }, { start_at: '2026-10-16T04:50:00Z', end_at: '2026-10-16T05:10:00Z' }],
  ]) {
    const f = fixture(extra)
    const promise = extra.virtual ? mutateVirtualScheduleEvent(f.context, { ...body, eventId: 'task', date, action: 'move' })
      : mutatePersistedScheduleEvent(f.context, 'task', 'move', body)
    await assert.rejects(promise, error => [400, 409].includes(error.status))
    assert.equal(f.writes.length, 0)
  }
  const f = fixture()
  globalThis.securityScheduleState.unavailableSources = ['calendar']
  await rejects(mutatePersistedScheduleEvent(f.context, 'task', 'move', move), 503)
  assert.equal(f.writes.length, 0)
})

test('health and every external identity marker prevent false completion; only informational events allow dismissal', async () => {
  for (const extra of [
    { event_type: 'assessment' }, { event_type: 'check_in' }, { event_type: 'workout' },
    { event_type: 'workout', status: 'completed' },
    { calendar_event_id: 'calendar-occurrence', status: 'completed' },
    { calendar_event_id: 'calendar-occurrence' }, { source: 'external_calendar' },
    { external_event_id: 'external-id' }, { external_calendar_source: 'Google' },
  ]) {
    const f = fixture(extra)
    await rejects(mutatePersistedScheduleEvent(f.context, 'task', 'complete'))
    assert.equal(f.writes.length, 0)
  }
  const f = fixture()
  await rejects(dismissScheduleEvent(f.context, { eventId: 'task', date }))
  await rejects(dismissScheduleEvent(f.context, { eventId: 'another-members-event', date }), 404)
  assert.equal(f.writes.length, 0)
})
