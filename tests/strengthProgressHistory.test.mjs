import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'

const { loadStrengthProgressHistory } = await importTs('lib/dashboard/strengthProgressHistory.ts')
const { loadWorkoutHistory } = await importTs('lib/workout/history.ts')
const now = new Date('2026-11-03T18:00:00Z')
const user = { id: 'synthetic-owner' }
const client = { client_id: 'synthetic-client', auth_user_id: user.id, program: 'ignite', timezone: 'America/Chicago', access: true, active: true, verified_purchase: false }
const set = (weight = 10, unit = 'lb', extra = {}) => ({ id: 'set-a', set_number: 1, weight, weight_unit: unit, reps: 8, completed_at: '2026-11-01T18:00:00Z', ...extra })
const exercise = (sets = [set()], extra = {}) => ({ id: 'catalog:occurrence', catalogExerciseId: 'catalog-a', exercise: 'Recorded press', exercise_category: 'strength',
  selected_variant_id: 'dumbbell-a', selected_variant_name: 'Dumbbell press', selected_equipment: 'dumbbell', load_type: 'per_hand', planned_sets: 4, set_logs: sets, completed: false, ...extra })
const row = (logs = [exercise()], extra = {}) => ({ id: 'saved-a', client_id: client.client_id, auth_user_id: user.id, program: 'ignite', day_name: 'Monday strength',
  workout_source: 'manual', workout_started_at: '2026-11-01T18:00:00Z', workout_date: '2026-11-01', updated_at: '2026-11-01T19:00:00Z', exercise_logs: logs, completed: false, ...extra })

function fixture(rows = [], { fail = false, missingTimestamp = false, unsafeResponse = false } = {}) {
  const reads = [], initial = structuredClone(rows)
  const supabase = { from(table) {
    assert.equal(table, 'workout_logs')
    const state = { table, filters: [], orders: [], limit: undefined };reads.push(state)
    const query = { select() { return query },
      eq(key, value) { state.filters.push(['eq', key, value]); return query },
      gte(key, value) { state.filters.push(['gte', key, value]); return query },
      lt(key, value) { state.filters.push(['lt', key, value]); return query },
      order(key, options) { state.orders.push([key, options]); return query },
      limit(value) { state.limit = value; return query },
      then(yes, no) {
        if (fail === 'throw') return Promise.reject(new Error('private transport detail')).then(yes, no)
        if (fail) return Promise.resolve({ data: null, error: { message: 'private read detail' } }).then(yes, no)
        if (missingTimestamp && state.orders[0]?.[0] === 'workout_started_at') return Promise.resolve({ data: null, error: { code: '42703', message: 'workout_started_at is absent' } }).then(yes, no)
        let result = rows.filter(item => state.filters.every(([op, key, value]) => {
          if (unsafeResponse && op === 'eq') return true
          if (op === 'eq') return item[key] === value
          if (item[key] === undefined || item[key] === null) return false
          return op === 'gte' ? String(item[key]) >= value : String(item[key]) < value
        }))
        result = [...result].sort((a, b) => {
          for (const [key, options] of state.orders) {
            if (a[key] == null || b[key] == null) {
              if (a[key] == null && b[key] == null) continue
              const nullFirst = options.nullsFirst ?? !options.ascending
              return (a[key] == null ? -1 : 1) * (nullFirst ? 1 : -1)
            }
            const order = String(a[key]).localeCompare(String(b[key]))
            if (order) return options.ascending ? order : -order
          }
          return 0
        }).slice(0, state.limit)
        return Promise.resolve({ data: result, error: null }).then(yes, no)
      } }
    return query
  }, rpc() { throw new Error('History is read-only') }, storage: { from() { throw new Error('Workout history must not read photos') } } }
  return { supabase, reads, verify() { assert.deepEqual(rows, initial) } }
}
const load = (db, patch = {}) => loadStrengthProgressHistory({ supabase: db.supabase, user, client, range: '4w', now, ...patch })

test('canonical owner and existing capabilities gate history before every source read', async () => {
  for (const patch of [{ user: null }, { user: { id: 'other' } }, { client: { ...client, auth_user_id: null } },
    { client: { ...client, program: 'free' } }, { client: { ...client, program: 'tracker' } },
    { client: { ...client, program: 'unknown' } }, { client: { ...client, access: false } },
    { client: { ...client, membership_expires_at: '2026-11-03T17:59:00Z' } }]) {
    const db = fixture()
    await assert.rejects(load(db, patch), /not available for this account/)
    assert.equal(db.reads.length, 0)
  }
  for (const program of ['ember', 'ignite', 'phoenix']) {
    const db = fixture([row()]);const output = await load(db, { client: { ...client, program } })
    assert.equal(output.unavailable, false)
    for (const read of db.reads) {
      assert.ok(read.filters.some(([op, key, value]) => op === 'eq' && key === 'client_id' && value === client.client_id))
      assert.ok(read.filters.some(([op, key, value]) => op === 'eq' && key === 'auth_user_id' && value === user.id))
    }
  }
  const unsafe = fixture([row(undefined, { auth_user_id: 'other' })], { unsafeResponse: true })
  const denied = await load(unsafe)
  assert.equal(denied.unavailable, true);assert.deepEqual(denied.sessions, [])
})

test('confirmed actuals keep exact units, catalog/variant/equipment/load contexts and legacy source kinds separate', async () => {
  const db = fixture([row([
    exercise([set(0), set(12, 'lb', { id: 'set-b', set_number: 2 })]),
    exercise([set(20, 'kg')]),
    exercise([set(90)], { selected_variant_id: 'different' }),
    exercise([set(80)], { selected_equipment: 'barbell' }),
    exercise([set(70)], { load_type: 'total_load' }),
    exercise([set(60)], { catalogExerciseId: 'catalog-b' }),
    { exercise: 'Recorded press', exercise_category: 'strength', completed: true, actual_weight: 30, actual_weight_unit: 'lb', actual_reps: 7.5 },
    exercise([], { exercise: 'Suggested only', recommended_weight: 900, planned_weight: 950 }),
    exercise([{ weight: 400, reps: 8, weight_unit: 'lb' }], { exercise: 'Unconfirmed' }),
    exercise([set(500, undefined, { weight_unit: undefined })], { exercise: 'Unknown units', actual_weight_unit: 'kg' }),
  ])])
  const data = await load(db)
  assert.equal(data.series.length, 7)
  assert.equal(data.series.find(series => series.sourceKind === 'confirmed_sets' && series.unit === 'lb' && series.variant === 'Dumbbell press' && series.equipment === 'dumbbell' && series.loadType === 'per_hand' && series.points[0].value === 12).points[0].value, 12)
  assert.ok(data.series.some(series => series.unit === 'kg' && series.points[0].value === 20))
  assert.ok(data.series.some(series => series.sourceKind === 'legacy_summary' && series.points[0].value === 30))
  assert.ok(data.sessions[0].entries.some(entry => entry.detail.includes('0 lb')))
  assert.ok(data.sessions[0].entries.some(entry => entry.detail.includes('Legacy recorded summary: 7.5 reps')))
  assert.ok(data.series.every(series => /^[a-f0-9]{24}$/.test(series.id)))
  assert.ok(data.series.every(series => series.points.every(point => ![900, 950, 400, 500].includes(point.value))))
  assert.doesNotMatch(JSON.stringify(data.series), /synthetic-owner|synthetic-client/)
  db.verify()
})

test('bodyweight, assistance, duration and skipped work remain truthful history rather than external-weight trends', async () => {
  const db = fixture([row([
    exercise([set(0)], { exercise: 'Bodyweight', load_type: 'bodyweight', selected_equipment: 'bodyweight' }),
    exercise([set(40)], { exercise: 'Assisted pull', load_type: 'assisted' }),
    exercise([set(99)], { exercise: 'Skipped', skipped: true }),
    { id: 'walk', exercise: 'Walking', exercise_category: 'cardio', completed: true, actual_duration: 90, duration_unit: 'seconds', confirmed_at: '2026-11-01T18:00:00Z' },
    { id: 'draft-walk', exercise: 'Cycling', exercise_category: 'cardio', completed: false, actual_duration: 0, duration_unit: 'minutes' },
  ])])
  const data = await load(db)
  assert.deepEqual(data.series, [])
  const details = data.sessions[0].entries.map(entry => entry.detail).join(' ')
  assert.match(details, /bodyweight record, not an external-load trend/)
  assert.match(details, /assistance record, not an external-load trend/)
  assert.match(details, /Saved as skipped/)
  assert.match(details, /90 seconds/);assert.match(details, /0 minutes · completion not confirmed/)
  assert.doesNotMatch(details, /estimated|calories|prescribed/i)
  db.verify()
})

test('canonical completion still uses original set denominator and actual history never mutates a saved workout', async () => {
  const logs = [exercise([set(), set(15, 'lb', { id: 'b', set_number: 2 })], { completed: false, user_intent: { desired_set_count: 1 } })]
  const db = fixture([row(logs)])
  const data = await load(db)
  assert.equal(data.sessions[0].completed, true)
  assert.equal(logs[0].planned_sets, 4);assert.equal(logs[0].user_intent.desired_set_count, 1)
  const partial = await load(fixture([row([exercise([set()], { completed: true })], { completed: true })]))
  assert.equal(partial.sessions[0].completed, false)
  db.verify()
})

test('member-local ranges retain civil legacy dates, DST timestamp boundaries, tied ordering and recorded daily maxima', async () => {
  const db = fixture([
    row([exercise([set(10)])], { id: 'z', workout_started_at: '2026-11-04T05:30:00Z', workout_date: '2026-11-04' }),
    row([exercise([set(15)])], { id: 'a', workout_started_at: '2026-11-04T05:30:00Z', workout_date: '2026-11-04' }),
    row([exercise([set(20)])], { id: 'legacy', workout_started_at: null, workout_date: '2026-11-03' }),
    row([exercise([set(30)])], { id: 'future', workout_started_at: '2026-11-04T06:00:00Z', workout_date: '2026-11-04' }),
    row([exercise([set(5)])], { id: 'older', workout_started_at: '2026-08-15T18:00:00Z', workout_date: '2026-08-15' }),
    row([exercise([set(3)])], { id: 'all-time', workout_started_at: null, workout_date: '2025-01-01' }),
  ])
  const data = await load(db)
  assert.deepEqual(data.sessions.map(session => session.date), ['2026-11-03', '2026-11-03', '2026-11-03'])
  assert.deepEqual(data.sessions.filter(session => session.id !== 'legacy').map(session => session.id), ['z', 'a'])
  assert.deepEqual(data.series[0].points, [{ date: '2026-11-03', value: 20 }])
  assert.ok((await load(db, { range: '12w' })).sessions.some(session => session.id === 'older'))
  const all = await load(db, { range: 'all' });assert.ok(all.sessions.some(session => session.id === 'all-time'));assert.ok(!all.sessions.some(session => session.id === 'future'))
  db.verify()
})

test('bounded reads expose source/detail coverage, preserve stable ties and never claim complete all-time data', async () => {
  const db = fixture(Array.from({ length: 501 }, (_, index) => row(undefined, { id: `saved-${String(index).padStart(4, '0')}` })))
  const data = await load(db, { range: 'all' })
  assert.equal(data.capped, true);assert.equal(data.sessions.length, 500);assert.equal(data.sessions[0].id, 'saved-0500')
  assert.equal(data.periodLabel, 'All-time range')
  for (const read of db.reads) { assert.equal(read.limit, 501);assert.ok(read.orders.some(([key]) => key === 'id')) }
  assert.equal(db.reads[0].orders[0][1].nullsFirst, false)
  const details = await load(fixture([row(Array.from({ length: 101 }, (_, index) => exercise([set(10)], { id: `exercise-${index}` })))]))
  assert.equal(details.detailCapped, true);assert.equal(details.sessions[0].entries.length, 100)
  const fullSets = Array.from({ length: 100 }, (_, index) => set(10, 'lb', { id: `set-${index}`, set_number: index + 1 }))
  const bulk = await load(fixture([
    row(Array.from({ length: 99 }, (_, index) => exercise(fullSets, { id: `bulk-${index}` })), { id: 'z-bulk' }),
    row([exercise(fullSets), exercise(fullSets, { id: 'outside' })], { id: 'a-later' }),
  ]))
  assert.equal(bulk.detailCapped, true)
  assert.ok(bulk.sessions.find(session => session.id === 'a-later').entries.some(entry => /outside this view’s detail limit/.test(entry.detail)))
  assert.ok(!bulk.sessions.find(session => session.id === 'a-later').entries.some(entry => /No confirmed set load/.test(entry.detail)))
  const entryBound = await load(fixture(Array.from({ length: 21 }, (_, index) => row(Array.from({ length: 100 }, () => exercise()), { id: `entry-${index}` }))))
  assert.equal(entryBound.detailCapped, true)
  assert.ok(entryBound.sessions.some(session => session.entries.some(entry => entry.id === 'detail-limit')))
  db.verify()
})

test('empty, missing-detail and transport failures remain distinct and no raw private metadata is returned', async () => {
  const empty = await load(fixture());assert.equal(empty.unavailable, false);assert.deepEqual(empty.sessions, [])
  for (const fail of [true, 'throw']) { const data = await load(fixture([], { fail }));assert.equal(data.unavailable, true);assert.deepEqual(data.sessions, []) }
  const db = fixture([row(null, { completed: true, notes: 'private-note', input_snapshot: { private: 'health-answer' } })])
  const missing = await load(db)
  assert.equal(missing.sessions.length, 1);assert.equal(missing.sessions[0].completed, true)
  assert.match(missing.sessions[0].entries[0].detail, /unavailable/)
  assert.doesNotMatch(JSON.stringify(missing), /private-note|health-answer|input_snapshot|notes/)
  db.verify()
})

test('legacy missing-timestamp fallback and all default helper query/response behavior are retained', async () => {
  const db = fixture([row([], { id: 'old', workout_started_at: null, workout_date: '2026-11-03', completed: true })], { missingTimestamp: true })
  const fallback = await load(db)
  assert.equal(fallback.unavailable, false);assert.equal(fallback.sessions[0].id, 'old')
  const regular = fixture([row()])
  const result = await loadWorkoutHistory({ supabase: regular.supabase, client, authUserId: user.id, startDate: '2026-11-01' })
  assert.deepEqual(Object.keys(result).sort(), ['data', 'error'])
  assert.equal(regular.reads[0].limit, 100);assert.equal(regular.reads[1].limit, undefined)
  assert.deepEqual(regular.reads[0].orders, [['workout_started_at', { ascending: false }]])
  assert.deepEqual(regular.reads[1].orders, [['workout_date', { ascending: false }]])
})
