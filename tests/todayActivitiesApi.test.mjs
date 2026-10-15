import assert from 'node:assert/strict'
import test, { after, mock } from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { importTs } from './typescriptModule.mjs'

const frozen = Date.parse('2026-10-12T15:00:00Z')
mock.timers.enable({ apis: ['Date'], now: frozen })
after(() => mock.timers.reset())
const { getClientDayRange } = await importTs('lib/schedule/time.ts')
const { buildTodayActivities } = await importTs('lib/dashboard/todayActivities.ts')
const routeMocks = {
  'next/server': 'export const NextResponse = { json: (body, init) => Response.json(body, init) }',
  '@/lib/supabase/server': 'export const createClient = async () => globalThis.todayContext.supabase',
  '@/lib/dashboard/getDashboardContext': 'export const getDashboardContext = async () => { if (globalThis.todayAuthError) throw globalThis.todayAuthError; return globalThis.todayContext }',
  '@/lib/dashboard/logic/getProgramLogicForClient': 'export const getProgramLogicForClient = async ({client}) => { globalThis.todayLastLogicClient = client; return globalThis.todayLogic }',
  '@/lib/schedule/service': 'export const getDailyScheduleState = async ({client}) => globalThis.todaySchedule(client)',
  '@/lib/dashboard/invalidateDailyPlan': 'export const invalidateDailyPlan = () => { globalThis.todayInvalidations++ }',
}
const { POST } = await importTs('app/api/dashboard/activities/route.ts', routeMocks)
const preferences = await importTs('app/api/dashboard/preferences/route.ts', routeMocks)
const schedulePlan = await importTs('app/api/schedule/plan/route.ts', routeMocks)
const owner = 'qa-owner', clientId = 'QA-TODAY-ONLY', date = '2026-10-12'
const req = (activityId, action, day = date, other = {}) => new Request('http://disposable.test/api/dashboard/activities', {
  method: 'POST', body: JSON.stringify({ date: day, activityId, action, ...other }),
})
function setup({ onboardingData = { kept: 'original', timezone: 'America/Chicago' }, conflict = null, failure = null, timezone = 'America/Chicago', onSchedule = null, events = [] } = {}) {
  mock.timers.setTime(frozen)
  const rows = [
    { client_id: clientId, auth_user_id: owner, program: 'ignite', timezone, onboarding_data: structuredClone(onboardingData) },
    { client_id: 'QA-UNTOUCHED', auth_user_id: 'someone-else', onboarding_data: { kept: 'other member' } },
  ]
  let attempts = 0
  const writes = []
  const db = { rows, writes, auth: { getUser: async () => ({ data: { user: { id: owner } } }) }, from(table) {
    assert.equal(table, 'clients', 'guide preferences must never write health tables')
    const filters = []; let mutation
    const q = { select() { return q }, eq(key, value) { filters.push([key, value]); return q }, is(key, value) { filters.push([key, value]); return q },
      update(value) { mutation = value; return q }, async maybeSingle() {
        if (failure) return { data: null, error: { message: failure } }
        if (mutation) { attempts++; if (conflict) conflict(rows[0], attempts) }
        const row = rows.find(row => filters.every(([key, value]) => key === 'onboarding_data'
          ? value === null ? row[key] == null : JSON.stringify(row[key]) === value : row[key] === value))
        if (row && mutation) { Object.assign(row, structuredClone(mutation)); writes.push(structuredClone(mutation)) }
        return { data: row ? structuredClone(row) : null, error: null }
      } }
    return q
  } }
  globalThis.todayContext = { supabase: db, user: { id: owner }, client: structuredClone(rows[0]) }
  globalThis.todayAuthError = null
  globalThis.todayInvalidations = 0
  globalThis.todayLogic = { program: 'ignite', flameState: { requirements: { requiredItems: {
    dailyCheckIn: true, hydration: true, nutrition: false, workoutOrMovement: false, recovery: false,
  } } }, hydration: { target: 96, consumed: 0, remaining: 96, status: 'needs_input' },
    nutrition: { dataStatus: 'needs_input' }, assessments: { dailyCompleted: false },
    execution: { workoutComplete: false, nutritionLogged: false, recoveryComplete: false }, workout: { assigned: false },
    workoutDecision: { canTrain: true, reasonForModification: 'Existing plan.' }, symptoms: { redFlag: false } }
  globalThis.todaySchedule = client => {
    if (onSchedule) onSchedule()
    return { ...getClientDayRange(client), now: new Date().toISOString(), events, dailyGuide: client.onboarding_data?.dailyGuide }
  }
  return { db, get attempts() { return attempts } }
}

test('guide saves persist across fresh readers, preserve unrelated preferences and do not touch another member', async () => {
  const { db } = setup(), otherBefore = structuredClone(db.rows[1])
  globalThis.todayContext.client.injuries = 'current profile override'
  db.rows[0].injuries = 'original onboarding baseline'
  const result = await POST(req('check-in', 'defer', date, { clientId: 'QA-UNTOUCHED', userId: 'someone-else' }))
  assert.equal(result.status, 200)
  const payload = await result.json()
  assert.equal(payload.activityId, 'check-in')
  assert.equal(payload.dailyGuide.activities['check-in'].until, '2026-10-12T16:00:00.000Z')
  assert.equal(db.rows[0].onboarding_data.kept, 'original')
  assert.equal(globalThis.todayLastLogicClient.injuries, 'current profile override')
  assert.deepEqual(db.rows[1], otherBefore)
  assert.equal(globalThis.todayInvalidations, 1)
  const refreshed = buildTodayActivities(globalThis.todayLogic, globalThis.todaySchedule(structuredClone(db.rows[0])))
  assert.equal(refreshed.activities.find(item => item.id === 'check-in').status, 'deferred')
  assert.equal(refreshed.completed, 0)
  mock.timers.setTime(frozen + 5 * 60000)
  assert.equal((await POST(req('check-in', 'defer'))).status, 200)
  assert.equal(db.rows[0].onboarding_data.dailyGuide.activities['check-in'].until, payload.dailyGuide.activities['check-in'].until, 'a duplicate defer retry must not extend its hold')
  assert.equal((await POST(req('check-in', 'resume'))).status, 200)
  assert.equal(db.rows[0].onboarding_data.dailyGuide.activities['check-in'], undefined)
  assert.equal(buildTodayActivities(globalThis.todayLogic, globalThis.todaySchedule(db.rows[0])).activities[0].status, 'available')
})

test('CAS retries merge a concurrent device choice instead of overwriting saved preferences', async () => {
  const state = setup({ conflict: (row, attempt) => {
    if (attempt !== 1) return
    row.onboarding_data = { ...row.onboarding_data, concurrent: 'other device', dailyGuide: { date, activities: { water: { status: 'deferred', until: '2026-10-12T16:00:00Z' } } } }
  } })
  assert.equal((await POST(req('schedule', 'review'))).status, 200)
  assert.equal(state.attempts, 2)
  assert.equal(state.db.rows[0].onboarding_data.concurrent, 'other device')
  assert.equal(state.db.rows[0].onboarding_data.dailyGuide.activities.water.status, 'deferred')
  assert.equal(state.db.rows[0].onboarding_data.dailyGuide.activities.schedule.status, 'reviewed')
  assert.equal(globalThis.todayInvalidations, 1)
  const failed = setup({ conflict: (row, attempt) => { row.onboarding_data = { ...row.onboarding_data, version: attempt } } })
  assert.equal((await POST(req('schedule', 'review'))).status, 409)
  assert.equal(failed.attempts, 3)
  assert.equal(failed.db.writes.length, 0)
  assert.equal(globalThis.todayInvalidations, 0)
})

test('transition preference saves preserve guide choices saved concurrently by another device', async () => {
  const state = setup({ conflict: (row, attempt) => {
    if (attempt === 1) row.onboarding_data = { ...row.onboarding_data,
      dailyGuide: { date, activities: { 'check-in': { status: 'deferred', until: '2026-10-12T16:00:00Z' } } },
      scheduleOverrides: { 'virtual-existing': { status: 'skipped' } } }
  } })
  const otherBefore = structuredClone(state.db.rows[1])
  const response = await preferences.PATCH(new Request('http://disposable.test/api/dashboard/preferences', {
    method: 'PATCH', body: JSON.stringify({ carouselStyle: 'step', transitionMinutes: 20 }),
  }))
  assert.equal(response.status, 200)
  assert.equal(state.attempts, 2)
  assert.equal(state.db.rows[0].carousel_style, 'step')
  assert.equal(state.db.rows[0].onboarding_data.transitionMinutes, 20)
  assert.equal(state.db.rows[0].onboarding_data.dailyGuide.activities['check-in'].status, 'deferred')
  assert.equal(state.db.rows[0].onboarding_data.scheduleOverrides['virtual-existing'].status, 'skipped')
  assert.equal(state.db.rows[0].onboarding_data.kept, 'original')
  assert.deepEqual(state.db.rows[1], otherBefore)
  assert.equal(globalThis.todayInvalidations, 1)
})

test('virtual schedule saves merge concurrent guide and other schedule choices', async () => {
  const event = { id: 'virtual-today', virtual: true, event_type: 'workout', status: 'scheduled', flexibility_type: 'flexible', movable: true, approval_required: false }
  const state = setup({ events: [event], conflict: (row, attempt) => {
    if (attempt === 1) row.onboarding_data = { ...row.onboarding_data,
      dailyGuide: { date, activities: { recovery: { status: 'skipped' } } },
      scheduleOverrides: { 'virtual-other': { adjusted_start_at: '2026-10-12T18:00:00Z', status: 'scheduled' } } }
  } })
  const response = await schedulePlan.POST(new Request('http://disposable.test/api/schedule/plan', {
    method: 'POST', body: JSON.stringify({ eventId: event.id, action: 'skip' }),
  }))
  assert.equal(response.status, 200)
  assert.equal(state.attempts, 2)
  const saved = state.db.rows[0].onboarding_data
  assert.equal(saved.dailyGuide.activities.recovery.status, 'skipped')
  assert.equal(saved.scheduleOverrides['virtual-other'].adjusted_start_at, '2026-10-12T18:00:00Z')
  assert.equal(saved.scheduleOverrides[event.id].status, 'skipped')
  assert.equal(saved.scheduleOverrides[event.id].completed_at, null)
  assert.equal(saved.kept, 'original')
  assert.equal(globalThis.todayInvalidations, 1)
})

test('exhausted dashboard preference CAS and malformed stored JSON preserve records and report failure', async () => {
  for (const options of [{ conflict: (row, attempt) => { row.onboarding_data = { ...row.onboarding_data, version: attempt } } }, { onboardingData: ['legacy-unexpected-json'] }]) {
    const { db } = setup(options)
    const response = await preferences.PATCH(new Request('http://disposable.test/api/dashboard/preferences', {
      method: 'PATCH', body: JSON.stringify({ transitionMinutes: 20 }),
    }))
    assert.equal(response.status, 409)
    assert.equal(db.writes.length, 0)
    assert.equal(globalThis.todayInvalidations, 0)
  }
})

test('saved schedule moves and skips cannot falsely resume through guide preferences', async () => {
  const moved = { id: 'accepted-workout', event_type: 'workout', status: 'scheduled', suggested: false,
    start_at: '2026-10-12T14:00:00Z', end_at: '2026-10-12T14:30:00Z', adjusted_start_at: '2026-10-12T18:00:00Z', adjusted_end_at: '2026-10-12T18:30:00Z' }
  for (const [event, ownPreference] of [[moved, null], [{ ...moved, status: 'skipped' }, null], [moved, { status: 'deferred', until: '2026-10-12T16:00:00Z' }]]) {
    const { db } = setup({ events: [event], onboardingData: { kept: 'existing', dailyGuide: { date, activities: ownPreference ? { workout: ownPreference } : {} } } })
    globalThis.todayLogic.workout.assigned = true
    const before = structuredClone(db.rows[0].onboarding_data)
    const response = await POST(req('workout', 'resume'))
    assert.equal(response.status, 409)
    assert.match((await response.json()).error, /saved in Schedule/)
    assert.equal(db.writes.length, 0)
    assert.deepEqual(db.rows[0].onboarding_data, before)
    assert.equal(buildTodayActivities(globalThis.todayLogic, globalThis.todaySchedule(db.rows[0])).activities.find(item => item.id === 'workout').canResume, false)
  }
})

test('only optional activities skip, schedule review is explicit and cannot fabricate health completion', async () => {
  const { db } = setup()
  assert.equal((await POST(req('check-in', 'skip'))).status, 409)
  assert.equal((await POST(req('water', 'skip'))).status, 409)
  assert.equal((await POST(req('check-in', 'review'))).status, 400)
  assert.equal((await POST(req('workout', 'defer'))).status, 409)
  assert.equal(db.writes.length, 0)
  assert.equal((await POST(req('recovery', 'skip'))).status, 200)
  let state = buildTodayActivities(globalThis.todayLogic, globalThis.todaySchedule(db.rows[0]))
  assert.equal(state.activities.find(item => item.id === 'recovery').status, 'skipped')
  assert.equal(state.completed, 0)
  assert.equal((await POST(req('schedule', 'review'))).status, 200)
  assert.equal((await POST(req('schedule', 'review'))).status, 200, 'review retry is idempotent')
  state = buildTodayActivities(globalThis.todayLogic, globalThis.todaySchedule(db.rows[0]))
  assert.equal(state.activities.find(item => item.id === 'schedule').status, 'completed')
  assert.equal(state.completed, 0, 'optional review must not inflate required completion')
  globalThis.todayLogic.assessments.dailyCompleted = true
  assert.equal((await POST(req('check-in', 'defer'))).status, 409)
  globalThis.todayLogic.symptoms.redFlag = true
  assert.equal((await POST(req('recovery', 'defer'))).status, 409)
})

test('local dates reject stale submissions and bound defer to local midnight including clock rollover during a save', async () => {
  const { db } = setup()
  assert.equal((await POST(req('check-in', 'defer', '2026-10-11'))).status, 409)
  assert.equal(db.writes.length, 0)
  mock.timers.setTime(Date.parse('2026-10-13T04:59:00Z'))
  const late = await POST(req('check-in', 'defer'))
  assert.equal(late.status, 200)
  assert.equal((await late.json()).dailyGuide.activities['check-in'].until, '2026-10-13T04:59:59.999Z')
  mock.timers.setTime(Date.parse('2026-10-13T05:00:00Z'))
  assert.equal((await POST(req('check-in', 'resume'))).status, 409)
  assert.equal((await POST(req('check-in', 'defer', '2026-10-13'))).status, 200)
  assert.equal(db.rows[0].onboarding_data.dailyGuide.date, '2026-10-13')
  assert.deepEqual(Object.keys(db.rows[0].onboarding_data.dailyGuide.activities), ['check-in'])
  const crossed = setup({ onSchedule: () => mock.timers.setTime(Date.parse('2026-10-13T05:00:00Z')) })
  mock.timers.setTime(Date.parse('2026-10-13T04:59:59Z'))
  assert.equal((await POST(req('schedule', 'review'))).status, 409)
  assert.equal(crossed.db.writes.length, 0)
  const auckland = setup({ timezone: 'Pacific/Auckland' })
  assert.equal((await POST(req('schedule', 'review'))).status, 409, 'member timezone differs from server/user timezone')
  assert.equal((await POST(req('schedule', 'review', '2026-10-13'))).status, 200)
  assert.equal(auckland.db.rows[0].onboarding_data.dailyGuide.date, '2026-10-13')
})

test('authentication, malformed input, null JSON and database failures have safe recoverable responses', async () => {
  let { db } = setup()
  globalThis.todayAuthError = { digest: 'NEXT_REDIRECT;replace;/login;307;' }
  assert.equal((await POST(req('water', 'defer'))).status, 401)
  assert.equal(db.writes.length, 0)
  setup()
  for (const body of [['unknown', 'defer'], ['water', 'invented'], ['water', 'defer', 'invalid']]) assert.equal((await POST(req(...body))).status, 400)
  assert.equal((await POST(new Request('http://disposable.test', { method: 'POST', body: '{bad' }))).status, 400)
  const nullState = setup({ onboardingData: null })
  assert.equal((await POST(req('schedule', 'review'))).status, 200)
  assert.equal(nullState.db.rows[0].onboarding_data.dailyGuide.activities.schedule.status, 'reviewed')
  setup({ failure: 'secret table name, internal SQL detail' })
  const failed = await POST(req('schedule', 'review'))
  assert.equal(failed.status, 500)
  assert.doesNotMatch((await failed.json()).error, /secret|SQL|table name/)
  assert.equal(globalThis.todayInvalidations, 0)
})

test('Postgres JSON equality supports atomic owner-scoped compare-and-swap without replacing other device changes', async t => {
  const pg = new PGlite(); t.after(() => pg.close())
  await pg.exec('create table clients(client_id text primary key, auth_user_id text, onboarding_data jsonb)')
  const original = { kept: 'original', a: 1 }
  await pg.query('insert into clients values($1,$2,$3)', [clientId, owner, JSON.stringify(original)])
  const update = 'update clients set onboarding_data=$1::jsonb where client_id=$2 and auth_user_id=$3 and onboarding_data=$4::jsonb returning client_id'
  const first = await pg.query(update, [JSON.stringify({ ...original, dailyGuide: { date, activities: {} } }), clientId, owner, JSON.stringify({ a: 1, kept: 'original' })])
  assert.equal(first.rows.length, 1, 'JSONB comparison ignores object key order')
  const stale = await pg.query(update, [JSON.stringify({ kept: 'would overwrite' }), clientId, owner, JSON.stringify(original)])
  assert.equal(stale.rows.length, 0)
  const current = (await pg.query('select onboarding_data from clients where client_id=$1', [clientId])).rows[0].onboarding_data
  const foreign = await pg.query(update, ['{}', clientId, 'different owner', JSON.stringify(current)])
  assert.equal(foreign.rows.length, 0)
  assert.deepEqual((await pg.query('select onboarding_data from clients')).rows[0].onboarding_data, current)
})
