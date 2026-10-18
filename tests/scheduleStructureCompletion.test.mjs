import assert from 'node:assert/strict'
import test, { after, mock } from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { importTs } from './typescriptModule.mjs'

const frozen = Date.parse('2026-10-12T15:00:00Z')
mock.timers.enable({ apis: ['Date'], now: frozen })
after(() => mock.timers.reset())

const { POST } = await importTs('app/api/daily-structure/route.ts', {
  'next/server': 'export const NextResponse = { json: (body, init) => Response.json(body, init) }',
  '@/lib/supabase/server': 'export const createClient = async () => globalThis.structureDatabase',
  '@/lib/dashboard/invalidateDailyPlan': 'export const invalidateDailyPlan = () => { globalThis.structureInvalidations++ }',
})
const { getDailyScheduleState } = await importTs('lib/schedule/service.ts', {
  '@/lib/calendar/service': 'export const importedScheduleEvents = async () => []',
  '@/lib/day/getDailyExecutionPlan': "export const getDailyExecutionPlan = async () => ({ date: '2026-10-12', timing: {}, completedDailyTasks: [] })",
  '@/lib/dashboard/logic/getProgramLogicForClient': 'export const getProgramLogicForClient = async () => null',
})
const { getActionRouteForEvent } = await importTs('lib/schedule/engine.ts')
const { buildWhatsNextState } = await importTs('lib/dashboard/whatsNext.ts')
const { buildTodayActivities } = await importTs('lib/dashboard/todayActivities.ts')
const { getTierCapabilities } = await importTs('lib/entitlements.ts')
const { getScheduleStructureSubmission, getScheduleStructureVersion } = await importTs('lib/assessment/scheduleStructure.ts')

const owner = 'qa-structure-owner', clientId = 'QA-STRUCTURE-ONLY', date = '2026-10-12'
const assessment = {
  id: 'qa-structure-assessment', user_id: owner, client_id: clientId,
  event_type: 'assessment', title: 'Schedule Structure Assessment', source: 'anastasis',
  status: 'scheduled', priority: 'high', flexibility_type: 'flexible', movable: true, approval_required: false,
  start_at: '2026-10-12T14:00:00.000Z', end_at: '2026-10-12T14:15:00.000Z',
  adjusted_start_at: null, adjusted_end_at: null, estimated_duration_minutes: 15,
}
const nextTask = {
  ...assessment, id: 'qa-next-task', event_type: 'custom', title: 'Review appointment notes',
  priority: 'medium', start_at: '2026-10-12T14:20:00.000Z', end_at: '2026-10-12T14:30:00.000Z',
}
const answers = {
  execution_style: 'hybrid', carousel_style: 'step', wake_time: '06:30', bed_time: '22:30',
  work_start_time: '12:00', work_end_time: '17:00', workout_days_available: 3,
  current_workout_days_per_week: 2, current_workout_minutes_per_session: 30,
  current_training_intensity: 'moderate', workout_schedule_preference: 'suggested',
  daily_non_negotiables: ['family'], day_structure_notes: '  Keep evenings open.  ',
}
const request = (overrides = {}) => new Request('http://disposable.test/api/daily-structure', {
  method: 'POST', body: JSON.stringify({ action: 'submit', assessmentVersion: 1, client_id: clientId, eventId: assessment.id, expected_revision: 0, ...answers, ...overrides }),
})
const currentLogic = () => ({
  program: 'ignite', flameState: { requirements: { requiredItems: {
    dailyCheckIn: true, hydration: true, nutrition: false, workoutOrMovement: false, recovery: false,
  } } }, nutrition: { dataStatus: 'confirmed', calories: { percent: 100 }, protein: { percent: 100 } },
  hydration: { target: 96, consumed: 96, remaining: 0, status: 'complete' },
  assessments: { dailyCompleted: true }, execution: { workoutComplete: false, nutritionLogged: true, recoveryComplete: true },
  workout: { assigned: false }, workoutDecision: { canTrain: true, adjustmentLevel: 'level_0_full_plan', reasonForModification: 'Existing training plan.' },
  symptoms: { redFlag: false }, recoveryStatus: { reasoning: 'Existing recovery plan.' },
})

// A fresh database instance models a different request/device: all completion
// evidence must come from persisted rows, never a cached object or browser state.
function setup({ events = [assessment, nextTask], clients, conflict, failWrite = false, failRead = false, authenticated = true } = {}) {
  mock.timers.setTime(frozen)
  const rows = structuredClone(clients || [
    { client_id: clientId, auth_user_id: owner, program: 'ignite', timezone: 'America/Chicago',
      onboarding_data: { kept: 'original', timezone: 'America/Chicago' } },
    { client_id: 'QA-FOREIGN', auth_user_id: 'another-owner', onboarding_data: { kept: 'other member' } },
  ])
  const savedEvents = structuredClone(events), writes = []
  let attempts = 0
  const db = { rows, events: savedEvents, writes, auth: { getUser: async () => ({ data: { user: authenticated ? { id: owner } : null }, error: null }) }, from(table) {
    assert.ok(['clients', 'anastasis_schedule_events', 'client_schedule_blocks'].includes(table), `Unexpected table ${table}`)
    const filters = []; let mutation
    const matches = row => filters.every(([key, value]) => key === 'onboarding_data'
      ? value === null ? row[key] == null : JSON.stringify(row[key]) === value : row[key] === value)
    const result = () => {
      if (failRead && !mutation) return { data: null, error: { message: 'Private read failure detail' } }
      if (mutation) {
        assert.equal(table, 'clients', 'answers and completion must persist in one client write')
        attempts++
        if (conflict) conflict(rows[0], attempts)
        if (failWrite) return { data: null, error: { message: 'Private write failure detail' } }
      }
      const source = table === 'clients' ? rows : table === 'anastasis_schedule_events' ? savedEvents : []
      const found = source.filter(matches)
      if (mutation) for (const row of found) {
        Object.assign(row, structuredClone(mutation)); writes.push({ table, fields: structuredClone(mutation) })
      }
      return { data: structuredClone(found), error: null }
    }
    const q = { select() { return q }, eq(key, value) { filters.push([key, value]); return q }, is(key, value) { filters.push([key, value]); return q },
      or() { return q }, update(value) { mutation = value; return q },
      async maybeSingle() { const value = result(); return { ...value, data: value.data?.[0] || null } },
      async order() { return result() }, then(resolve, reject) { return Promise.resolve(result()).then(resolve, reject) } }
    return q
  } }
  globalThis.structureDatabase = db
  globalThis.structureInvalidations = 0
  return { db, get attempts() { return attempts } }
}
const load = async (db, logic = currentLogic()) => getDailyScheduleState({
  supabase: db, user: { id: owner }, client: structuredClone(db.rows[0]), date, logic,
})
const whatsNext = (schedule, logic = currentLogic()) => buildWhatsNextState({ tier: 'ignite', capabilities: getTierCapabilities('ignite'), logic, schedule })
const saved = db => db.rows[0].onboarding_data.scheduleStructureAssessments?.['1']?.[assessment.id]

test('What’s Next navigation carries task and version while opening or reloading leaves assessment incomplete', async () => {
  const { db } = setup(), before = structuredClone(db.rows)
  for (let read = 0; read < 2; read++) {
    const state = await load(db), next = whatsNext(state)
    assert.equal(next.type, 'assessment')
    assert.equal(next.title, assessment.title)
    const target = new URL(next.primaryAction.href, 'https://anastasis.test')
    assert.equal(target.pathname, '/dashboard/assessment/daily-structure')
    assert.equal(target.searchParams.get('eventId'), assessment.id)
    assert.equal(target.searchParams.get('assessmentVersion'), '1')
    assert.equal(getActionRouteForEvent(assessment), target.pathname + target.search)
    assert.equal(state.events.find(event => event.id === assessment.id).status, 'scheduled')
    assert.equal(state.completedEvents.some(event => event.id === assessment.id), false)
    assert.equal(buildTodayActivities(currentLogic(), state).activities.find(item => item.id === `assessment:${assessment.id}`).status, 'available')
  }
  assert.deepEqual(db.rows, before)
  assert.equal(db.writes.length, 0)
  assert.equal(globalThis.structureInvalidations, 0)
})

test('explicit submission persists answers and completion atomically, survives fresh readers, advances What’s Next and counts once', async () => {
  const { db } = setup(), beforeProgress = buildTodayActivities(currentLogic(), await load(db))
  const otherBefore = structuredClone(db.rows[1]), eventsBefore = structuredClone(db.events)
  const response = await POST(request())
  assert.equal(response.status, 200)
  const submission = saved(db)
  assert.equal(submission.assessmentVersion, 1)
  assert.equal(submission.eventId, assessment.id)
  assert.equal(submission.submittedAt, new Date(frozen).toISOString())
  assert.equal(submission.answers.execution_style, 'hybrid')
  assert.equal(submission.answers.day_structure_notes, 'Keep evenings open.')
  assert.equal(db.rows[0].execution_style, submission.answers.execution_style)
  assert.equal(db.rows[0].wake_time, submission.answers.wake_time)
  assert.equal(db.rows[0].workout_days_available, submission.answers.workout_days_available)
  assert.equal(db.rows[0].daily_structure_reviewed_at, submission.submittedAt)
  assert.equal(db.rows[0].onboarding_data.kept, 'original')
  assert.deepEqual(db.rows[1], otherBefore)
  assert.deepEqual(db.events, eventsBefore, 'completion needs no independent schedule-row write that can fail after answers save')
  assert.equal(db.writes.length, 1)
  assert.ok(db.writes[0].fields.onboarding_data.scheduleStructureAssessments['1'][assessment.id])
  assert.equal(globalThis.structureInvalidations, 1)

  const restarted = setup({ clients: structuredClone(db.rows), events: structuredClone(db.events) }).db
  const refreshed = await load(restarted), next = whatsNext(refreshed)
  assert.equal(refreshed.completedEvents.filter(event => event.id === assessment.id).length, 1)
  assert.equal(refreshed.completedEvents.find(event => event.id === assessment.id).completed_at, submission.submittedAt)
  assert.equal(refreshed.nextActionableEvent.id, nextTask.id)
  assert.equal(next.title, nextTask.title)
  assert.equal(next.primaryAction.href, `/dashboard/schedule#event-${nextTask.id}`)
  const progress = buildTodayActivities(currentLogic(), refreshed)
  assert.equal(progress.activities.filter(item => item.id === `assessment:${assessment.id}`).length, 1)
  assert.equal(progress.activities.find(item => item.id === `assessment:${assessment.id}`).status, 'completed')
  assert.equal(progress.completed, beforeProgress.completed + 1)
  assert.equal(progress.total, beforeProgress.total)
  assert.equal(restarted.writes.length, 0)
})

test('duplicate submissions preserve the original evidence, answers and completion timestamp across retries', async () => {
  const initial = setup().db
  assert.equal((await POST(request())).status, 200)
  const original = structuredClone(saved(initial))
  const { db } = setup({ clients: structuredClone(initial.rows), events: structuredClone(initial.events) })
  mock.timers.setTime(frozen + 10 * 60000)
  assert.equal((await POST(request({ expected_revision: undefined }))).status, 200)
  assert.deepEqual(saved(db), original)
  assert.equal(db.rows[0].execution_style, original.answers.execution_style)
  assert.equal(db.rows[0].wake_time, original.answers.wake_time)
  assert.equal(db.rows[0].daily_structure_reviewed_at, original.submittedAt)
  const state = await load(db)
  assert.equal(state.completedEvents.filter(event => event.id === assessment.id).length, 1)
  assert.equal(buildTodayActivities(currentLogic(), state).activities.filter(item => item.id === `assessment:${assessment.id}`).length, 1)
})

test('an older task retry cannot replace its assessment answers or newer saved preferences and monthly review', async () => {
  const { db } = setup()
  assert.equal((await POST(request())).status, 200)
  const original = structuredClone(saved(db))
  mock.timers.setTime(Date.parse('2026-11-12T15:00:00Z'))
  assert.equal((await POST(request({ eventId: undefined, expected_revision: 1, execution_style: 'schedule', wake_time: '08:00' }))).status, 200)
  const afterNewReview = structuredClone(db.rows[0])
  mock.timers.setTime(Date.parse('2026-11-12T15:10:00Z'))
  const response = await POST(request({ expected_revision: undefined, execution_style: 'flow', wake_time: '05:00' }))
  assert.equal(response.status, 200)
  assert.deepEqual((await response.json()).submission, original)
  assert.deepEqual(saved(db), original)
  assert.deepEqual(db.rows[0], afterNewReview, 'idempotent task retry leaves newer preferences and review timestamps untouched')
})

test('a calendar title edit preserves submitted task identity, completion and progress across reloads', async () => {
  const { db } = setup()
  assert.equal((await POST(request())).status, 200)
  const original = structuredClone(saved(db))
  db.events[0].title = 'My daily rhythm'
  const state = await load(db)
  const completed = state.events.find(event => event.id === assessment.id)
  assert.equal(completed.status, 'completed')
  assert.equal(completed.completed_at, original.submittedAt)
  const href = new URL(getActionRouteForEvent(completed), 'https://anastasis.test')
  assert.equal(href.pathname, '/dashboard/assessment/daily-structure')
  assert.equal(href.searchParams.get('eventId'), assessment.id)
  assert.equal(buildTodayActivities(currentLogic(), state).activities.find(item => item.id === `assessment:${assessment.id}`).status, 'completed')
  assert.equal(whatsNext(state).title, nextTask.title)
  assert.equal((await POST(request())).status, 200, 'a renamed task still accepts an idempotent retry')
  assert.deepEqual(saved(db), original)
})

test('missing submit intent, incomplete answers, malformed input and obsolete versions cannot complete tasks', async () => {
  const { db } = setup()
  const invalidBodies = [
    { action: undefined }, { action: 'save' }, { execution_style: undefined }, { carousel_style: 'invalid' },
    { wake_time: '' }, { bed_time: '25:00' }, { workout_days_available: undefined },
    { current_workout_minutes_per_session: undefined }, { work_end_time: '' },
  ]
  for (const body of invalidBodies) assert.equal((await POST(request(body))).status, 400, JSON.stringify(body))
  assert.equal((await POST(request({ assessmentVersion: 0 }))).status, 409)
  assert.equal((await POST(request({ assessmentVersion: 2 }))).status, 409)
  assert.equal((await POST(new Request('http://disposable.test', { method: 'POST', body: '{bad' }))).status, 400)
  assert.equal((await POST(new Request('http://disposable.test', { method: 'POST', body: 'null' }))).status, 400)
  assert.equal(db.writes.length, 0)
  assert.equal(saved(db), undefined)
  assert.equal(globalThis.structureInvalidations, 0)
  assert.equal((await load(db)).nextActionableEvent.id, assessment.id)
})

test('a zero-training submission is complete without training-only fields and standalone completion cannot finish a task', async () => {
  const { db } = setup()
  const response = await POST(request({ eventId: undefined, workout_days_available: 0,
    current_workout_days_per_week: undefined, current_workout_minutes_per_session: undefined,
    current_training_intensity: undefined, workout_schedule_preference: undefined }))
  assert.equal(response.status, 200)
  const record = db.rows[0].onboarding_data.scheduleStructureAssessments['1'][`standalone:${date.slice(0, 7)}`]
  assert.equal(record.answers.workout_days_available, 0)
  assert.equal(record.answers.workout_schedule_preference, 'hidden-for-now')
  assert.equal(saved(db), undefined)
  const state = await load(db)
  assert.equal(state.completedEvents.some(event => event.id === assessment.id), false)
  assert.equal(state.nextActionableEvent.id, assessment.id)
})

test('monthly standalone reviews remain idempotent within a month and persist a fresh review in the next month', async () => {
  const { db } = setup()
  assert.equal((await POST(request({ eventId: undefined }))).status, 200)
  const october = structuredClone(db.rows[0].onboarding_data.scheduleStructureAssessments['1']['standalone:2026-10'])
  mock.timers.setTime(frozen + 24 * 60 * 60000)
  assert.equal((await POST(request({ eventId: undefined }))).status, 200)
  assert.deepEqual(db.rows[0].onboarding_data.scheduleStructureAssessments['1']['standalone:2026-10'], october)
  mock.timers.setTime(Date.parse('2026-11-12T15:00:00Z'))
  assert.equal((await POST(request({ eventId: undefined, expected_revision: 1 }))).status, 200)
  assert.equal(db.rows[0].onboarding_data.scheduleStructureAssessments['1']['standalone:2026-11'].submittedAt, '2026-11-12T15:00:00.000Z')
  assert.equal(db.rows[0].daily_structure_reviewed_at, '2026-11-12T15:00:00.000Z')
  assert.deepEqual(db.rows[0].onboarding_data.scheduleStructureAssessments['1']['standalone:2026-10'], october)
  assert.equal(saved(db), undefined)
})

test('the existing monthly review is actionable with empty production-style event tables and survives a PWA restart', async () => {
  const { db } = setup({ events: [] })
  const monthlyId = 'schedule-structure:2026-10'
  const before = await load(db)
  const task = before.events.find(event => event.id === monthlyId)
  assert.ok(task, 'the real monthly assessment must not require a manually inserted schedule row')
  assert.equal(task.status, 'scheduled')
  assert.equal(task.busy, false, 'an assessment must not occupy the entire day or block commitments')
  assert.equal(whatsNext(before).type, 'assessment')
  const href = new URL(whatsNext(before).primaryAction.href, 'https://anastasis.test')
  assert.equal(href.searchParams.get('eventId'), monthlyId)
  assert.equal(href.searchParams.get('assessmentVersion'), '1')
  assert.equal(db.writes.length, 0, 'opening the actual task never completes it')

  assert.equal((await POST(request({ eventId: monthlyId }))).status, 200)
  const proof = structuredClone(db.rows[0].onboarding_data.scheduleStructureAssessments['1']['standalone:2026-10'])
  assert.equal(proof.eventId, monthlyId)
  const restarted = setup({ events: [], clients: structuredClone(db.rows) }).db
  const after = await load(restarted)
  assert.equal(after.completedEvents.filter(event => event.id === monthlyId).length, 1)
  assert.equal(after.events.find(event => event.id === monthlyId).completed_at, proof.submittedAt)
  assert.notEqual(whatsNext(after).type, 'assessment')
  assert.equal(after.todayActivities.activities.find(activity => activity.id === `assessment:${monthlyId}`).status, 'completed')
  assert.equal(after.todayActivities.completed, before.todayActivities.completed + 1)
  assert.equal(restarted.writes.length, 0)

  assert.equal((await POST(request({ eventId: undefined, wake_time: '09:00', execution_style: 'flow' }))).status, 200)
  assert.equal((await POST(request({ eventId: monthlyId, wake_time: '05:00' }))).status, 200)
  assert.deepEqual(restarted.rows[0].onboarding_data.scheduleStructureAssessments['1']['standalone:2026-10'], proof)
  assert.equal(restarted.rows[0].wake_time, proof.answers.wake_time)
  assert.equal(Object.keys(restarted.rows[0].onboarding_data.scheduleStructureAssessments['1']).length, 1)
})

test('monthly task identity respects local month boundaries and accepts old retries only with persisted proof', async () => {
  const { db } = setup({ events: [] })
  for (const eventId of ['schedule-structure:2026-09', 'schedule-structure:2026-11', 'schedule-structure:2026-13']) {
    assert.ok([404, 409].includes((await POST(request({ eventId }))).status))
  }
  assert.equal(db.writes.length, 0)
  assert.equal((await POST(request({ eventId: 'schedule-structure:2026-10' }))).status, 200)
  const october = structuredClone(db.rows[0])
  mock.timers.setTime(Date.parse('2026-11-01T04:59:00Z'))
  assert.equal((await POST(request({ eventId: undefined, wake_time: '05:00' }))).status, 200)
  assert.deepEqual(db.rows[0], october, 'Chicago is still in October before local midnight')
  mock.timers.setTime(Date.parse('2026-11-01T05:00:00Z'))
  assert.equal((await POST(request({ eventId: 'schedule-structure:2026-11', expected_revision: 1, wake_time: '08:00' }))).status, 200)
  const november = structuredClone(db.rows[0])
  assert.equal((await POST(request({ eventId: 'schedule-structure:2026-10', expected_revision: undefined, wake_time: '05:00' }))).status, 200)
  assert.deepEqual(db.rows[0], november, 'an old completed task cannot roll current preferences backward')
  assert.deepEqual(november.onboarding_data.scheduleStructureAssessments['1']['standalone:2026-10'], october.onboarding_data.scheduleStructureAssessments['1']['standalone:2026-10'])
})

test('legacy monthly completion is respected and matching saved tasks never duplicate the monthly projection', async () => {
  const { db } = setup({ events: [] })
  db.rows[0].daily_structure_reviewed_at = '2026-10-01T14:00:00Z'
  assert.equal((await load(db)).events.some(event => event.id === 'schedule-structure:2026-10'), false)
  db.rows[0].daily_structure_reviewed_at = '2026-09-30T14:00:00Z'
  assert.equal((await load(db)).events.some(event => event.id === 'schedule-structure:2026-10'), true)
  const withSaved = setup().db
  assert.equal((await load(withSaved)).events.filter(event => event.event_type === 'assessment').length, 1)
  assert.equal((await POST(request())).status, 200)
  assert.equal((await load(withSaved)).events.filter(event => event.event_type === 'assessment').length, 1)
})

test('submission ownership and assessment identity prevent completing another member or another assessment', async () => {
  const variants = [
    { user_id: 'another-owner' }, { client_id: 'QA-FOREIGN' },
    { event_type: 'custom' }, { title: 'Strength Assessment', action_route: '/dashboard/assessment/start' },
    { source: 'google', external_event_id: 'external-assessment' },
    { title: 'A calendar import', action_route: '/dashboard/assessment/daily-structure', calendar_event_id: 'calendar-import' },
    { action_route: '/dashboard/assessment/daily-structure?assessmentVersion=2' },
  ]
  for (const variant of variants) {
    const { db } = setup({ events: [{ ...assessment, ...variant }] })
    assert.ok([404, 409].includes((await POST(request())).status), JSON.stringify(variant))
    assert.equal(db.writes.length, 0)
    assert.equal(saved(db), undefined)
    assert.equal(globalThis.structureInvalidations, 0)
  }
  const { db } = setup()
  assert.equal((await POST(request({ client_id: 'QA-FOREIGN' }))).status, 404)
  assert.equal((await POST(request({ eventId: 'missing-task' }))).status, 404)
  assert.equal(db.writes.length, 0)
  setup({ authenticated: false })
  assert.equal((await POST(request())).status, 401)
})

test('completion evidence is scoped to task and assessment version and must contain valid submitted answers', async () => {
  const valid = { assessmentVersion: 1, eventId: assessment.id, submittedAt: new Date(frozen).toISOString(), answers }
  const stored = { scheduleStructureAssessments: { '1': { [assessment.id]: valid } } }
  assert.ok(getScheduleStructureSubmission(stored, assessment))
  const future = { ...assessment, action_route: '/dashboard/assessment/daily-structure?assessmentVersion=2' }
  assert.equal(getScheduleStructureVersion(future), 2)
  assert.equal(getScheduleStructureSubmission(stored, future), null)
  assert.equal(getScheduleStructureSubmission(stored, { ...assessment, id: 'another-schedule-occurrence' }), null)
  for (const invalid of [
    { ...valid, assessmentVersion: 2 }, { ...valid, eventId: 'another-task' }, { ...valid, submittedAt: 'not-a-date' },
    { ...valid, answers: { execution_style: 'flow' } },
  ]) assert.equal(getScheduleStructureSubmission({ scheduleStructureAssessments: { '1': { [assessment.id]: invalid } } }, assessment), null)
  const { db } = setup({ events: [{ ...assessment, status: 'completed', completed_at: valid.submittedAt }] })
  const state = await load(db)
  assert.equal(state.events.find(event => event.id === assessment.id).status, 'scheduled', 'a legacy mark-complete row is insufficient without a matching submission')
  assert.equal(state.completedEvents.length, 0)
})

test('failed persistence retains incomplete state, recovery path and What’s Next without cache invalidation', async () => {
  const { db } = setup({ failWrite: true }), before = structuredClone(db.rows)
  const response = await POST(request())
  assert.equal(response.status, 500)
  assert.doesNotMatch((await response.json()).error, /Private|detail/)
  assert.deepEqual(db.rows, before)
  assert.equal(db.writes.length, 0)
  assert.equal(globalThis.structureInvalidations, 0)
  const state = await load(db)
  assert.equal(whatsNext(state).title, assessment.title)
  assert.equal(state.completedEvents.length, 0)
})

test('compare-and-swap merges a concurrent preference save and rejects exhausted conflicts without false completion', async () => {
  const concurrent = { dailyGuide: { date, activities: { water: { status: 'deferred', until: '2026-10-12T16:00:00Z' } } },
    scheduleOverrides: { 'another-event': { status: 'skipped' } }, otherDevice: true }
  const state = setup({ conflict: (row, attempt) => {
    if (attempt === 1) row.onboarding_data = { ...row.onboarding_data, ...concurrent }
  } })
  assert.equal((await POST(request())).status, 200)
  assert.equal(state.attempts, 2)
  assert.equal(state.db.writes.length, 1)
  for (const [key, value] of Object.entries(concurrent)) assert.deepEqual(state.db.rows[0].onboarding_data[key], value)
  assert.ok(saved(state.db))
  const failed = setup({ conflict: (row, attempt) => { row.onboarding_data = { ...row.onboarding_data, concurrentVersion: attempt } } })
  assert.equal((await POST(request())).status, 409)
  assert.equal(failed.attempts, 3)
  assert.equal(failed.db.writes.length, 0)
  assert.equal(saved(failed.db), undefined)
  assert.equal(globalThis.structureInvalidations, 0)
  assert.equal((await load(failed.db)).completedEvents.length, 0)
})

test('preexisting skipped and cancelled assessments reject submission and retain their recorded outcome', async () => {
  for (const status of ['cancelled', 'skipped']) {
    const { db } = setup({ events: [{ ...assessment, status }, nextTask] })
    assert.equal((await POST(request())).status, 409)
    assert.equal(db.writes.length, 0)
    const state = await load(db), today = buildTodayActivities(currentLogic(), state)
    assert.equal(state.events.find(event => event.id === assessment.id).status, status)
    assert.equal(state.completedEvents.some(event => event.id === assessment.id), false)
    assert.equal(today.activities.some(item => item.id === `assessment:${assessment.id}`), false)
  }
})

test('persisted submission wins over in-flight skip or cancel writes from an older screen', async () => {
  const { db } = setup()
  assert.equal((await POST(request())).status, 200)
  const proof = structuredClone(saved(db))
  for (const status of ['cancelled', 'skipped']) {
    db.events[0].status = status
    const state = await load(db), today = buildTodayActivities(currentLogic(), state)
    assert.equal(state.events.find(event => event.id === assessment.id).status, 'completed')
    assert.equal(state.completedEvents.find(event => event.id === assessment.id).completed_at, proof.submittedAt)
    assert.equal(today.activities.find(item => item.id === `assessment:${assessment.id}`).status, 'completed')
    assert.equal(state.nextActionableEvent.id, nextTask.id)
    assert.deepEqual(saved(db), proof)
  }
})

test('Postgres commits answers and completion JSON in one owner-scoped compare-and-swap', async t => {
  const pg = new PGlite(); t.after(() => pg.close())
  await pg.exec('create table clients(client_id text primary key, auth_user_id text, execution_style text, onboarding_data jsonb)')
  const original = { kept: 'original' }
  await pg.query('insert into clients values($1,$2,$3,$4)', [clientId, owner, 'flow', JSON.stringify(original)])
  const submission = { assessmentVersion: 1, eventId: assessment.id, submittedAt: new Date(frozen).toISOString(), answers }
  const complete = { ...original, scheduleStructureAssessments: { '1': { [assessment.id]: submission } } }
  const update = 'update clients set execution_style=$1,onboarding_data=$2::jsonb where client_id=$3 and auth_user_id=$4 and onboarding_data=$5::jsonb returning *'
  const denied = await pg.query(update, ['hybrid', JSON.stringify(complete), clientId, 'another-owner', JSON.stringify(original)])
  assert.equal(denied.rows.length, 0)
  const result = await pg.query(update, ['hybrid', JSON.stringify(complete), clientId, owner, JSON.stringify(original)])
  assert.equal(result.rows.length, 1)
  assert.equal(result.rows[0].execution_style, result.rows[0].onboarding_data.scheduleStructureAssessments['1'][assessment.id].answers.execution_style)
  const stale = await pg.query(update, ['schedule', '{}', clientId, owner, JSON.stringify(original)])
  assert.equal(stale.rows.length, 0)
  assert.deepEqual((await pg.query('select onboarding_data from clients')).rows[0].onboarding_data, complete)
})
