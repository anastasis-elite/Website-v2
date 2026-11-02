import assert from 'node:assert/strict'
import test, { after, mock } from 'node:test'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { importTs } from './typescriptModule.mjs'

const instant = Date.parse('2026-10-28T15:00:00Z')
mock.timers.enable({ apis: ['Date'], now: instant })
after(() => mock.timers.reset())
const date = '2026-10-28', userId = '11111111-1111-4111-8111-111111111111', clientId = 'QA-CHECKOFFS'
const table = 'schedule_occurrence_checkoffs'
const { saveScheduleCheckoff, ScheduleCheckoffConflict, applyScheduleCheckoffs, validScheduleDate } = await importTs('lib/schedule/checkoffs.ts')
const sourceMocks = {
  '@/lib/calendar/service': 'export const importedScheduleEvents = async () => structuredClone(globalThis.checkoffImported || [])',
  '@/lib/day/getDailyExecutionPlan': 'export const getDailyExecutionPlan = async () => ({date: "2026-10-28", timing: {}})',
  '@/lib/dashboard/logic/getProgramLogicForClient': 'export const getProgramLogicForClient = async () => null',
}
const { getDailyScheduleState } = await importTs('lib/schedule/service.ts', sourceMocks)
const { POST } = await importTs('app/api/schedule/checkoff/route.ts', {
  ...sourceMocks,
  'next/server': 'export const NextResponse = { json: (body, init) => Response.json(body, init) }',
  '@/lib/dashboard/getDashboardContext': 'export const getDashboardContext = async () => globalThis.checkoffContext',
  '@/lib/dashboard/invalidateDailyPlan': 'export const invalidateDailyPlan = () => { globalThis.checkoffInvalidations++ }',
})
const { getClientDayRange } = await importTs('lib/schedule/time.ts')
const { getActionRouteForEvent } = await importTs('lib/schedule/engine.ts')
const { buildTodayActivities } = await importTs('lib/dashboard/todayActivities.ts')

function setup({ records = [], events = [], fail = false } = {}) {
  mock.timers.setTime(instant)
  const rows = structuredClone(records), savedEvents = structuredClone(events), writes = []
  const client = { client_id: clientId, auth_user_id: userId, program: 'ignite', timezone: 'America/Chicago',
    school_dropoff_time: '08:00', school_dropoff_days_of_week: [0,1,2,3,4,5,6], onboarding_data: {} }
  const db = { rows, writes, from(name) {
    assert.ok([table, 'client_schedule_blocks', 'anastasis_schedule_events'].includes(name), `Unexpected table ${name}`)
    const filters = []; let mutation, insert
    const match = row => filters.every(([key, value]) => row[key] === value)
    function result() {
      if (name === table && fail) return { data: null, error: { message: 'Private storage error' } }
      const source = name === table ? rows : name === 'anastasis_schedule_events' ? savedEvents : []
      let found = source.filter(match)
      if (mutation || insert) {
        assert.equal(name, table, 'check-offs must only write Anastasis occurrence evidence')
        if (insert) {
          const exists = rows.some(row => ['user_id','client_id','occurrence_date','event_id'].every(key => row[key] === insert[key]))
          found = exists ? [] : [structuredClone(insert)]
          if (!exists) rows.push(found[0])
        } else for (const row of found) Object.assign(row, structuredClone(mutation))
        for (const row of found) writes.push(structuredClone(row))
      }
      return { data: structuredClone(found), error: null }
    }
    const q = { select() { return q }, eq(key, value) { filters.push([key,value]); return q }, or() { return q },
      update(value) { mutation = value; return q }, upsert(value, options) { assert.equal(options.ignoreDuplicates, true); insert = value; return q },
      order() { return q }, async maybeSingle() { const value = result(); return { ...value, data: value.data?.[0] || null } },
      then(resolve, reject) { return Promise.resolve().then(result).then(resolve, reject) } }
    return q
  } }
  globalThis.checkoffContext = { supabase: db, user: { id: userId }, client }
  globalThis.checkoffInvalidations = 0
  globalThis.checkoffImported = []
  return { db, client }
}
const save = (db, extra = {}) => saveScheduleCheckoff({ supabase: db, userId, clientId, date,
  eventId: `virtual-school-dropoff-${date}`, completed: true, expectedRevision: 0, operationId: randomUUID(), ...extra })
const request = (extra = {}) => new Request('http://disposable.test/api/schedule/checkoff', { method: 'POST',
  body: JSON.stringify({ date, timezone: 'America/Chicago', eventId: `virtual-school-dropoff-${date}`,
    completed: true, expectedRevision: 0, operationId: randomUUID(), ...extra }) })
const load = (db, client, chosenDate = date, extra = {}) => getDailyScheduleState({ supabase: db, user: { id: userId }, client,
  date: chosenDate, includeVirtualPlan: false, ...extra })

test('check-off survives new readers, stays isolated by owner/date/occurrence and never changes the recurring template', async () => {
  const { db, client } = setup(), beforeClient = structuredClone(client)
  const eventId = `virtual-school-dropoff-${date}`
  assert.equal((await load(db, client)).events.find(event => event.id === eventId).status, 'scheduled')
  assert.equal((await POST(request())).status, 200)
  assert.equal(globalThis.checkoffInvalidations, 1)
  const restarted = setup({ records: db.rows })
  const state = await load(restarted.db, restarted.client)
  assert.equal(state.events.find(event => event.id === eventId).status, 'completed')
  assert.deepEqual(state.events.find(event => event.id === eventId).checkoff, { completed: true, revision: 1 })
  assert.equal(state.completedEvents.filter(event => event.id === eventId).length, 1)
  assert.equal((await load(restarted.db, restarted.client, '2026-10-29')).completedEvents.length, 0)
  const other = { ...restarted.client, client_id: 'QA-OTHER' }
  assert.equal((await load(restarted.db, other)).completedEvents.length, 0)
  assert.deepEqual(client, beforeClient)
  assert.equal(restarted.db.writes.length, 0)
})

test('retries and concurrent identical requests save once, while stale opposing intent cannot overwrite a newer action', async () => {
  const { db } = setup(), operationId = randomUUID()
  const results = await Promise.all([save(db, { operationId }), save(db, { operationId })])
  assert.deepEqual(results, [{ completed: true, revision: 1 }, { completed: true, revision: 1 }])
  assert.equal(db.rows.length, 1)
  assert.equal(db.writes.length, 1)
  const originalTimestamp = db.rows[0].completed_at
  mock.timers.setTime(instant + 5000)
  assert.deepEqual(await save(db, { operationId }), { completed: true, revision: 1 })
  assert.equal(db.rows[0].completed_at, originalTimestamp)
  assert.deepEqual(await save(db, { completed: false, expectedRevision: 1 }), { completed: false, revision: 2 })
  await assert.rejects(save(db, { operationId }), ScheduleCheckoffConflict)
  assert.equal(db.rows[0].completed, false)
  assert.equal(db.rows[0].completed_at, null)
  const next = await save(db, { expectedRevision: 2 })
  assert.deepEqual(next, { completed: true, revision: 3 })
})

test('fresh Today/Plan projections remove a completed commitment without fabricating health progress', async () => {
  const { db, client } = setup()
  client.daily_structure_reviewed_at = new Date().toISOString()
  const logic = {
    program: 'ignite', flameState: { requirements: { requiredItems: { dailyCheckIn: true, hydration: true } } },
    nutrition: { dataStatus: 'confirmed', calories: { percent: 100 }, protein: { percent: 100 } },
    hydration: { target: 96, consumed: 96, remaining: 0, status: 'complete' }, assessments: { dailyCompleted: true },
    execution: { workoutComplete: false, nutritionLogged: true, recoveryComplete: true }, workout: { assigned: false },
    workoutDecision: { canTrain: true, adjustmentLevel: 'level_0_full_plan', reasonForModification: 'Existing plan.' },
    symptoms: { redFlag: false }, recoveryStatus: { reasoning: 'Existing recovery plan.' },
  }
  const before = await load(db, client, date, { includeVirtualPlan: true, logic })
  assert.equal(before.dailyRecommendation.primary.eventId, `virtual-school-dropoff-${date}`)
  assert.equal((await POST(request())).status, 200)
  const after = await load(db, client, date, { includeVirtualPlan: true, logic })
  assert.notEqual(after.dailyRecommendation.primary.eventId, `virtual-school-dropoff-${date}`)
  assert.notEqual(after.nextAction.id, `virtual-school-dropoff-${date}`)
  assert.equal(after.todayActivities.completed, before.todayActivities.completed)
  assert.equal(after.todayActivities.total, before.todayActivities.total)
})

test('independent concurrent occurrences persist independently and stale competing operations return a conflict', async () => {
  const { db } = setup()
  await Promise.all([save(db), save(db, { eventId: 'school-pickup' })])
  assert.equal(db.rows.length, 2)
  const results = await Promise.allSettled([save(db, { expectedRevision: 1, completed: false }), save(db, { expectedRevision: 1, completed: false })])
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
  assert.equal(results.filter(result => result.status === 'rejected' && result.reason instanceof ScheduleCheckoffConflict).length, 1)
  assert.equal(db.rows.find(row => row.event_id.startsWith('virtual-school')).revision, 2)
})

test('imported appointment completion is Anastasis-only and recurring occurrences keep separate evidence', async () => {
  const { db, client } = setup()
  const first = { id: 'calendar:provider-series:2026-10-28T13:00:00Z', calendar_event_id: 'provider-series', source: 'external_calendar',
    event_type: 'appointment', title: 'Appointment', start_at: '2026-10-28T13:00:00Z', end_at: '2026-10-28T14:00:00Z',
    status: 'scheduled', timezone: 'America/Chicago', flexibility_type: 'fixed', completed_at: null }
  const second = { ...first, id: 'calendar:provider-series:2026-10-28T16:00:00Z', start_at: '2026-10-28T16:00:00Z', end_at: '2026-10-28T17:00:00Z' }
  globalThis.checkoffImported = [first, second]
  const providerBefore = structuredClone(globalThis.checkoffImported)
  assert.equal((await POST(request({ eventId: first.id }))).status, 200)
  const state = await load(db, client)
  assert.equal(state.events.find(event => event.id === first.id).status, 'completed')
  assert.equal(state.events.find(event => event.id === second.id).status, 'scheduled')
  assert.deepEqual(globalThis.checkoffImported, providerBefore)
  assert.equal(getActionRouteForEvent(first), '/dashboard/calendar?date=2026-10-28#calendar-event-provider-series')
  assert.equal(db.writes.length, 1)
  // An appointment near midnight must reopen the member's selected day, even
  // when its provider still calls that instant the preceding calendar date.
  globalThis.checkoffImported = [{ ...first, id: 'calendar:late-provider:occurrence', timezone: 'America/Los_Angeles',
    start_at: '2026-10-29T05:30:00Z', end_at: '2026-10-29T06:30:00Z' }]
  const nextDay = await load(db, client, '2026-10-29')
  assert.equal(getActionRouteForEvent(nextDay.events.find(event => event.id === 'calendar:late-provider:occurrence')),
    '/dashboard/calendar?date=2026-10-29#calendar-event-provider-series')
})

test('generic check-offs cannot complete health items or add health progress, including imported health-labelled events', async () => {
  for (const event_type of ['workout','meal','hydration','recovery','check_in','assessment','sleep']) {
    const health = { id: `health-${event_type}`, user_id: userId, client_id: clientId, event_type, title: event_type, source: 'program', status: 'scheduled',
      start_at: '2026-10-28T14:00:00Z', end_at: '2026-10-28T15:00:00Z', timezone: 'America/Chicago' }
    const { db, client } = setup({ events: [health] })
    const response = await POST(request({ eventId: health.id }))
    assert.equal(response.status, 409, event_type)
    assert.equal(db.writes.length, 0)
    const forged = { event_id: health.id, completed: true, completed_at: new Date().toISOString(), revision: 1 }
    assert.equal(applyScheduleCheckoffs([health], [forged])[0].status, 'scheduled')
    assert.equal((await load(db, client)).events.find(event => event.id === health.id).status, 'scheduled')
    globalThis.checkoffImported = [{ ...health, id: `calendar:${health.id}:occurrence`, source: 'external_calendar', calendar_event_id: health.id }]
    assert.equal((await POST(request({ eventId: `calendar:${health.id}:occurrence` }))).status, 409)
    assert.equal(db.writes.length, 0)
    const importedHref = getActionRouteForEvent({ ...health, calendar_event_id: health.id, action_route: '/dashboard/schedule' })
    assert.ok(!importedHref.startsWith('/dashboard/calendar') && !importedHref.startsWith('/dashboard/schedule'), event_type)
    if (event_type === 'workout') assert.equal(importedHref, '/dashboard/program/ignite/workout')
    if (event_type === 'hydration') assert.equal(importedHref, '/dashboard/nutrition?log=water')
    if (event_type === 'assessment') assert.equal(importedHref, '/dashboard/assessment/start')
  }
  const logic = { program: 'ignite', flameState: { requirements: { requiredItems: { dailyCheckIn: true, hydration: true, workoutOrMovement: true } } },
    assessments: { dailyCompleted: false }, hydration: { target: 96, consumed: 0, remaining: 96, status: 'needs_input' },
    execution: { workoutComplete: false, nutritionLogged: false, recoveryComplete: false }, workout: { assigned: true },
    workoutDecision: { canTrain: true, reasonForModification: 'Existing plan' }, symptoms: { redFlag: false } }
  const projected = applyScheduleCheckoffs([{ id: 'school', event_type: 'school', status: 'scheduled' }], [{ event_id: 'school', completed: true, revision: 1 }])
  const progress = buildTodayActivities(logic, { date, timezone: 'America/Chicago', now: new Date().toISOString(), events: projected })
  assert.equal(progress.completed, 0)
})

test('explicit selected local date survives midnight rollover and DST does not leak completion to the next day', async () => {
  const { db, client } = setup()
  mock.timers.setTime(Date.parse('2026-10-29T05:01:00Z')) // October 29 in Chicago: an October 28 screen is still explicit.
  assert.equal((await POST(request())).status, 200)
  assert.equal(db.rows[0].occurrence_date, date)
  assert.equal((await load(db, client, '2026-10-29')).completedEvents.length, 0)
  const dst = getClientDayRange(client, '2026-11-01')
  assert.equal(dst.end - dst.start, 25 * 60 * 60000)
  await save(db, { date: '2026-11-01', eventId: 'virtual-school-dropoff-2026-11-01' })
  assert.equal((await load(db, client, '2026-11-01')).completedEvents.length, 1)
  assert.equal((await load(db, client, '2026-11-02')).completedEvents.length, 0)
  assert.equal((await POST(request({ timezone: 'America/Los_Angeles' }))).status, 409)
})

test('invalid/stale/missing occurrences and storage failures produce no false success', async () => {
  const { db } = setup()
  for (const extra of [{ date: '2026-02-30' }, { completed: 'yes' }, { expectedRevision: -1 }, { operationId: 'invalid' }]) {
    assert.equal((await POST(request(extra))).status, 400)
  }
  assert.equal((await POST(request({ eventId: 'another-users-event' }))).status, 404)
  assert.equal((await POST(request({ eventId: 'virtual-school-dropoff-2026-10-29' }))).status, 404)
  assert.equal(db.writes.length, 0)
  assert.equal(validScheduleDate('2026-02-30'), false)
  const failed = setup({ fail: true })
  assert.equal((await POST(request())).status, 503)
  assert.equal(failed.db.writes.length, 0)
})

test('review migration enforces owner/client boundaries, unique occurrences, comparison writes and deletion cascades in local Postgres', async () => {
  const db = new PGlite(), otherId = '22222222-2222-4222-8222-222222222222'
  try {
    await db.exec(`create role authenticated; create role anon; create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
      create table public.clients(client_id text primary key, auth_user_id uuid);
      grant select on public.clients to authenticated;`)
    await db.query('insert into auth.users values ($1),($2)', [userId,otherId])
    await db.query('insert into clients values ($1,$2),(\'QA-OTHER\',$3)', [clientId,userId,otherId])
    await db.exec(readFileSync('supabase/migrations/20261028190000_schedule_occurrence_checkoffs.sql','utf8'))
    await db.exec(`set role authenticated; set request.jwt.claim.sub='${userId}'`)
    const insert = 'insert into schedule_occurrence_checkoffs(user_id,client_id,occurrence_date,event_id,completed,completed_at,revision,operation_id) values($1,$2,$3,$4,true,now(),1,$5)'
    await db.query(insert,[userId,clientId,date,'school',randomUUID()])
    await assert.rejects(db.query(insert,[userId,'QA-OTHER',date,'school',randomUUID()]), /row-level security/)
    await assert.rejects(db.query(insert,[otherId,clientId,date,'school',randomUUID()]), /row-level security/)
    const duplicate = await db.query(insert + ' on conflict(user_id,client_id,occurrence_date,event_id) do nothing returning *',[userId,clientId,date,'school',randomUUID()])
    assert.equal(duplicate.rows.length,0)
    await db.query(insert,[userId,clientId,'2026-10-29','school',randomUUID()])
    const changed = await db.query("update schedule_occurrence_checkoffs set completed=false,completed_at=null,revision=2 where revision=1 and occurrence_date=$1 returning *",[date])
    assert.equal(changed.rows.length,1)
    const stale = await db.query("update schedule_occurrence_checkoffs set completed=true,completed_at=now(),revision=2 where revision=1 and occurrence_date=$1 returning *",[date])
    assert.equal(stale.rows.length,0)
    await assert.rejects(db.query("update schedule_occurrence_checkoffs set client_id='QA-OTHER'"), /row-level security/)
    await db.exec(`set request.jwt.claim.sub='${otherId}'`)
    assert.equal((await db.query('select * from schedule_occurrence_checkoffs')).rows.length,0)
    await db.exec('reset role')
    await db.query('delete from clients where client_id=$1',[clientId])
    assert.equal((await db.query('select * from schedule_occurrence_checkoffs')).rows.length,0)
  } finally { await db.close() }
})
