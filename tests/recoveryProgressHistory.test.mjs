import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'

// Every query below executes against synthetic arrays. No network, health
// provider or real member record is reachable through this fixture.
const now = new Date('2026-11-03T05:30:00Z')
const user = { id: 'synthetic-owner' }
const client = { client_id: 'synthetic-client', auth_user_id: user.id, program: 'ignite', access: true, active: true, timezone: 'America/Los_Angeles' }
const checkin = extra => ({ client_id: client.client_id, auth_user_id: user.id, log_date: '2026-11-02', updated_at: '2026-11-03T01:00:00Z', energy_level: 7, stress_level: 4, sleep_hours: 7.5, sleep_quality: 6, ...extra })
const sleep = extra => ({ id: 'sleep-a', client_id: client.client_id, user_id: user.id, log_date: '2026-11-02', updated_at: '2026-11-03T01:00:00Z', duration_hours: 7.5, quality: 6, ...extra })
const activity = extra => ({ id: 'activity-a', request_id: null, client_id: client.client_id, user_id: user.id, log_date: '2026-11-02', created_at: '2026-11-03T01:00:00Z', activity_type: 'Meditation', duration_minutes: 10, activity_details: null, ...extra })
const workout = (exercise_logs = [], extra = {}) => ({ id: 'workout-a', client_id: client.client_id, auth_user_id: user.id, workout_date: '2026-11-02', workout_started_at: null, updated_at: '2026-11-03T01:00:00Z', workout_source: 'manual', day_name: 'Saved workout', completed: false, exercise_logs, ...extra })

function database(tables = {}, { failed = [], thrown = [], unsafe = [] } = {}) {
  const reads = [], initial = structuredClone(tables)
  const supabase = { from(table) {
    assert.ok(['recovery_logs', 'sleep_logs', 'recovery_activity_logs', 'workout_logs'].includes(table), `Unexpected source ${table}`)
    const state = { table, columns: '', filters: [], orders: [], limit: undefined }; reads.push(state)
    const query = {
      select(columns) { state.columns = columns; return query },
      eq(key, value) { state.filters.push(['eq', key, value]); return query },
      gte(key, value) { state.filters.push(['gte', key, value]); return query },
      lte(key, value) { state.filters.push(['lte', key, value]); return query },
      lt(key, value) { state.filters.push(['lt', key, value]); return query },
      order(key, options = {}) { state.orders.push([key, options]); return query },
      limit(value) { state.limit = value; return query },
      then(yes, no) {
        if (thrown.includes(table)) return Promise.reject(new Error('private transport failure')).then(yes, no)
        if (failed.includes(table)) return Promise.resolve({ data: null, error: { message: 'private source failure' } }).then(yes, no)
        let rows = (tables[table] || []).filter(row => unsafe.includes(table) || state.filters.every(([op, key, value]) => {
          if (op === 'eq') return row[key] === value
          if (row[key] === null || row[key] === undefined) return false
          return op === 'gte' ? String(row[key]) >= value : op === 'lte' ? String(row[key]) <= value : String(row[key]) < value
        }))
        rows = [...rows].sort((a, b) => {
          for (const [key, options] of state.orders) {
            if (a[key] == null || b[key] == null) {
              if (a[key] == null && b[key] == null) continue
              const nullsFirst = options.nullsFirst ?? !options.ascending
              return (a[key] == null ? -1 : 1) * (nullsFirst ? 1 : -1)
            }
            const comparison = String(a[key]).localeCompare(String(b[key]))
            if (comparison) return options.ascending ? comparison : -comparison
          }
          return 0
        })
        if (state.limit !== undefined) rows = rows.slice(0, state.limit)
        return Promise.resolve({ data: rows, error: null }).then(yes, no)
      },
    }
    return query
  }, rpc() { throw new Error('Read-only history must not invoke persistence') }, storage: { from() { throw new Error('No health/photos in this history') } } }
  return { supabase, reads, verify() { assert.deepEqual(tables, initial) } }
}
const module = () => importTs('lib/dashboard/recoveryProgressHistory.ts')
const load = async (db, overrides = {}) => (await module()).loadRecoveryProgressHistory({ supabase: db.supabase, user, client, range: '4w', now, ...overrides })

test('canonical owner and relevant existing capabilities are required before source reads', async () => {
  for (const overrides of [
    { user: null }, { user: { id: 'another-owner' } }, { client: null }, { client: { ...client, auth_user_id: null } },
    { client: { ...client, program: 'tracker' } }, { client: { ...client, program: 'free' } }, { client: { ...client, program: 'unknown' } },
    { client: { ...client, active: false } }, { client: { ...client, access: false } },
    { client: { ...client, membership_expires_at: '2026-11-03T05:29:00Z' } },
  ]) {
    const db = database()
    await assert.rejects(load(db, overrides)); assert.equal(db.reads.length, 0)
  }
  for (const capability of ['generatedCoaching', 'progressView', 'trendsView', 'recoveryBasic', 'workoutLogging']) {
    const guarded = await importTs('lib/dashboard/recoveryProgressHistory.ts', { '@/lib/membership/policy': `export const membershipCan = (_client, capability) => capability !== '${capability}'` })
    const db = database()
    await assert.rejects(guarded.loadRecoveryProgressHistory({ supabase: db.supabase, user, client, range: '4w', includeWorkouts: true, now }))
    assert.equal(db.reads.length, 0)
  }
  for (const program of ['ember', 'ignite', 'phoenix']) {
    const db = database(); const output = await load(db, { client: { ...client, program } })
    assert.equal(output.includeWorkouts, false); assert.equal(output.checkins.unavailable, false)
    assert.ok(!db.reads.some(read => read.table === 'workout_logs')); db.verify()
  }
})

test('every query is current-owner scoped and a foreign response invalidates only that source', async () => {
  const db = database({ recovery_logs: [checkin()], sleep_logs: [sleep()], recovery_activity_logs: [activity()] })
  const output = await load(db, { includeWorkouts: true })
  for (const read of db.reads) {
    assert.ok(read.filters.some(([op, key, value]) => op === 'eq' && key === 'client_id' && value === client.client_id))
    const ownerColumn = ['recovery_logs', 'workout_logs'].includes(read.table) ? 'auth_user_id' : 'user_id'
    assert.ok(read.filters.some(([op, key, value]) => op === 'eq' && key === ownerColumn && value === user.id))
    assert.equal(read.limit, 501)
    if (read.table !== 'workout_logs') assert.ok(read.columns !== '*' && !/notes|heart_rate|resting|native|session_duration|hold|round/.test(read.columns))
    if (read.table === 'recovery_logs') assert.deepEqual(read.orders, [['log_date', { ascending: false }], ['updated_at', { ascending: false }]])
    if (read.table === 'sleep_logs') assert.deepEqual(read.orders, [['log_date', { ascending: false }], ['updated_at', { ascending: false }], ['id', { ascending: false }]])
    if (read.table === 'recovery_activity_logs') assert.deepEqual(read.orders, [['log_date', { ascending: false }], ['created_at', { ascending: false }], ['id', { ascending: false }]])
  }
  assert.doesNotMatch(JSON.stringify(output), /synthetic-owner|synthetic-client/)
  for (const [table, envelope, foreign] of [
    ['recovery_logs', 'checkins', checkin({ auth_user_id: 'foreign-owner' })],
    ['sleep_logs', 'sleep', sleep({ user_id: 'foreign-owner' })],
    ['recovery_activity_logs', 'activities', activity({ client_id: 'foreign-client' })],
    ['workout_logs', 'workouts', workout([], { auth_user_id: 'foreign-owner' })],
  ]) {
    const source = database({ [table]: [foreign] }, { unsafe: [table] })
    const result = await load(source, { includeWorkouts: true })
    assert.equal(result[envelope].unavailable, true); assert.deepEqual(result[envelope].records, [])
    assert.doesNotMatch(JSON.stringify(result), /foreign-owner|foreign-client/)
    for (const key of ['checkins', 'sleep', 'activities', 'workouts'].filter(key => key !== envelope)) assert.equal(result[key].unavailable, false)
  }
  db.verify()
})

test('saved check-in scales distinguish recorded zero, missing and invalid without a derived recovery score', async () => {
  const db = database({ recovery_logs: [checkin({ energy_level: 0, stress_level: '10', sleep_hours: 0, sleep_quality: ' ', soreness_level: -1,
    mood_level: false, hunger_level: 4, notes: 'PRIVATE_HEALTH_NOTE', recovery_score: 99, resting_hr: 55 })],
  sleep_logs: [sleep({ duration_hours: 0, quality: 0, notes: 'PRIVATE_SLEEP_NOTE' })] })
  const result = await load(db), values = result.checkins.records[0].values
  assert.deepEqual(values.energy, { status: 'invalid', value: null })
  assert.deepEqual(values.stress, { status: 'recorded', value: 10 })
  assert.deepEqual(values.sleepHours, { status: 'recorded', value: 0 })
  assert.deepEqual(values.sleepQuality, { status: 'missing', value: null })
  assert.deepEqual(values.soreness, { status: 'invalid', value: null })
  assert.deepEqual(values.mood, { status: 'invalid', value: null })
  assert.deepEqual(values.hunger, { status: 'recorded', value: 4 })
  assert.deepEqual(result.sleep.records[0].duration, { status: 'recorded', value: 0 })
  assert.deepEqual(result.sleep.records[0].quality, { status: 'invalid', value: null })
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_|resting_hr|recovery_score|readiness/)
  const bounds = await load(database({ recovery_logs: [checkin({ energy_level: 1, stress_level: 11, sleep_hours: 24, sleep_quality: '1e1', mood_level: {}, hunger_level: 'Infinity' })] }))
  assert.equal(bounds.checkins.records[0].values.energy.value, 1)
  assert.equal(bounds.checkins.records[0].values.stress.status, 'invalid')
  assert.equal(bounds.checkins.records[0].values.sleepHours.value, 24)
  assert.equal(bounds.checkins.records[0].values.sleepQuality.value, 10)
  assert.equal(bounds.checkins.records[0].values.mood.status, 'invalid')
  db.verify()
})

test('civil dates, local midnight and range selection retain independent sleep and daily-answer provenance', async () => {
  const dates = ['2025-01-01', '2026-08-10', '2026-08-11', '2026-10-05', '2026-10-06', '2026-11-02', '2026-11-03']
  const db = database({ recovery_logs: dates.map(log_date => checkin({ log_date })), sleep_logs: dates.map(log_date => sleep({ log_date, id: log_date })) })
  const recent = await load(db)
  assert.equal(recent.today, '2026-11-02'); assert.equal(recent.timeZone, 'America/Los_Angeles')
  assert.deepEqual(recent.checkins.records.map(record => record.date), ['2026-11-02', '2026-10-06'])
  assert.deepEqual(recent.sleep.records.map(record => record.date), ['2026-11-02', '2026-10-06'])
  assert.equal(recent.checkins.records[0].values.sleepHours.value, 7.5)
  assert.equal(recent.sleep.records[0].duration.value, 7.5)
  assert.equal(Object.hasOwn(recent, 'totalSleepHours'), false)
  const twelve = await load(db, { range: '12w' })
  assert.deepEqual(twelve.checkins.records.map(record => record.date), ['2026-11-02', '2026-10-06', '2026-10-05', '2026-08-11'])
  const all = await load(db, { range: 'all' }); assert.equal(all.periodLabel, 'All-time range'); assert.equal(all.checkins.records.length, 6)
  const invalid = await load(database({ recovery_logs: [checkin({ log_date: '2026-02-30' }), checkin({ log_date: '2026-11-02T00:00:00Z' }), checkin({ log_date: '2026-11-03' })] }, { unsafe: ['recovery_logs'] }))
  assert.equal(invalid.checkins.records.length, 0); assert.ok(invalid.checkins.invalidCount >= 2)
  db.verify()
})

test('recovery durations use saved actual minutes and exact detailed precision without invented hold or round time', async () => {
  const request = '00000000-0000-4000-8000-000000000001'
  const sauna = activity({ id: 'sauna', request_id: request, activity_type: 'Sauna', duration_minutes: 10,
    activity_details: { kind: 'sauna', source: 'manual', durationMinutes: 10.5, context: 'before_workout', heartRateBpm: 100 } })
  const rows = [sauna, structuredClone(sauna),
    activity({ id: 'zero', duration_minutes: 0 }), activity({ id: 'rest', activity_type: 'Full rest', duration_minutes: null }),
    activity({ id: 'holds', duration_minutes: null, activity_details: { holdSeconds: 60, rounds: 8, sessionDuration: 400 } }),
    activity({ id: 'fraction-column', duration_minutes: 1.5 }),
    activity({ id: 'mismatch', activity_type: 'Gentle walk', duration_minutes: 11, activity_details: { kind: 'slow_walk', source: 'manual', durationMinutes: 10.9 } }),
    activity({ id: 'string-detail', activity_type: 'Warm soak', duration_minutes: 10, activity_details: { kind: 'warm_soak', source: 'manual', durationMinutes: '10.5' } }),
    activity({ id: 'legacy', activity_type: 'Legacy saved practice', duration_minutes: 15 }),
    activity({ id: 'bad', duration_minutes: -2 }),
  ]
  const db = database({ recovery_activity_logs: rows }); const result = await load(db)
  assert.equal(result.activities.records.length, rows.length - 1)
  const byLabel = label => result.activities.records.filter(record => record.label === label)
  const detailed = byLabel('Sauna')[0]
  assert.deepEqual(detailed.duration, { status: 'recorded', value: 10.5 }); assert.equal(detailed.durationSource, 'manual_details')
  assert.equal(result.activities.records.filter(record => record.duration.status === 'recorded' && record.duration.value === 0).length, 1)
  assert.equal(byLabel('Full rest')[0].duration.status, 'missing')
  assert.equal(byLabel('Gentle walk')[0].duration.status, 'invalid')
  assert.equal(byLabel('Warm soak')[0].duration.status, 'invalid')
  assert.equal(byLabel('Legacy saved practice')[0].duration.value, 15)
  assert.ok(result.activities.records.some(record => record.duration.status === 'missing' && record.label === 'Meditation'))
  assert.ok(result.activities.records.filter(record => record.duration.status === 'invalid').length >= 4)
  assert.doesNotMatch(JSON.stringify(result), /heartRateBpm|holdSeconds|rounds|sessionDuration|before_workout/)
  db.verify()
})

test('saved-identity dedupe does not double count representations or hide conflicting activity evidence', async () => {
  const request = '00000000-0000-4000-8000-000000000002'
  const first = activity({ id: 'first', request_id: request, duration_minutes: 12 })
  const db = database({ recovery_activity_logs: [first, { ...first, id: 'same-request' }, activity({ id: 'separate', duration_minutes: 12 })] })
  const result = await load(db)
  assert.equal(result.activities.records.length, 2)
  assert.ok(result.activities.records.every(record => record.ambiguous === false))
  const conflictRows = [first, { ...first, id: 'conflict', duration_minutes: 20 }]
  const conflicting = await load(database({ recovery_activity_logs: conflictRows }))
  const replay = await load(database({ recovery_activity_logs: conflictRows.reverse() }))
  assert.equal(conflicting.activities.records.length, 2)
  assert.ok(conflicting.activities.records.every(record => record.ambiguous === true))
  assert.deepEqual(conflicting.activities.records, replay.activities.records)
  assert.deepEqual(conflicting.activities.ambiguousDates, ['2026-11-02'])
  assert.equal(new Set(conflicting.activities.records.map(record => record.key)).size, 2)
  db.verify()
})

test('safe source limits and tied-date ambiguity remain explicit across sentinel cutoff and source failures', async () => {
  const newer = Array.from({ length: 499 }, (_, index) => checkin({ log_date: new Date(Date.parse('2026-11-02T00:00:00Z') - index * 86400000).toISOString().slice(0, 10) }))
  const boundary = [checkin({ log_date: '2024-01-01', energy_level: 3 }), checkin({ log_date: '2024-01-01', energy_level: 8 })]
  const db = database({ recovery_logs: [...newer, ...boundary] })
  const capped = await load(db, { range: 'all' })
  assert.equal(capped.checkins.capped, true); assert.equal(capped.checkins.records.length, 500)
  assert.deepEqual(capped.checkins.ambiguousDates, ['2024-01-01'])
  assert.equal(capped.checkins.records.filter(record => record.date === '2024-01-01').length, 1)
  for (const read of db.reads) assert.equal(read.limit, 501)
  const failure = await load(database({ recovery_activity_logs: [activity()] }, { thrown: ['recovery_logs'], failed: ['sleep_logs'] }))
  assert.equal(failure.checkins.unavailable, true); assert.equal(failure.sleep.unavailable, true)
  assert.equal(failure.activities.unavailable, false); assert.equal(failure.activities.records.length, 1)
  assert.deepEqual(failure.checkins.records, []); assert.deepEqual(failure.sleep.records, [])
  assert.doesNotMatch(JSON.stringify(failure), /private transport|private source/)
  const empty = await load(database())
  for (const source of ['checkins', 'sleep', 'activities']) { assert.equal(empty[source].unavailable, false); assert.deepEqual(empty[source].records, []) }
  db.verify()
})

test('workout comparison keeps canonical confirmed completion and local-day evidence read-only', async () => {
  const actualSet = ordinal => ({ id: `set-${ordinal}`, set_number: ordinal, weight: 20, weight_unit: 'lb', reps: 8, completed_at: '2026-11-03T18:00:00Z' })
  const exercise = sets => ({ id: 'press', exercise: 'Recorded press', exercise_category: 'strength', planned_sets: 4, set_logs: sets, completed: false, user_intent: { desired_set_count: 1 } })
  const records = [
    workout([exercise([actualSet(1), actualSet(2), actualSet(2)])], { id: 'done', day_name: 'Threshold reached', workout_started_at: '2026-11-04T05:30:00Z', workout_date: '2026-11-04' }),
    workout([exercise([actualSet(1)])], { id: 'partial', day_name: 'Partial saved work', completed: true, workout_date: '2026-11-03' }),
    workout([{ id: 'walk', exercise: 'Walking', exercise_category: 'cardio', duration_seconds: 90, actual_duration: 90, duration_unit: 'seconds', completed: true, confirmed_at: '2026-11-03T18:00:00Z' }], { id: 'cardio', day_name: 'Recorded cardio', workout_date: '2026-11-03' }),
    workout([], { id: 'future', day_name: 'Future must not appear', workout_started_at: '2026-11-04T06:00:00Z', workout_date: '2026-11-04', completed: true }),
  ]
  const db = database({ workout_logs: records })
  const result = await load(db, { includeWorkouts: true, client: { ...client, timezone: 'America/Chicago' }, now: new Date('2026-11-03T18:00:00Z') })
  assert.equal(result.includeWorkouts, true); assert.equal(result.workouts.unavailable, false)
  assert.equal(result.workouts.records.find(record => record.title === 'Threshold reached').completed, true)
  assert.equal(result.workouts.records.find(record => record.title === 'Partial saved work').completed, false)
  assert.equal(result.workouts.records.find(record => record.title === 'Recorded cardio').completed, true)
  assert.ok(result.workouts.records.every(record => record.date === '2026-11-03'))
  assert.equal(result.workouts.records.some(record => record.title === 'Future must not appear'), false)
  assert.equal(records[0].exercise_logs[0].planned_sets, 4)
  assert.equal(records[0].exercise_logs[0].user_intent.desired_set_count, 1)
  assert.doesNotMatch(JSON.stringify(result), /set_logs|user_intent|planned_sets|recommended/)
  db.verify()
})

const loadSummary = async (db, overrides = {}) => (await module()).loadRecoveryProgressSummary({ supabase: db.supabase, user, client, range: '4w', now, ...overrides })

test('recovery summary counts distinct completed action and explicitly completed check-in days, with no sleep query', async () => {
  const request = '00000000-0000-4000-8000-000000000003'
  const first = activity({ id: 'first', request_id: request, duration_minutes: 12 })
  const complete = checkin({ check_in_completed_at: '2026-11-03T01:00:00Z' })
  const db = database({
    recovery_activity_logs: [first, { ...first, id: 'retry' }, activity({ id: 'second', duration_minutes: 3 }),
      activity({ id: 'rest', activity_type: 'Full rest', duration_minutes: null, log_date: '2026-11-01', created_at: '2026-11-02T01:00:00Z' })],
    recovery_logs: [complete, { ...complete },
      checkin({ log_date: '2026-11-01', energy_level: null, check_in_completed_at: '2026-11-02T01:00:00Z' }),
      checkin({ log_date: '2026-10-31', updated_at: '2026-11-01T01:00:00Z' })],
    sleep_logs: [sleep({ log_date: '2026-10-30' })],
  })
  const result = await loadSummary(db)
  assert.deepEqual(result, { daysCompleted: 2, recordedMinutes: 15, checkinDays: 1,
    activitiesCapped: false, checkinsCapped: false, minutesIncomplete: false, excludedActivityCount: 0 })
  assert.deepEqual(db.reads.map(read => read.table).sort(), ['recovery_activity_logs', 'recovery_logs'])
  assert.ok(db.reads.find(read => read.table === 'recovery_logs').columns.includes('check_in_completed_at'))
  db.verify()
})

test('summary excludes conflicting or unlinked completion and marks partial minute coverage', async () => {
  const request = '00000000-0000-4000-8000-000000000004'
  const first = activity({ id: 'conflict-one', request_id: request, duration_minutes: 12 })
  const db = database({ recovery_activity_logs: [first, { ...first, id: 'conflict-two', duration_minutes: 20 },
    activity({ id: 'valid', duration_minutes: 4 }),
    activity({ id: 'missing-time', created_at: null, duration_minutes: 100 }),
    activity({ id: 'future-time', created_at: '2026-11-03T06:00:00Z', duration_minutes: 100 }),
    activity({ id: 'date-only-time', created_at: '2026-11-02', duration_minutes: 100 }),
    activity({ id: 'invalid-time', created_at: '2026-11-02T25:00:00Z', duration_minutes: 100 }),
    activity({ id: 'missing-duration', duration_minutes: null }),
    activity({ id: 'invalid-duration', duration_minutes: -1 }),
  ], recovery_logs: [
    checkin({ energy_level: null, check_in_completed_at: '2026-11-03T01:00:00Z' }),
    checkin({ energy_level: 0, check_in_completed_at: '2026-11-03T01:00:00Z' }),
    checkin({ check_in_completed_at: '2026-11-02T25:00:00Z' }),
    checkin({ check_in_completed_at: '2026-11-03T06:00:00Z' }),
    checkin({ check_in_completed_at: '2026-11-02' }),
    checkin(),
  ] })
  const result = await loadSummary(db)
  assert.equal(result.daysCompleted, 1); assert.equal(result.recordedMinutes, 4); assert.equal(result.checkinDays, 0)
  assert.equal(result.minutesIncomplete, true); assert.equal(result.excludedActivityCount, 6)
  assert.doesNotMatch(JSON.stringify(result), /2026-|activity_type|energy|stress|synthetic|duration_minutes/)
  db.verify()
})

test('historical completion stays on its saved date after state or timezone changes', async () => {
  const recordedAt = '2026-11-03T06:30:00Z', later = new Date('2026-11-04T18:00:00Z')
  const transitions = [
    [{ timezone: undefined, state: 'CA' }, { timezone: undefined, state: 'NY' }],
    [{ timezone: 'America/Los_Angeles' }, { timezone: 'America/New_York' }],
  ]
  for (const transition of transitions) for (const profile of transition) {
    const db = database({ recovery_logs: [checkin({ check_in_completed_at: recordedAt })],
      recovery_activity_logs: [activity({ created_at: recordedAt })] })
    const options = { client: { ...client, ...profile }, now: later }
    const history = await load(db, options)
    assert.equal(history.checkins.records[0].date, '2026-11-02')
    assert.equal(history.activities.records[0].date, '2026-11-02')
    assert.equal(history.checkins.records[0].completed, true)
    assert.equal(history.activities.records[0].completed, true)
    const summary = await loadSummary(db, options)
    assert.equal(summary.checkinDays, 1)
    assert.equal(summary.daysCompleted, 1)
    assert.equal(summary.recordedMinutes, 10)
    db.verify()
  }
})

test('historical completion retains valid timestamp, future-time and recorded-date safeguards', async () => {
  const later = new Date('2026-11-04T18:00:00Z')
  for (const recordedAt of [null, '', 'invalid', '2026-11-02', '2026-11-02T20:00:00',
    '2026-11-02T25:00:00Z', '2026-02-30T20:00:00Z', '2026-11-05T01:00:00Z']) {
    const db = database({ recovery_logs: [checkin({ check_in_completed_at: recordedAt })],
      recovery_activity_logs: [activity({ created_at: recordedAt })] })
    const summary = await loadSummary(db, { client: { ...client, timezone: undefined, state: 'NY' }, now: later })
    assert.equal(summary.checkinDays, 0, String(recordedAt))
    assert.equal(summary.daysCompleted, 0, String(recordedAt))
    assert.equal(summary.recordedMinutes, null, String(recordedAt))
    db.verify()
  }
  const invalidDay = database({ recovery_logs: [checkin({ log_date: '2026-02-30', check_in_completed_at: '2026-03-01T01:00:00Z' })],
    recovery_activity_logs: [activity({ log_date: '2026-02-30', created_at: '2026-03-01T01:00:00Z' })] })
  const summary = await loadSummary(invalidDay, { range: 'all', now: later })
  assert.equal(summary.checkinDays, 0)
  assert.equal(summary.daysCompleted, 0)
  invalidDay.verify()
})

test('summary keeps unavailable, missing duration and a genuine zero distinct', async () => {
  const empty = await loadSummary(database())
  assert.equal(empty.daysCompleted, 0); assert.equal(empty.recordedMinutes, 0); assert.equal(empty.checkinDays, 0)
  const restOnly = await loadSummary(database({ recovery_activity_logs: [activity({ activity_type: 'Full rest', duration_minutes: null })] }))
  assert.equal(restOnly.daysCompleted, 1); assert.equal(restOnly.recordedMinutes, null); assert.equal(restOnly.minutesIncomplete, false)
  const zero = await loadSummary(database({ recovery_activity_logs: [activity({ duration_minutes: 0 })] }))
  assert.equal(zero.recordedMinutes, 0); assert.equal(zero.daysCompleted, 1)
  const missing = await loadSummary(database({ recovery_activity_logs: [activity({ duration_minutes: null })] }))
  assert.equal(missing.recordedMinutes, null); assert.equal(missing.minutesIncomplete, true)
  const unavailable = await loadSummary(database({}, { thrown: ['recovery_activity_logs'], failed: ['recovery_logs'] }))
  assert.equal(unavailable.daysCompleted, null); assert.equal(unavailable.recordedMinutes, null); assert.equal(unavailable.checkinDays, null)
})

test('All Time summary uses the sentinel cap and reports only the displayed records', async () => {
  const activities = Array.from({ length: 501 }, (_, index) => activity({ id: `record-${index}`, duration_minutes: 1 }))
  const checkins = Array.from({ length: 501 }, (_, index) => {
    const log_date = new Date(Date.parse('2026-11-02T00:00:00Z') - index * 86400000).toISOString().slice(0, 10)
    return checkin({ log_date, check_in_completed_at: `${log_date}T20:00:00Z` })
  })
  const db = database({ recovery_activity_logs: activities, recovery_logs: checkins })
  const result = await loadSummary(db, { range: 'all' })
  assert.equal(result.daysCompleted, 1); assert.equal(result.recordedMinutes, 500); assert.equal(result.checkinDays, 500)
  assert.equal(result.activitiesCapped, true); assert.equal(result.checkinsCapped, true); assert.equal(result.minutesIncomplete, true)
  assert.ok(db.reads.every(read => read.limit === 501))
  db.verify()
})

test('summary preserves the history authorization and member-local range boundaries', async () => {
  const db = database({ recovery_activity_logs: [
    activity({ id: 'first-in-range', log_date: '2026-10-06', created_at: '2026-10-06T20:00:00Z', duration_minutes: 1 }),
    activity({ id: 'before-range', log_date: '2026-10-05', created_at: '2026-10-05T20:00:00Z', duration_minutes: 50 }),
  ] })
  const recent = await loadSummary(db)
  assert.equal(recent.recordedMinutes, 1); assert.equal(recent.daysCompleted, 1)
  const twelve = await loadSummary(db, { range: '12w' })
  assert.equal(twelve.recordedMinutes, 51); assert.equal(twelve.daysCompleted, 2)
  for (const program of ['ember', 'ignite', 'phoenix']) await loadSummary(database(), { client: { ...client, program } })
  for (const overrides of [{ user: { id: 'foreign' } }, { client: { ...client, program: 'tracker' } }, { client: { ...client, program: 'free' } }]) {
    const denied = database()
    await assert.rejects(loadSummary(denied, overrides)); assert.equal(denied.reads.length, 0)
  }
  const foreign = await loadSummary(database({ recovery_activity_logs: [activity({ user_id: 'foreign' })] }, { unsafe: ['recovery_activity_logs'] }))
  assert.equal(foreign.daysCompleted, null); assert.equal(foreign.recordedMinutes, null)
  db.verify()
})
