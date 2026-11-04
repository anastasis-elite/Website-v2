import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'

const now = new Date('2026-11-03T05:30:00Z')
const user = { id: 'synthetic-owner' }
const client = { client_id: 'synthetic-client', auth_user_id: user.id, program: 'ember', access: true, active: true, timezone: 'America/Los_Angeles', cycle_tracking_enabled: true, reproductive_status: 'cycling' }
const row = (log_date, extra = {}) => ({ client_id: client.client_id, auth_user_id: user.id, log_date, period_started: true, ...extra })
const module = () => importTs('lib/dashboard/cycleProgress.ts')
function database(rows = [], { fail = false, unsafe = false, reject = false, failBefore = false } = {}) {
  const reads = [], initial = structuredClone(rows)
  return { reads, verify() { assert.deepEqual(rows, initial) }, supabase: { from(table) {
    assert.equal(table, 'cycle_logs')
    const state = { table, columns: '', filters: [], orders: [], limit: 0 }; reads.push(state)
    const query = {
      select(columns) { state.columns = columns; return query },
      eq(key, value) { state.filters.push(['eq', key, value]); return query },
      gte(key, value) { state.filters.push(['gte', key, value]); return query },
      lte(key, value) { state.filters.push(['lte', key, value]); return query },
      lt(key, value) { state.filters.push(['lt', key, value]); return query },
      order(key, options) { state.orders.push([key, options]); return query },
      limit(value) { state.limit = value; return query },
      then(yes, no) {
        if (reject) return Promise.reject(new Error('PRIVATE_TRANSPORT_ERROR')).then(yes, no)
        if (fail || failBefore && state.filters.some(([op]) => op === 'lt')) return Promise.resolve({ data: null, error: { message: 'PRIVATE_SOURCE_ERROR' } }).then(yes, no)
        const filtered = rows.filter(row => unsafe || state.filters.every(([op, key, value]) => op === 'eq' ? row[key] === value : op === 'gte' ? row[key] >= value : op === 'lte' ? row[key] <= value : row[key] < value))
        const data = [...filtered].sort((a, b) => String(b.log_date).localeCompare(String(a.log_date))).slice(0, state.limit)
        return Promise.resolve({ data, error: null }).then(yes, no)
      },
    }
    return query
  }, rpc() { throw new Error('Read-only fixture') }, storage: { from() { throw new Error('No private media access') } } } }
}
const load = async (db, overrides = {}) => (await module()).loadCycleProgress({ supabase: db.supabase, user, client, range: '4w', now, ...overrides })

test('cycle trend requires canonical owner and existing coaching/trend access before reads', async () => {
  for (const override of [
    { user: null }, { user: { id: 'foreign' } }, { client: null }, { now: new Date('invalid') },
    ...['free', 'tracker', 'unknown'].map(program => ({ client: { ...client, program } })),
    { client: { ...client, access: false } }, { client: { ...client, active: false } },
    { client: { ...client, membership_expires_at: '2026-11-03T05:29:00Z' } },
  ]) {
    const db = database(); await assert.rejects(load(db, override)); assert.equal(db.reads.length, 0)
  }
  for (const program of ['ember', 'ignite', 'phoenix']) {
    const db = database(); assert.equal((await load(db, { client: { ...client, program } })).enabled, true); assert.equal(db.reads.length, 2)
  }
  for (const denied of ['generatedCoaching', 'progressView', 'trendsView']) {
    const guarded = await importTs('lib/dashboard/cycleProgress.ts', { '@/lib/membership/policy': `export const membershipCan = (_client, capability) => capability !== '${denied}'` })
    const db = database(); await assert.rejects(guarded.loadCycleProgress({ supabase: db.supabase, user, client, range: '4w', now })); assert.equal(db.reads.length, 0)
  }
})

test('disabled preferences do not fetch or return historical cycle data', async () => {
  for (const override of [ { cycle_tracking_enabled: false }, { cycle_tracking_enabled: null }, ...['not_tracking', 'menopause', 'pregnant'].map(reproductive_status => ({ reproductive_status })) ]) {
    const db = database([row('2026-10-10'), row('2026-11-01')]); const result = await load(db, { client: { ...client, ...override } })
    assert.equal(result.enabled, false); assert.equal(result.unavailable, false); assert.deepEqual(result.intervals, []); assert.deepEqual(result.points, []); assert.equal(db.reads.length, 0)
  }
})

test('actual logged starts are deduplicated and use the preceding start across local range boundary', async () => {
  const db = database([
    row('2026-09-05'), row('2026-10-05'), row('2026-10-06'), row('2026-10-06'), row('2026-11-02'), row('2026-11-03'),
    row('2026-10-15', { period_started: false, cycle_day: 1, cycle_phase: 'menstrual' }),
  ])
  const result = await load(db, { client: { ...client, last_period_start: '2026-10-20', average_cycle_length: 28, estimated_next_period_start: '2026-11-17' } })
  assert.equal(result.today, '2026-11-02')
  assert.deepEqual(result.intervals, [{ start: '2026-10-05', date: '2026-10-06', days: 1 }, { start: '2026-10-06', date: '2026-11-02', days: 27 }])
  assert.deepEqual(result.points, [{ date: '2026-10-06', value: 1 }, { date: '2026-11-02', value: 27 }])
  assert.equal(result.coverageStart, '2026-10-06'); assert.equal(result.coverageEnd, '2026-11-02')
  for (const read of db.reads) {
    assert.equal(read.columns, 'client_id,auth_user_id,log_date,period_started')
    assert.ok(read.filters.some(filter => filter.join('|') === `eq|auth_user_id|${user.id}`))
    assert.ok(read.filters.some(filter => filter.join('|') === `eq|client_id|${client.client_id}`))
    assert.ok(read.filters.some(filter => filter.join('|') === 'eq|period_started|true'))
    assert.ok(read.filters.some(filter => filter.join('|') === 'lte|log_date|2026-11-02'))
  }
  assert.deepEqual(db.reads.map(read => read.limit), [501, 1])
  assert.doesNotMatch(JSON.stringify(result), /synthetic-owner|synthetic-client|phase|prediction|estimated/)
  db.verify()
})

test('12-week boundary includes a prior start and calendar intervals ignore DST and leap-day offsets', async () => {
  const db = database([row('2026-08-10'), row('2026-08-11'), row('2026-11-02')])
  const result = await load(db, { range: '12w' })
  assert.deepEqual(result.intervals, [{ start: '2026-08-10', date: '2026-08-11', days: 1 }, { start: '2026-08-11', date: '2026-11-02', days: 83 }])
  const { buildCycleProgress } = await module()
  const leap = buildCycleProgress({ range: 'all', today: '2024-03-11', rows: { data: [row('2024-03-11'), row('2024-02-11')] }, clientId: client.client_id, userId: user.id })
  assert.deepEqual(leap.points, [{ date: '2024-03-11', value: 29 }])
  const dst = await load(database([row('2026-03-09'), row('2026-03-07')]), { range: 'all', now: new Date('2026-03-09T12:00:00Z') })
  assert.deepEqual(dst.points, [{ date: '2026-03-09', value: 2 }])
})

test('missing starts are empty while errors, failed predecessor and foreign rows are unavailable without health details', async () => {
  const empty = await load(database()); assert.deepEqual(empty.points, []); assert.equal(empty.unavailable, false)
  const single = await load(database([row('2026-11-02')])); assert.deepEqual(single.points, []); assert.equal(single.coverageStart, '2026-11-02')
  for (const options of [{ fail: true }, { reject: true }, { failBefore: true }, { unsafe: true }]) {
    const db = database([row('2026-10-06', { auth_user_id: 'foreign', notes: 'PRIVATE_HEALTH' })], options)
    const result = await load(db)
    assert.equal(result.unavailable, true); assert.deepEqual(result.points, []); assert.deepEqual(result.intervals, []); assert.doesNotMatch(JSON.stringify(result), /PRIVATE_|foreign|notes/)
  }
})

test('malformed dates, future records and non-start rows never become intervals or prediction fallbacks', async () => {
  const { buildCycleProgress } = await module()
  const result = buildCycleProgress({ range: 'all', today: '2026-11-02', rows: { data: [row('2026-11-03'), row('2026-11-02'), row('2026-10-01'), row('2026-02-30'), row('2026-10-20T00:00:00Z'), row('2026-10-20', { period_started: false })] }, clientId: client.client_id, userId: user.id })
  assert.deepEqual(result.points, [{ date: '2026-11-02', value: 32 }]); assert.equal(result.invalidCount, 3)
})

test('All Time is bounded to 500 source records with explicit coverage and an actual preceding sentinel', async () => {
  const rows = Array.from({ length: 504 }, (_, index) => row(new Date(Date.parse('2026-11-02T00:00:00Z') - index * 86400000).toISOString().slice(0, 10)))
  const db = database(rows), result = await load(db, { range: 'all' })
  assert.equal(result.capped, true); assert.equal(result.intervals.length, 500); assert.ok(result.points.every(point => point.value === 1))
  assert.equal(result.coverageStart, rows[499].log_date); assert.equal(result.coverageEnd, '2026-11-02')
  assert.equal(db.reads.length, 1); assert.equal(db.reads[0].limit, 501)
  assert.equal(result.intervals[0].start, rows[500].log_date)
  db.verify()
})
