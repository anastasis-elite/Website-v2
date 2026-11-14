import assert from 'node:assert/strict'
import test, { after, mock } from 'node:test'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { importTs } from './typescriptModule.mjs'

mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-11-15T00:20:00Z') })
after(() => mock.timers.reset())
const { readPeriodState, cycleTrackingAllowed } = await importTs('lib/cycle/periodState.ts')
const { POST } = await importTs('app/api/daily-check-in/route.ts', {
  'next/server': 'export const NextResponse = { json: (body, init) => Response.json(body, init) }',
  '@/lib/supabase/server': 'export const createClient = async () => globalThis.periodStateDb',
  '@/lib/dashboard/invalidateDailyPlan': 'export const invalidateDailyPlan = () => { globalThis.periodInvalidations++ }',
})
const clientId = 'QA-PERIOD-ONLY', owner = 'QA-OWNER', today = '2026-11-14'
const client = { client_id: clientId, auth_user_id: owner, reproductive_status: 'cycling', cycle_tracking_enabled: true,
  timezone: 'America/Los_Angeles', program: 'ember', last_period_start: '2026-10-15', average_cycle_length: 30 }
const historical = { id: 'old-start', client_id: clientId, auth_user_id: owner, log_date: '2026-10-15', period_started: true,
  bleeding: true, symptoms: { cramping: 'moderate' }, flow_burden_score: 13 }
const req = body => new Request('http://synthetic.test/api/daily-check-in', { method: 'POST', body: JSON.stringify({ clientId, date: today, energy: 7, ...body }) })

function database({ cycleRows = [historical], clientPatch = {}, signedIn = true, fail = () => false, afterRead = () => {} } = {}) {
  const tables = { clients: [{ ...client, ...clientPatch }], cycle_logs: structuredClone(cycleRows), recovery_logs: [] }, writes = [], reads = []
  const db = { tables, writes, reads, auth: { getUser: async () => ({ data: { user: signedIn ? { id: owner } : null } }) }, from(table) {
    let mode = 'read', payload, conflict = [], sort = null, limit = null, columns
    const filters = [], query = {
      select(value) { columns = value; return query },
      eq(key, value) { filters.push(row => row[key] === value); return query },
      in(key, values) { filters.push(row => values.includes(row[key])); return query },
      lte(key, value) { filters.push(row => row[key] <= value); return query },
      order(key, { ascending = true } = {}) { sort = [key, ascending]; return query },
      limit(value) { limit = value; return query },
      upsert(value, { onConflict }) { mode = 'upsert'; payload = value; conflict = onConflict.split(','); return query },
      update(value) { mode = 'update'; payload = value; return query },
      maybeSingle() { return Promise.resolve(resolve(true)) },
      then(done, reject) { return Promise.resolve(resolve()).then(done, reject) },
    }
    function resolve(single = false) {
      const operation = { table, mode, columns, payload }
      if (fail(operation)) return { data: null, error: { message: 'Synthetic storage failure' } }
      let rows = tables[table].filter(row => filters.every(filter => filter(row)))
      if (mode !== 'read') {
        const existing = mode === 'update' ? rows[0] : tables[table].find(row => conflict.every(key => row[key] === payload[key]))
        const row = existing || { id: `synthetic-${table}-${tables[table].length}` }
        Object.assign(row, structuredClone(payload))
        if (!existing) tables[table].push(row)
        writes.push({ table, payload: structuredClone(payload) }); rows = [row]
      } else reads.push(operation)
      if (sort) rows = [...rows].sort((a, b) => String(a[sort[0]]).localeCompare(String(b[sort[0]])) * (sort[1] ? 1 : -1))
      if (limit !== null) rows = rows.slice(0, limit)
      const result = { data: structuredClone(single ? rows[0] || null : rows), error: null }
      if (mode === 'read') afterRead(operation)
      return result
    }
    return query
  } }
  globalThis.periodStateDb = db; globalThis.periodInvalidations = 0
  return db
}

test('legacy starts remain unknown; explicit active persists without a day window, respects ownership and local date', async () => {
  const db = database()
  assert.deepEqual(await readPeriodState(db, client, today), { status: 'unknown', recordedDate: null })
  db.tables.cycle_logs.push({ ...historical, id: 'explicit', period_status: 'active' },
    { ...historical, auth_user_id: 'OTHER', log_date: today, period_status: 'ended' },
    { ...historical, log_date: '2026-11-15', period_status: 'ended' })
  assert.deepEqual(await readPeriodState(db, client, today), { status: 'active', recordedDate: '2026-10-15' })
  db.tables.cycle_logs.push({ ...historical, log_date: '2026-11-12', period_status: 'ended' })
  assert.deepEqual(await readPeriodState(db, client, today), { status: 'ended', recordedDate: '2026-11-12' })
  assert.deepEqual(await readPeriodState(db, { ...client, last_period_start: '2026-11-13' }, today), { status: 'unknown', recordedDate: null }, 'A newer legacy onset makes the earlier cycle status inapplicable.')
})

test('new start and repeated same-day save preserve cycle history, detailed flow, and one daily row', async () => {
  const current = { ...historical, id: 'today-details', log_date: today, period_started: false, ovulation_day: true,
    symptoms: { headache: 'mild' }, flow_burden_band: 'moderate', answered_fields: ['fatigue'] }
  const db = database({ cycleRows: [historical, current] }), old = structuredClone(db.tables.cycle_logs[0])
  for (let i = 0; i < 2; i++) {
    const response = await POST(req({ periodStarted: true }))
    assert.equal(response.status, 200)
    assert.deepEqual((await response.json()).periodState, { status: 'active', recordedDate: today })
  }
  assert.deepEqual(db.tables.cycle_logs[0], old)
  const saved = db.tables.cycle_logs.find(row => row.log_date === today)
  for (const key of ['id', 'ovulation_day', 'symptoms', 'flow_burden_band', 'flow_burden_score', 'answered_fields']) assert.deepEqual(saved[key], current[key])
  assert.equal(saved.period_started, true); assert.equal(saved.bleeding, true); assert.equal(saved.period_status, 'active')
  assert.equal(db.tables.clients[0].last_period_start, today)
  assert.equal(db.tables.clients[0].average_cycle_length, 30)
  assert.equal(db.tables.cycle_logs.length, 2); assert.equal(db.tables.recovery_logs.length, 1)
  assert.deepEqual(await readPeriodState(db, client, today), { status: 'active', recordedDate: today })
})

test('end and correction persist on reopening without resetting onset, deleting history, or inventing bleeding', async () => {
  const active = { ...historical, period_status: 'active' }
  const current = { ...historical, id: 'today-flow', log_date: today, period_started: false, bleeding: true, symptoms: { nausea: 'mild' } }
  const db = database({ cycleRows: [active, current] }), originalClient = structuredClone(db.tables.clients[0])
  for (const [action, status] of [['end', 'ended'], ['resume', 'active'], ['end', 'ended']]) {
    const response = await POST(req({ periodAction: action }))
    assert.equal(response.status, 200)
    assert.deepEqual((await response.json()).periodState, { status, recordedDate: today })
    assert.deepEqual(await readPeriodState(db, client, today), { status, recordedDate: today })
  }
  assert.deepEqual(db.tables.cycle_logs[0], active)
  assert.equal(db.tables.cycle_logs[1].bleeding, true, 'Earlier bleeding today remains recorded after end.')
  assert.deepEqual(db.tables.cycle_logs[1].symptoms, current.symptoms)
  assert.equal(db.tables.cycle_logs[1].period_started, false)
  assert.deepEqual(db.tables.clients[0], originalClient)
  for (const write of db.writes.filter(write => write.table === 'cycle_logs')) {
    assert.equal('bleeding' in write.payload, false); assert.equal('period_started' in write.payload, false)
  }
  const unknown = database({ cycleRows: [] })
  assert.equal((await POST(req({ periodAction: 'end' }))).status, 200)
  assert.equal('bleeding' in unknown.tables.cycle_logs[0], false, 'An end with no flow never creates bleeding.')
})

test('unknown can explicitly resume without fabricating a start, and an active period rejects a new start', async () => {
  const db = database()
  assert.equal((await POST(req({ periodAction: 'resume' }))).status, 200)
  assert.equal(db.tables.cycle_logs.find(row => row.log_date === today).period_started, undefined)
  assert.equal(db.tables.clients[0].last_period_start, client.last_period_start)
  const beforeStaleStart = structuredClone(db.tables)
  assert.equal((await POST(req({ periodAction: 'start' }))).status, 409, 'A same-day active correction is not a retry of a period onset.')
  assert.deepEqual(db.tables, beforeStaleStart)
  const active = database({ cycleRows: [{ ...historical, period_status: 'active' }] }), before = structuredClone(active.tables)
  assert.equal((await POST(req({ periodAction: 'start' }))).status, 409)
  assert.deepEqual(active.tables, before); assert.equal(active.writes.length, 0)
})

test('tracking disabled suppresses status reads and period actions but still saves ordinary check-in answers', async () => {
  for (const patch of [{ cycle_tracking_enabled: false }, ...['menopause', 'pregnant', 'not_tracking'].map(reproductive_status => ({ reproductive_status }))]) {
    assert.equal(cycleTrackingAllowed({ ...client, ...patch }), false)
    const db = database({ clientPatch: patch }), before = structuredClone(db.tables.cycle_logs)
    for (const periodAction of ['start', 'end', 'resume']) assert.equal((await POST(req({ periodAction }))).status, 409)
    assert.equal(db.writes.length, 0); assert.equal(db.reads.some(read => read.table === 'cycle_logs'), false)
    assert.equal((await POST(req({}))).status, 200)
    assert.deepEqual(db.tables.cycle_logs, before)
  }
})

test('invalid actions, incompatible start/end, stale local date, and owner failures do not write', async () => {
  for (const [options, body, status] of [
    [{}, { periodAction: 'other' }, 400], [{}, { periodAction: 'end', periodStarted: true }, 400], [{}, { periodStarted: 'true' }, 400],
    [{}, { date: '2026-11-15', periodAction: 'start' }, 409], [{ signedIn: false }, { periodAction: 'end' }, 401],
    [{ clientPatch: { auth_user_id: 'OTHER' } }, { periodAction: 'end' }, 404],
  ]) {
    const db = database(options), before = structuredClone(db.tables)
    assert.equal((await POST(req(body))).status, status)
    assert.deepEqual(db.tables, before); assert.equal(db.writes.length, 0)
  }
})

test('read and period-write failures never mark the daily check-in complete; confirmed partial saves report state and retry safely', async () => {
  for (const operation of [
    op => op.table === 'cycle_logs' && op.mode === 'read',
    op => op.table === 'recovery_logs' && op.mode === 'read',
    op => op.table === 'cycle_logs' && op.mode === 'upsert',
  ]) {
    const db = database({ fail: operation })
    const response = await POST(req({ periodAction: 'start' }))
    assert.ok([500, 503].includes(response.status)); assert.equal(db.writes.length, 0)
  }
  let failRecovery = true
  const db = database({ fail: op => failRecovery && op.table === 'recovery_logs' && op.mode === 'upsert' })
  const failed = await POST(req({ periodAction: 'start' }))
  assert.equal(failed.status, 500)
  const payload = await failed.json()
  assert.equal(payload.partialSave, true); assert.deepEqual(payload.periodState, { status: 'active', recordedDate: today })
  assert.equal(payload.retryPeriodAction, false)
  assert.match(payload.error, /period update was saved/); assert.equal(db.tables.recovery_logs.length, 0)
  failRecovery = false
  assert.equal((await POST(req({ periodAction: 'start' }))).status, 200)
  assert.equal(db.tables.cycle_logs.length, 2); assert.equal(db.tables.recovery_logs.length, 1)
  assert.deepEqual(db.tables.cycle_logs[0], historical)
})

test('client-summary failure retains the start action for retry and repairs the saved cycle summary', async () => {
  let failSummary = true
  const db = database({ fail: op => failSummary && op.table === 'clients' && op.mode === 'update' })
  const first = await POST(req({ periodAction: 'start' }))
  assert.equal(first.status, 500)
  const payload = await first.json()
  assert.equal(payload.partialSave, true); assert.equal(payload.retryPeriodAction, true)
  assert.deepEqual(payload.periodState, { status: 'active', recordedDate: today })
  assert.equal(db.tables.clients[0].last_period_start, client.last_period_start)
  assert.equal(db.tables.recovery_logs.length, 0)
  failSummary = false
  assert.equal((await POST(req({ periodAction: 'start' }))).status, 200)
  assert.equal(db.tables.clients[0].last_period_start, today)
  assert.equal(db.tables.cycle_logs.length, 2); assert.equal(db.tables.recovery_logs.length, 1)
  assert.deepEqual(db.tables.cycle_logs[0], historical)
})

test('member-local midnight before any persistence rejects without writing yesterday into today', async t => {
  mock.timers.setTime(Date.parse('2026-11-15T07:59:59Z'))
  t.after(() => mock.timers.setTime(Date.parse('2026-11-15T00:20:00Z')))
  const db = database({ afterRead: op => { if (op.table === 'recovery_logs') mock.timers.setTime(Date.parse('2026-11-15T08:00:00Z')) } })
  const before = structuredClone(db.tables)
  assert.equal((await POST(req({ periodAction: 'start' }))).status, 409)
  assert.deepEqual(db.tables, before); assert.equal(db.writes.length, 0)
})

test('migration adds nullable explicit state without backfilling or changing recorded cycle details', async t => {
  const pg = new PGlite(); t.after(() => pg.close())
  await pg.exec(`create table cycle_logs(id text primary key, client_id text, auth_user_id text, log_date date,
    period_started boolean, bleeding boolean, symptoms jsonb, flow_burden_score numeric);
    insert into cycle_logs values('old','member','owner','2026-10-15',true,true,'{"cramping":"moderate"}',13);`)
  const before = (await pg.query('select * from cycle_logs')).rows[0]
  await pg.exec(readFileSync('supabase/migrations/20261114135621_daily_check_in_period_status.sql', 'utf8'))
  const after = (await pg.query('select * from cycle_logs')).rows[0]
  assert.deepEqual(after, { ...before, period_status: null })
  await pg.exec("update cycle_logs set period_status='active'")
  assert.equal((await pg.query('select period_status from cycle_logs')).rows[0].period_status, 'active')
  await assert.rejects(pg.exec("update cycle_logs set period_status='guessed'"), /check constraint/)
})
