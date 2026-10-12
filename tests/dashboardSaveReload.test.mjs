import assert from 'node:assert/strict'
import test, { after, mock } from 'node:test'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import { importTs } from './typescriptModule.mjs'

// Freeze the dashboard's civil date so save/reload cannot straddle midnight.
mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-12T20:40:00.000Z') })
after(() => mock.timers.reset())

// Execute production routes and dashboard readers. Only the authenticated session,
// Supabase transport, and Next cache invalidation use disposable local substitutes.
const mocks = {
  'next/server': 'export const NextResponse = { json: (body, init) => Response.json(body, init) }',
  '@/lib/supabase/server': 'export const createClient = async () => globalThis.dashboardPersistenceDb',
  '@/lib/dashboard/invalidateDailyPlan': 'export const invalidateDailyPlan = () => { globalThis.dashboardPersistenceInvalidations++ }',
}
const checkIn = await importTs('app/api/daily-check-in/route.ts', mocks)
const water = await importTs('app/api/nutrition/add-water/route.ts', mocks)
const recovery = await importTs('app/api/recovery/activity/route.ts', mocks)
const { loadDailySignals } = await importTs('lib/dashboard/dailySignals.ts')
const { getDailyExecutionPlan } = await importTs('lib/day/getDailyExecutionPlan.ts')
const { getProgramLogicEngine } = await importTs('lib/dashboard/logic/getProgramLogicEngine.ts')
const { buildDailyRecommendation } = await importTs('lib/dashboard/dailyRecommendation.ts')
const { getClientLocalDate, addLocalDays } = await importTs('lib/timezone.ts')
const owner = '11111111-1111-4111-8111-111111111111'
const otherOwner = '22222222-2222-4222-8222-222222222222'
const clientId = 'QA-SAVE-RELOAD-ONLY'
const foreignId = 'QA-UNTOUCHED-OTHER'
const client = { client_id: clientId, auth_user_id: owner, program: 'ignite', timezone: 'America/Chicago',
  full_name: 'Disposable QA Member', birthdate: '1991-04-15', reproductive_status: 'not_tracking', wake_time: '07:00', bed_time: '22:00' }
const today = getClientLocalDate(client)
const yesterday = addLocalDays(today, -1)
const req = (body) => new Request('http://disposable.test/api/qa', { method: 'POST', body: JSON.stringify(body) })

function initialStore() {
  return {
    clients: [structuredClone(client), { ...client, client_id: foreignId, auth_user_id: otherOwner }],
    recovery_logs: [
      { id: 'historical-recovery', client_id: clientId, auth_user_id: owner, log_date: yesterday, energy_level: 8, sleep_hours: 8, notes: 'Untouched prior day' },
      { id: 'other-recovery', client_id: foreignId, auth_user_id: otherOwner, log_date: today, energy_level: 9, sleep_quality: 8, notes: 'Untouched other member' },
    ],
    nutrition_logs: [
      { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', client_id: clientId, auth_user_id: owner, log_date: yesterday, water_consumed_oz: 32, water_oz: 96, water_submission_ids: [] },
      { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', client_id: foreignId, auth_user_id: otherOwner, log_date: today, water_consumed_oz: 64, water_oz: 96, water_submission_ids: [] },
    ],
    recovery_activity_logs: [
      { id: 'historical-activity', user_id: owner, client_id: clientId, log_date: yesterday, activity_type: 'Gentle walk', duration_minutes: 15 },
      { id: 'other-activity', user_id: otherOwner, client_id: foreignId, log_date: today, activity_type: 'Mobility', duration_minutes: 20 },
    ],
    assessments: [{ id: 'qa-strength', client_id: clientId, assessment_type: 'strength', submitted_at: `${yesterday}T16:00:00.000Z`, data: { weight: 160, height_in: 67, weight_goal: 'maintain' } }],
    cycle_logs: [], client_symptom_logs: [], workout_logs: [],
  }
}

function database({ store = initialStore(), signedIn = true, failTable = null, pg = null } = {}) {
  const tables = structuredClone(store), writes = [], user = signedIn ? { id: owner } : null
  const db = { tables, writes, auth: { getUser: async () => ({ data: { user }, error: null }) }, from(table) {
    const filters = []; let mutation = null, mode = null, conflictKeys = [], sorting = null, size = null, countOnly = false
    const q = {
      select(_columns, options) { countOnly = Boolean(options?.head); return q },
      eq(key, value) { filters.push(row => row[key] === value); return q },
      in(key, values) { filters.push(row => values.includes(row[key])); return q },
      gte(key, value) { filters.push(row => row[key] >= value); return q },
      lte(key, value) { filters.push(row => row[key] <= value); return q },
      lt(key, value) { filters.push(row => row[key] < value); return q },
      order(key, { ascending = true } = {}) { sorting = [key, ascending]; return q },
      limit(value) { size = value; return q },
      insert(value) { mutation = value; mode = 'insert'; return q },
      update(value) { mutation = value; mode = 'update'; return q },
      upsert(value, options = {}) { mutation = value; mode = 'upsert'; conflictKeys = (options.onConflict || 'id').split(','); return q },
      maybeSingle: async () => resolve(true), single: async () => resolve(true), then(done) { return Promise.resolve(resolve()).then(done) },
    }
    function resolve(single = false) {
      if (table === failTable) return { data: null, error: { message: 'Disposable storage failure' } }
      tables[table] ||= []
      let changed = []
      if (mutation) {
        for (const value of Array.isArray(mutation) ? mutation : [mutation]) {
          const existing = mode === 'update' ? tables[table].find(row => filters.every(filter => filter(row))) : mode === 'upsert' ? tables[table].find(row => conflictKeys.every(key => row[key] === value[key])) : null
          let row = existing
          if (existing) Object.assign(existing, structuredClone(value))
          else if (mode !== 'update') {
            row = { id: randomUUID(), created_at: new Date().toISOString(), ...(table === 'nutrition_logs' ? { water_submission_ids: [] } : {}), ...structuredClone(value) }
            tables[table].push(row)
          }
          if (row) { changed.push(row); writes.push({ table, value: structuredClone(value) }) }
        }
      }
      let rows = (mutation ? changed : tables[table]).filter(row => filters.every(filter => filter(row)))
      if (sorting) { const [key, ascending] = sorting; rows = [...rows].sort((a, b) => String(a[key]).localeCompare(String(b[key])) * (ascending ? 1 : -1)) }
      if (size !== null) rows = rows.slice(0, size)
      return { data: countOnly ? null : structuredClone(single ? rows[0] || null : rows), count: rows.length, error: null }
    }
    return q
  }, async rpc(name, args) {
    assert.equal(name, 'add_daily_water')
    assert.ok(pg, 'Water requests must execute the actual SQL function in disposable PGlite')
    const row = tables.nutrition_logs.find(log => log.id === args.p_log_id)
    if (row) await pg.query(`insert into nutrition_logs(id,auth_user_id,client_id,log_date,water_consumed_oz,water_submission_ids)
      values($1,$2,$3,$4,$5,$6) on conflict(id) do update set water_consumed_oz=excluded.water_consumed_oz,water_submission_ids=excluded.water_submission_ids`,
    [row.id, row.auth_user_id, row.client_id, row.log_date, row.water_consumed_oz || 0, row.water_submission_ids || []])
    await pg.query("select set_config('request.jwt.claim.sub',$1,false)", [user?.id || ''])
    try {
      const result = await pg.query('select add_daily_water($1,$2,$3) as result', [args.p_log_id, args.p_ounces, args.p_submission_id])
      Object.assign(row, result.rows[0].result)
      writes.push({ rpc: name, args: structuredClone(args) })
      return { data: structuredClone(row), error: null }
    } catch (error) { return { data: null, error: { message: error.message } } }
  } }
  globalThis.dashboardPersistenceDb = db
  globalThis.dashboardPersistenceInvalidations = 0
  return db
}

async function waterDatabase() {
  const pg = new PGlite()
  await pg.exec(`create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table nutrition_logs(id uuid primary key,auth_user_id uuid not null,client_id text not null,log_date date not null,
      water_consumed_oz numeric,water_submission_ids uuid[] not null default '{}',updated_at timestamptz);`)
  const migration = readFileSync('supabase/migrations/20261009004035_coordinated_daily_dashboard.sql', 'utf8')
  const functionSql = migration.match(/create or replace function public\.add_daily_water[\s\S]*?\$\$;/)?.[0]
  assert.ok(functionSql)
  await pg.exec(functionSql)
  return pg
}

async function refreshedLogic(db) {
  const currentClient = db.tables.clients.find(row => row.client_id === clientId)
  const dailyPlan = await getDailyExecutionPlan({ supabase: db, client: currentClient })
  return getProgramLogicEngine({ supabase: db, user: { id: owner }, client: currentClient, program: 'ignite', dailyPlan,
    cycleStatus: { enabled: false }, cycleAdjustment: null, plannedWorkout: null, plannedExercises: [], monthlyAssessmentsDueCount: 0 })
}

function assertExistingUntouched(before, after) {
  for (const table of ['clients', 'recovery_logs', 'nutrition_logs', 'recovery_activity_logs', 'assessments', 'cycle_logs']) {
    for (const existing of before[table]) {
      const key = existing.id ? 'id' : 'client_id'
      assert.deepEqual(after[table].find(row => row[key] === existing[key]), existing, `${table}: ${existing[key]} changed`)
    }
  }
}

test('daily check-in saves only answered inputs, survives reload/revisit, and updates the real dashboard decisions', async () => {
  const db = database(), before = structuredClone(db.tables)
  const initial = await refreshedLogic(db)
  assert.equal(initial.assessments.dailyCompleted, false)
  const response = await checkIn.POST(req({ clientId, energy: 3 }))
  assert.equal(response.status, 200)
  assert.equal(globalThis.dashboardPersistenceInvalidations, 1)
  const saved = db.tables.recovery_logs.find(row => row.client_id === clientId && row.log_date === today)
  assert.equal(saved.energy_level, 3)
  assert.equal(saved.auth_user_id, owner)
  assert.ok(saved.check_in_completed_at)
  for (const optional of ['sleep_hours', 'sleep_quality', 'stress_level', 'soreness_level', 'soreness_regions', 'mood_level', 'hunger_level', 'notes']) assert.ok(saved[optional] == null, `${optional} was fabricated`)
  assertExistingUntouched(before, db.tables)
  const reloaded = database({ store: db.tables })
  const signals = await loadDailySignals(reloaded, reloaded.tables.clients[0])
  assert.equal(signals.recovery.energy_level, 3)
  assert.equal(signals.recovery.sleep_hours, undefined)
  const updated = await refreshedLogic(reloaded)
  assert.equal(updated.assessments.dailyCompleted, true)
  assert.equal(updated.recoveryCheck.energy, 3)
  assert.equal(updated.recoveryCheck.stress, null)
  assert.equal(updated.sleep.hours, null)
  assert.equal(updated.recoveryStatus.status, 'modify_workout')
  assert.ok(updated.capacityStatus.score < initial.capacityStatus.score)
  const plan = buildDailyRecommendation(updated, { date: today, timezone: client.timezone, now: new Date().toISOString(), events: [], nextActionableEvent: null })
  assert.equal(plan.evidence.checkIn, 'completed')
  assert.notEqual(plan.primary.id, 'check-in')
  // A revisit updates this day's answers without clearing previously answered inputs.
  assert.equal((await checkIn.POST(req({ clientId, stress: 8 }))).status, 200)
  const revisited = database({ store: reloaded.tables })
  const again = await loadDailySignals(revisited, revisited.tables.clients[0])
  assert.equal(again.recovery.energy_level, 3)
  assert.equal(again.recovery.stress_level, 8)
  assert.equal(again.recovery.check_in_completed_at, saved.check_in_completed_at)
  assert.equal(revisited.tables.recovery_logs.filter(row => row.client_id === clientId && row.log_date === today).length, 1)
  assertExistingUntouched(before, revisited.tables)
})

test('hydration opens a disposable daily log, executes real SQL retry deduplication, and reloads into dashboard pacing', async t => {
  const pg = await waterDatabase(); t.after(() => pg.close())
  const db = database({ pg }), before = structuredClone(db.tables)
  const submissionId = randomUUID(), payload = { clientId, ounces: 12, submissionId }
  const response = await water.POST(req(payload))
  assert.equal(response.status, 200)
  const first = (await response.json()).nutritionLog
  assert.equal(first.water_consumed_oz, 12)
  assert.deepEqual(first.water_submission_ids, [submissionId])
  const retry = await water.POST(req(payload))
  assert.equal(retry.status, 200)
  assert.equal((await retry.json()).nutritionLog.water_consumed_oz, 12)
  assert.equal(db.tables.nutrition_logs.filter(row => row.client_id === clientId && row.log_date === today).length, 1)
  assertExistingUntouched(before, db.tables)
  const reloaded = database({ store: db.tables, pg })
  const updated = await refreshedLogic(reloaded)
  assert.equal(updated.hydration.consumed, 12)
  assert.notEqual(updated.hydration.status, 'needs_input')
  assert.equal(updated.hydration.remaining, first.water_oz - 12)
  assert.equal(updated.nutrition.dataStatus, 'needs_input')
  // Revisit/retry through a fresh authenticated transport still records the drink once.
  assert.equal((await water.POST(req(payload))).status, 200)
  assert.equal(reloaded.tables.nutrition_logs.find(row => row.id === first.id).water_consumed_oz, 12)
  assert.equal((await water.POST(req({ clientId, ounces: 8, submissionId: randomUUID() }))).status, 200)
  const revisited = database({ store: reloaded.tables, pg })
  assert.equal((await refreshedLogic(revisited)).hydration.consumed, 20)
  assertExistingUntouched(before, revisited.tables)
})

test('recovery activity saves and reloads as recorded completion without fabricating a daily check-in', async () => {
  const db = database(), before = structuredClone(db.tables)
  assert.equal((await refreshedLogic(db)).execution.recoveryComplete, false)
  const response = await recovery.POST(req({ clientId, activityType: 'Mobility', minutes: 12 }))
  assert.equal(response.status, 200)
  assert.equal(globalThis.dashboardPersistenceInvalidations, 1)
  const saved = db.tables.recovery_activity_logs.find(row => row.client_id === clientId && row.log_date === today)
  assert.deepEqual([saved.user_id, saved.activity_type, saved.duration_minutes], [owner, 'Mobility', 12])
  assertExistingUntouched(before, db.tables)
  const reloaded = database({ store: db.tables })
  const updated = await refreshedLogic(reloaded)
  assert.equal(updated.execution.recoveryComplete, true)
  assert.equal(updated.recoveryCheck.completed, true)
  assert.equal(updated.assessments.dailyCompleted, false)
  assert.equal(updated.recoveryCheck.energy, null)
  assert.equal(updated.sleep.hours, null)
  const revisited = database({ store: reloaded.tables })
  assert.equal((await refreshedLogic(revisited)).execution.recoveryComplete, true)
  assert.equal(revisited.tables.recovery_activity_logs.filter(row => row.client_id === clientId && row.log_date === today).length, 1)
  assertExistingUntouched(before, revisited.tables)
})

test('check-in, hydration and recovery reject unauthenticated/cross-owner saves without touching existing records', async () => {
  for (const [route, body] of [[checkIn, { energy: 4 }], [water, { ounces: 8, submissionId: randomUUID() }], [recovery, { activityType: 'Full rest' }]]) {
    const anonymous = database({ signedIn: false }), beforeAnonymous = structuredClone(anonymous.tables)
    assert.equal((await route.POST(req({ clientId, ...body }))).status, 401)
    assert.equal(anonymous.writes.length, 0)
    assert.equal(globalThis.dashboardPersistenceInvalidations, 0)
    assert.deepEqual(anonymous.tables, beforeAnonymous)
    const owned = database(), beforeOwned = structuredClone(owned.tables)
    assert.equal((await route.POST(req({ clientId: foreignId, ...body }))).status, 404)
    assert.equal(owned.writes.length, 0)
    assert.equal(globalThis.dashboardPersistenceInvalidations, 0)
    assert.deepEqual(owned.tables, beforeOwned)
  }
})

test('invalid optional check-in answers and failed saves remain explicit failures, with no fabricated completion', async () => {
  for (const body of [{}, { energy: null }, { energy: 4, sleepQuality: null }, { energy: 4, soreness: 9 }, { energy: 4, stress: 11 }]) {
    const db = database()
    assert.equal((await checkIn.POST(req({ clientId, ...body }))).status, 400)
    assert.equal(db.writes.length, 0)
    assert.equal(globalThis.dashboardPersistenceInvalidations, 0)
  }
  const failedCheckIn = database({ failTable: 'recovery_logs' })
  assert.equal((await checkIn.POST(req({ clientId, energy: 4 }))).status, 500)
  assert.equal(failedCheckIn.writes.length, 0)
  assert.equal(globalThis.dashboardPersistenceInvalidations, 0)
  const failedRecovery = database({ failTable: 'recovery_activity_logs' })
  assert.equal((await recovery.POST(req({ clientId, activityType: 'Mobility', minutes: 10 }))).status, 500)
  assert.equal(failedRecovery.writes.length, 0)
  assert.equal(globalThis.dashboardPersistenceInvalidations, 0)
})
