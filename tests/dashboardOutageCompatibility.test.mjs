import assert from 'node:assert/strict'
import test, { after, mock } from 'node:test'
import { readFileSync } from 'node:fs'
import { importTs } from './typescriptModule.mjs'

// Schema metadata only; all member records and API sessions below are synthetic.
const metadata = JSON.parse(readFileSync('tests/fixtures/production-schema-metadata-2026-10-13.json', 'utf8'))
const schema = new Map(metadata.tables.map(table => [table.table_name, new Set(table.columns.map(column => column.name))]))
mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-13T20:40:00Z') })
after(() => mock.timers.reset())
const mocks = {
  'next/server': 'export const NextResponse = { json: (body, init) => Response.json(body, init) }',
  '@/lib/supabase/server': 'export const createClient = async () => globalThis.outageDatabase',
  '@/lib/dashboard/getDashboardContext': 'export const getDashboardContext = async () => ({ supabase: globalThis.outageDatabase, user: { id: "11111111-1111-4111-8111-111111111111" }, client: globalThis.outageDatabase.client })',
  '@/lib/dashboard/invalidateDailyPlan': 'export const invalidateDailyPlan = () => { globalThis.outageInvalidations++ }',
  '@/lib/calendar/service': 'export const importedScheduleEvents = async () => { if(globalThis.outageCalendarError) throw new Error("Calendar unavailable"); return [] }',
  '@/lib/supabase/admin': 'export const createAdminClient = () => globalThis.outageAuditAdmin',
}
const { getDailyExecutionPlan } = await importTs('lib/day/getDailyExecutionPlan.ts')
const { getProgramLogicForClient } = await importTs('lib/dashboard/logic/getProgramLogicForClient.ts')
const { getDailyScheduleState } = await importTs('lib/schedule/service.ts', mocks)
const { logRecommendationAudit } = await importTs('lib/legal/logRecommendationAudit.ts', mocks)
const checkIn = await importTs('app/api/daily-check-in/route.ts', mocks)
const water = await importTs('app/api/nutrition/add-water/route.ts', mocks)
const workout = await importTs('app/api/workout-log/route.ts', mocks)
const manualWorkout = await importTs('app/api/workout-set-log/route.ts', mocks)
const recovery = await importTs('app/api/recovery/activity/route.ts', mocks)
const scheduleApi = await importTs('app/api/schedule/route.ts', mocks)
const owner = '11111111-1111-4111-8111-111111111111', clientId = 'QA-OUTAGE-ONLY'
const clientFor = program => ({ client_id: clientId, auth_user_id: owner, full_name: 'Synthetic QA Member', program,
  timezone: 'America/Chicago', onboarding_data: {}, reproductive_status: 'not_tracking', work_start_time: '09:00', work_end_time: '17:00' })
const req = body => new Request('http://synthetic.test/api/qa', { method: 'POST', body: JSON.stringify(body) })

function database(program = 'ignite', { throwDerivedWrites = false } = {}) {
  const client = clientFor(program), writes = [], failures = []
  const tables = {
    clients: [client], assessments: [], program_outputs: [],
    recovery_logs: [{ id: 'saved-check-in', client_id: clientId, auth_user_id: owner, log_date: '2026-10-13', energy_level: 7, sleep_hours: 8, stress_level: 3, soreness_level: 2, check_in_completed_at: '2026-10-13T13:00:00Z' }],
    nutrition_logs: [{ id: 'saved-water', client_id: clientId, auth_user_id: owner, log_date: '2026-10-13', calories: 1800, protein: 100, carbs: 200, fats: 60, water_oz: 96, water_consumed_oz: 24 }],
    workout_logs: [{ id: 'saved-workout', client_id: clientId, auth_user_id: owner, program, day_name: 'Saved walk', workout_date: '2026-10-13', completed: true, updated_at: '2026-10-13T18:30:00Z', exercise_logs: [{ exercise: 'Walk', completed: true, actual_duration: 20 }] }],
  }
  const db = { tables, writes, failures, client, auth: { getUser: async () => ({ data: { user: { id: owner } }, error: null }) }, from(table) {
    let columns = '*', mutation = null, mode = null, single = false, sorting = null, size = null
    const filters = [], referenced = new Set()
    const q = {
      select(value = '*') { columns = value; return q },
      eq(key, value) { referenced.add(key); filters.push(row => row[key] === value); return q },
      in(key, values) { referenced.add(key); filters.push(row => values.includes(row[key])); return q },
      gte(key, value) { referenced.add(key); filters.push(row => row[key] >= value); return q },
      lte(key, value) { referenced.add(key); filters.push(row => row[key] <= value); return q },
      lt(key, value) { referenced.add(key); filters.push(row => row[key] < value); return q },
      or() { return q },
      order(key, { ascending = true } = {}) { referenced.add(key); sorting = [key, ascending]; return q },
      limit(value) { size = value; return q },
      upsert(value) { mutation = value; mode = 'upsert'; return q },
      insert(value) { mutation = value; mode = 'insert'; return q },
      update(value) { mutation = value; mode = 'update'; return q },
      maybeSingle() { single = true; return Promise.resolve().then(resolve) },
      single() { single = true; return Promise.resolve().then(resolve) },
      then(done, reject) { return Promise.resolve().then(resolve).then(done, reject) },
    }
    function resolve() {
      if (mutation && throwDerivedWrites && ['dashboard_daily_recommendations', 'daily_execution_status'].includes(table)) throw new Error('Derived persistence transport failed')
      const known = schema.get(table)
      let error = known ? null : { code: 'PGRST205', message: `Could not find the table public.${table} in the schema cache` }
      for (const key of columns.split(',').map(value => value.trim()).filter(value => value !== '*' && !value.includes('('))) referenced.add(key)
      for (const key of Object.keys(mutation || {})) referenced.add(key)
      const missing = known && [...referenced].find(key => !known.has(key))
      if (missing) error = { code: '42703', message: `column ${table}.${missing} does not exist` }
      if (error) { failures.push({ table, error }); return { data: null, error } }
      let rows = (tables[table] || []).filter(row => filters.every(filter => filter(row)))
      if (mutation) {
        const existing = mode === 'upsert' ? rows.find(row => row.client_id === mutation.client_id && row.log_date === mutation.log_date) : mode === 'update' ? rows[0] : null
        const row = existing || { id: `synthetic-${table}`, ...mutation }
        if (existing) Object.assign(row, mutation)
        else (tables[table] ||= []).push(row)
        writes.push({ table, mutation: structuredClone(mutation) }); rows = [row]
      }
      if (sorting) rows.sort((a, b) => String(a[sorting[0]]).localeCompare(String(b[sorting[0]])) * (sorting[1] ? 1 : -1))
      if (size !== null) rows = rows.slice(0, size)
      return { data: structuredClone(single ? rows[0] || null : rows), error: null }
    }
    return q
  }, async rpc(name) {
    failures.push({ rpc: name }); return { data: null, error: { code: 'PGRST202', message: `Could not find the function public.${name} in the schema cache` } }
  } }
  globalThis.outageDatabase = db; globalThis.outageInvalidations = 0; globalThis.outageCalendarError = false
  return db
}

test('all tiers load recorded check-in, water and completed workout with missing production schedule/schema', async t => {
  t.mock.method(console, 'error', () => {})
  assert.equal(schema.has('client_schedule_blocks'), false)
  for (const program of ['ember', 'ignite', 'phoenix']) {
    const db = database(program, { throwDerivedWrites: true }), before = structuredClone(db.tables)
    const dailyPlan = await getDailyExecutionPlan({ supabase: db, client: db.client })
    const logic = await getProgramLogicForClient({ supabase: db, user: { id: owner }, client: db.client })
    const schedule = await getDailyScheduleState({ supabase: db, user: { id: owner }, client: db.client, logic })
    assert.equal(dailyPlan.workoutCompleted, true)
    assert.equal(logic.assessments.dailyCompleted, true)
    assert.equal(logic.hydration.consumed, 24)
    assert.equal(logic.execution.workoutComplete, true)
    assert.equal(schedule.dailyRecommendation.date, '2026-10-13')
    assert.equal(schedule.dailyRecommendation.evidence.checkIn, 'completed')
    assert.ok(schedule.unavailableSources.includes('recurring_commitments'))
    assert.ok(schedule.events.some(event => event.event_type === 'work'), 'Legacy saved commitments remain visible')
    assert.deepEqual(schedule.openWindows, [])
    assert.deepEqual(schedule.adjustments, [])
    assert.equal(schedule.nextAction.can_defer, false)
    assert.deepEqual(db.tables, before)
    assert.deepEqual(db.writes, [])
  }
})

test('a calendar failure is isolated alongside recurring and persisted schedule failures', async t => {
  t.mock.method(console, 'error', () => {})
  const db = database(); globalThis.outageCalendarError = true
  const state = await getDailyScheduleState({ supabase: db, user: { id: owner }, client: db.client })
  assert.deepEqual(new Set(state.unavailableSources), new Set(['saved_events', 'recurring_commitments', 'calendar']))
  assert.ok(state.events.some(event => event.event_type === 'work'))
  assert.deepEqual(db.writes, [])
})

test('audit permission denial and rejected transport remain observable without rejecting the caller', async t => {
  const errors = []; t.mock.method(console, 'error', (...args) => errors.push(args))
  const args = { userId: owner, clientId, recommendationType: 'daily_program_logic', engineVersion: 'qa', recommendationOutput: {}, supabase: database() }
  globalThis.outageAuditAdmin = { from: () => ({ insert: async () => ({ error: { code: '42501', message: 'permission denied for table recommendation_audit_logs' } }) }) }
  assert.equal(await logRecommendationAudit(args), false)
  globalThis.outageAuditAdmin = { from: () => ({ insert: async () => { throw new Error('Audit transport unavailable') } }) }
  assert.equal(await logRecommendationAudit(args), false)
  assert.equal(errors.length, 2)
  assert.match(errors[0][1], /Database write rejected/)
  assert.equal(errors[0][2].code, '42501')
  assert.match(errors[1][1], /Audit operation unavailable/)
})

test('schedule API can read a partial day but rejects a new time without a full conflict check', async t => {
  t.mock.method(console, 'error', () => {})
  const db = database(), before = structuredClone(db.tables)
  const response = await scheduleApi.GET(new Request('http://synthetic.test/api/schedule'))
  assert.equal(response.status, 200)
  assert.ok((await response.json()).schedule.unavailableSources.length)
  const save = await scheduleApi.POST(req({ client_id: clientId, title: 'Synthetic appointment', start_at: '2026-10-13T21:00:00Z', end_at: '2026-10-13T21:30:00Z' }))
  assert.equal(save.status, 503)
  assert.deepEqual(db.tables, before)
  assert.deepEqual(db.writes, [])
})

test('legacy schema reads saved workout progress without newer workout_source columns', async () => {
  const db = database(), before = structuredClone(db.tables)
  const response = await workout.GET(new Request(`http://synthetic.test/api/workout-log?clientId=${clientId}&dayName=Saved%20walk&source=recommended`))
  assert.equal(response.status, 200)
  assert.equal((await response.json()).session.id, 'saved-workout')
  const manual = await workout.GET(new Request(`http://synthetic.test/api/workout-log?clientId=${clientId}&dayName=Saved%20walk&source=manual`))
  assert.equal((await manual.json()).session, null)
  assert.deepEqual(db.tables, before)
})

test('check-in saves supported answers; unavailable water/workout/recovery writes remain failures and preserve history', async () => {
  const db = database()
  assert.equal((await checkIn.POST(req({ clientId, energy: 8 }))).status, 200)
  assert.equal(db.tables.recovery_logs[0].energy_level, 8)
  assert.equal(db.tables.recovery_logs[0].check_in_completed_at, '2026-10-13T13:00:00Z')
  const before = structuredClone(db.tables), writes = db.writes.length, invalidations = globalThis.outageInvalidations
  const drink = await water.POST(req({ clientId, ounces: 8, submissionId: '33333333-3333-4333-8333-333333333333', logDate: '2026-10-13' }))
  assert.equal(drink.status, 500)
  const session = await workout.POST(req({ client_id: clientId, program: 'ignite', day_name: 'Walk', planned_exercises: [{ exercise: 'Walk' }], exercise_logs: [{ exercise: 'Walk', completed: true, actual_duration: 20, duration_unit: 'minutes', confirmed_at: '2026-10-13T20:30:00Z' }], completed: true }))
  assert.equal(session.status, 500)
  const manual = await manualWorkout.POST(req({ client_id: clientId, program: 'ignite', sets: [], exercise_logs: [] }))
  assert.equal(manual.status, 500)
  assert.equal((await recovery.POST(req({ clientId, activityType: 'Mobility', minutes: 10 }))).status, 500)
  assert.deepEqual(db.tables, before)
  assert.equal(db.writes.length, writes)
  assert.equal(globalThis.outageInvalidations, invalidations)
  assert.ok(db.failures.some(failure => failure.rpc === 'add_daily_water'))
  assert.ok(db.failures.some(failure => failure.rpc === 'save_daily_workout'))
})
