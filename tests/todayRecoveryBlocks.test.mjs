import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'

const { recoveryCompletionEvidence, getRecoveryPresentation } = await importTs('lib/recovery/todayCompletion.ts')
const { loadProgramLogicInputs } = await importTs('lib/dashboard/logic/loadProgramLogicInputs.ts')
const owner = 'recovery-owner', other = 'other-owner', clientId = 'RECOVERY-OWNED', date = '2026-11-02'
const instant = time => `${date}T${time}:00.000Z`
const record = (time, extra = {}) => ({ user_id: owner, client_id: clientId, log_date: date, created_at: time ? instant(time) : null,
  activity_type: 'Meditation', duration_minutes: 10, ...extra })
const event = (id, start = '09:00', end = '10:00', extra = {}) => ({ id, user_id: owner, client_id: clientId,
  event_type: 'recovery', start_at: instant(start), end_at: instant(end), adjusted_start_at: null, adjusted_end_at: null,
  status: 'scheduled', all_day: false, schedule_date: date, ...extra })
const evidence = rows => recoveryCompletionEvidence({ userId: owner, clientId, date, rows })
const schedule = (events, now = '09:30', extra = {}) => ({ date, now: instant(now), events, ...extra })
const project = (events, rows, now, extra) => getRecoveryPresentation({ evidence: evidence(rows), schedule: schedule(events, now, extra) })

test('morning completion hides only its current distinct event and a later due block returns', () => {
  const events = [event('morning'), event('evening', '18:00', '19:00')], rows = [record('09:15')]
  const morning = project(events, rows, '09:30')
  assert.deepEqual(morning, { state: 'completed', complete: true, eventId: 'morning', nextRefreshAt: instant('18:00') })
  assert.equal(project(events, rows, '17:59').state, 'completed')
  assert.deepEqual(project(events, rows, '18:00'), { state: 'due', complete: false, eventId: 'evening', nextRefreshAt: null })
  assert.equal(project(events, [...rows, record('18:15')], '18:20').state, 'completed')
  assert.equal(rows.length, 1, 'Presentation does not rewrite daily history or its existing day-complete evidence.')
})

test('timestamp attribution uses effective half-open windows and never spends one record on later events', () => {
  const events = [event('morning'), event('adjacent', '10:00', '11:00')]
  assert.equal(project(events, [record('10:00')], '09:59').state, 'due', 'A future timestamp cannot complete the current block.')
  assert.equal(project(events, [record('10:00')], '10:00').eventId, 'adjacent')
  assert.equal(project(events, [record('10:00')], '10:00').complete, true)
  assert.equal(project([event('morning')], [record('10:00')], '10:00').complete, false, 'The exact end belongs outside the earlier block.')
  const moved = event('moved', '09:00', '10:00', { adjusted_start_at: instant('14:00'), adjusted_end_at: instant('15:00') })
  assert.equal(project([moved], [record('09:15')], '14:30').complete, false)
  assert.equal(project([moved], [record('14:15')], '14:30').complete, true)
})

test('saved completed, skipped and deferred event intent stays authoritative', () => {
  assert.equal(project([event('saved', '09:00', '10:00', { status: 'completed' })], [], '09:30').complete, true)
  for (const status of ['completed', 'skipped', 'deferred']) {
    const value = getRecoveryPresentation({ evidence: { ...evidence([]), available: false },
      schedule: schedule([event('saved', '09:00', '10:00', { status })]) })
    assert.equal(value.state, status === 'completed' ? 'completed' : 'held')
    assert.equal(value.complete, status === 'completed')
  }
  for (const status of ['skipped', 'deferred']) {
    const value = project([event('held', '09:00', '10:00', { status })], [record('09:15')], '09:30')
    assert.equal(value.state, 'held'); assert.equal(value.complete, false); assert.equal(value.eventId, 'held')
  }
  const later = event('later', '09:00', '10:00', { status: 'deferred', adjusted_start_at: instant('14:00'), adjusted_end_at: instant('15:00') })
  assert.equal(project([later], [record('09:15')], '10:00').state, 'upcoming')
})

test('overlapping, all-day, missing-timestamp and malformed windows stay unlinked instead of falsely complete', () => {
  assert.equal(project([event('one'), event('overlap', '09:20', '10:20')], [record('09:25')], '09:30').state, 'ambiguous')
  assert.equal(project([event('all-day', '00:00', '23:59', { all_day: true })], [record('09:25')], '09:30').state, 'ambiguous')
  assert.equal(project([event('all-day', '00:00', '23:59', { all_day: true }), event('timed')], [record('09:25')], '09:30').state, 'ambiguous')
  assert.equal(project([event('legacy')], [record(null)], '09:30').state, 'ambiguous')
  assert.equal(project([event('bad', '10:00', '09:00')], [record('09:15')], '09:30').state, 'ambiguous')
  assert.equal(project([event('same'), event('same')], [record('09:15')], '09:30').state, 'ambiguous')
  assert.equal(project([event('one'), event('two')], [], '09:30').state, 'ambiguous')
})

test('record and event ownership require the same authenticated member, client and local day', () => {
  const rows = [record('09:15', { user_id: other }), record('09:16', { client_id: 'FOREIGN' }), record('09:17', { log_date: '2026-11-01' })]
  assert.deepEqual(evidence(rows).completedAt, [])
  assert.equal(project([event('own')], rows, '09:30').state, 'due')
  for (const extra of [{ user_id: other }, { client_id: 'FOREIGN' }, { schedule_date: '2026-11-01' }]) {
    const value = project([event('foreign', '09:00', '10:00', { ...extra, status: 'completed' })], [record('09:15')], '09:30')
    assert.equal(value.state, 'no_event');assert.equal(value.complete, false)
  }
  const safe = evidence([record('09:15', { notes: 'private answer', manual_hr: 99, activity_details: { health: 'private' } })])
  assert.deepEqual(Object.keys(safe).sort(), ['ownerUserId', 'clientId', 'date', 'available', 'completedAt', 'unlinkedRecordCount'].sort())
  assert.doesNotMatch(JSON.stringify(safe), /private|manual_hr|Meditation/)
})

test('upcoming and no-event outcomes do not invent recovery blocks; missing sources stay neutral', () => {
  assert.deepEqual(project([event('later', '18:00', '19:00')], [record('09:15')], '09:30'),
    { state: 'upcoming', complete: false, eventId: 'later', nextRefreshAt: instant('18:00') })
  assert.equal(project([], [record('09:15')], '09:30').state, 'no_event')
  assert.equal(project([event('cancelled', '09:00', '10:00', { status: 'cancelled' })], [record('09:15')], '09:30').state, 'no_event')
  assert.equal(project([event('own')], [], '09:30', { unavailableSources: ['saved_events'] }).state, 'unavailable')
  assert.equal(getRecoveryPresentation({ evidence: { ...evidence([]), available: false }, schedule: schedule([event('own')]) }).state, 'unavailable')
  assert.equal(getRecoveryPresentation({ evidence: recoveryCompletionEvidence({ userId: owner, clientId, date, rows: null }), schedule: schedule([event('own')]) }).state, 'unavailable')
  assert.equal(getRecoveryPresentation({ evidence: evidence([]), schedule: schedule([event('own')], '09:30', { date: '2026-11-03' }) }).state, 'unavailable')
})

test('recovery evidence read remains owner/day scoped and distinguishes failed reads from an empty known history', async () => {
  for (const activityResult of [{ data: [], error: null }, { data: null, error: { message: 'synthetic failure' } }]) {
    const reads = [], writes = []
    const supabase = { from(table) {
      const filters = []; let query
      query = new Proxy({}, { get(_target, name) {
        if (name === 'then') return (yes, no) => { reads.push({ table, filters });return Promise.resolve(table === 'recovery_activity_logs' ? activityResult : { data: [], error: null }).then(yes, no) }
        if (name === 'maybeSingle' || name === 'single') return async () => ({ data: null, error: null })
        if (['insert', 'update', 'upsert', 'delete'].includes(name)) return () => { writes.push(name); throw new Error('Read-only loader') }
        return (...args) => { if (name === 'eq') filters.push(args);return query }
      } }); return query
    } }
    const inputs = await loadProgramLogicInputs({ supabase, user: { id: owner }, client: { client_id: clientId, auth_user_id: owner,
      program: 'ember', timezone: 'UTC' }, program: 'ember', dailyPlan: {}, cycleStatus: {}, cycleAdjustment: {},
      plannedWorkout: null, plannedExercises: [], monthlyAssessmentsDueCount: 0 })
    assert.deepEqual(reads.find(read => read.table === 'recovery_activity_logs').filters,
      [['user_id', owner], ['client_id', clientId], ['log_date', inputs.date]])
    assert.equal(inputs.recoveryActivitiesAvailable, activityResult.error === null)
    assert.deepEqual(inputs.todayRecoveryActivities, [])
    assert.deepEqual(writes, [])
  }
})
