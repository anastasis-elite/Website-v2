import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'

const { buildDailyScheduleState, getScheduleEventPrompt, getActionRouteForEvent } = await importTs('lib/schedule/engine.ts')
const { buildDailyRecommendation } = await importTs('lib/dashboard/dailyRecommendation.ts')
const { breakfastScheduleEventForDate } = await importTs('lib/schedule/dailyPlanAdapter.ts')
const date = '2026-11-01', timezone = 'America/Chicago'
const event = (overrides = {}) => ({ id: 'appointment', title: 'Appointment', event_type: 'appointment',
  source: 'manual', status: 'scheduled', flexibility_type: 'fixed', priority: 'medium', movable: false,
  start_at: '2026-11-01T15:00:00Z', end_at: '2026-11-01T15:30:00Z', ...overrides })
const state = (events, now = '2026-11-01T16:00:00Z') => buildDailyScheduleState({ date, timezone,
  now: new Date(now), dayStart: new Date('2026-11-01T05:00:00Z'), dayEnd: new Date('2026-11-02T06:00:00Z'), events })
const logic = () => ({ program: 'ignite', hydration: { target: 80, consumed: 80, remaining: 0, status: 'ready', presentationPacing: { state: 'complete' } },
  nutrition: { dataStatus: 'known', calories: { percent: 100 }, protein: { percent: 100 }, pacing: { state: 'complete' } },
  assessments: { dailyCompleted: true }, execution: { workoutComplete: false, recoveryComplete: true, nutritionLogged: true },
  workout: { assigned: false }, workoutDecision: { canTrain: true, assignedWorkout: { workout_state: 'rest' } },
  symptoms: { redFlag: false }, recoveryStatus: { reasoning: 'Existing recovery guidance.' } })

test('overdue prompts ask for an outcome without treating elapsed time as completion or failure', () => {
  const item = event(), before = structuredClone(item)
  for (const now of ['2026-11-01T15:30:00Z', '2026-11-02T05:59:59Z']) {
    const schedule = state([item], now)
    assert.equal(schedule.nextAction.urgency, 'overdue')
    assert.match(schedule.nextAction.reason, /Did you complete it, or is it still in progress\?/)
    assert.doesNotMatch(schedule.nextAction.reason, /missed|failure|still needs attention/i)
    assert.equal(schedule.completedEvents.length, 0)
    assert.equal(buildDailyRecommendation(logic(), schedule).primary.reason, schedule.nextAction.reason)
  }
  assert.deepEqual(item, before)
})

test('an explicit in-progress response is reflected before and after the scheduled end and never becomes completed', () => {
  const item = event({ checkoff: { status: 'in_progress', completed: false, revision: 1 } })
  for (const now of ['2026-11-01T15:10:00Z', '2026-11-01T16:00:00Z']) {
    const schedule = state([item], now), result = buildDailyRecommendation(logic(), schedule)
    assert.equal(schedule.events[0].status, 'scheduled')
    assert.equal(schedule.completedEvents.length, 0)
    assert.match(schedule.nextAction.reason, /You marked this in progress\. Have you completed it\?/)
    assert.equal(result.primary.reason, schedule.nextAction.reason)
    assert.equal(result.primary.availability, 'partial')
    assert.equal(result.primary.completed, false)
  }
})

test('accepted rescheduling, current commitments and completed histories retain their timing and priority', () => {
  const moved = event({ id: 'moved', adjusted_start_at: '2026-11-01T20:00:00Z', adjusted_end_at: '2026-11-01T20:30:00Z' })
  const future = state([moved])
  assert.equal(future.nextAction.urgency, 'upcoming')
  assert.equal(future.nextAction.start_at, moved.adjusted_start_at)
  assert.match(future.nextAction.reason, /scheduled for later/)
  assert.doesNotMatch(future.nextAction.reason, /time has passed/)
  const current = event({ id: 'current', start_at: '2026-11-01T15:45:00Z', end_at: '2026-11-01T16:30:00Z' })
  const completed = event({ id: 'done', status: 'completed', completed_at: '2026-11-01T15:20:00Z' })
  const schedule = state([moved, event({ id: 'overdue' }), current, completed])
  assert.equal(schedule.nextAction.id, 'current')
  assert.equal(buildDailyRecommendation(logic(), schedule).primary.eventId, 'current')
  assert.match(schedule.nextAction.reason, /in progress or completed\?/)
  assert.deepEqual(schedule.completedEvents, [completed])
  assert.equal(getScheduleEventPrompt(completed, new Date(schedule.now)), 'This item is recorded as completed.')
})

test('breakfast check-ins remain actionable independently of nutrition pacing and preserve source destinations', () => {
  const [breakfast] = breakfastScheduleEventForDate({ userId: 'owner', client: {
    client_id: 'member', onboarding_data: { routinePreferences: { answers: { breakfast_window_time: '08:00' } } },
  }, date, timezone })
  assert.ok(breakfast, 'the configured breakfast projects a real check-in occurrence')
  const currentLogic = logic(), before = structuredClone(currentLogic), schedule = state([breakfast])
  const result = buildDailyRecommendation(currentLogic, schedule)
  assert.equal(result.primary.eventId, breakfast.id)
  assert.equal(result.primary.href, breakfast.action_route)
  assert.match(result.primary.reason, /Did you complete it/)
  assert.deepEqual(currentLogic, before)
  const imported = event({ calendar_event_id: 'provider-series', source: 'external_calendar', schedule_date: date,
    timezone: 'America/Los_Angeles', checkoff: { status: 'in_progress', completed: false, revision: 1 } })
  assert.equal(buildDailyRecommendation(currentLogic, state([imported])).primary.href,
    `/dashboard/calendar?date=${date}#calendar-event-provider-series`)
})

test('breakfast routes to its schedule check-in for every tier while health meals retain their logging routes', () => {
  const [projected] = breakfastScheduleEventForDate({ userId: 'owner', client: {
    client_id: 'member', onboarding_data: { routinePreferences: { answers: { breakfast_window_time: '08:00' } } },
  }, date, timezone })
  const breakfast = { ...projected, schedule_date: date }
  for (const tier of ['ember', 'ignite', 'phoenix']) {
    assert.equal(getActionRouteForEvent(breakfast, tier), `/dashboard/schedule?date=${date}#event-${breakfast.id}`)
    const importedMeal = { ...breakfast, source: 'external_calendar', calendar_event_id: 'provider-meal',
      action_route: null, schedule_response_kind: undefined }
    assert.equal(getActionRouteForEvent(importedMeal, tier), tier === 'ember' ? '/dashboard/nutrition' : '/dashboard/nutrition?log=meal&meal=breakfast')
    const invalidMarker = { ...breakfast, id: 'another-occurrence', action_route: null }
    assert.equal(getActionRouteForEvent(invalidMarker, tier), tier === 'ember' ? '/dashboard/nutrition' : '/dashboard/nutrition?log=meal&meal=breakfast')
  }
})

test('saved health evidence, safety and pending check-in retain their authoritative recommendation priority', () => {
  const currentLogic = logic(), schedule = state([event()])
  currentLogic.symptoms.redFlag = true
  assert.equal(buildDailyRecommendation(currentLogic, schedule).primary.id, 'safety')
  currentLogic.symptoms.redFlag = false
  currentLogic.assessments.dailyCompleted = false
  assert.equal(buildDailyRecommendation(currentLogic, schedule).primary.id, 'check-in')
  currentLogic.assessments.dailyCompleted = true
  currentLogic.execution.workoutComplete = true
  const staleWorkout = event({ id: 'workout', event_type: 'workout' })
  const saved = buildDailyRecommendation(currentLogic, state([staleWorkout]))
  assert.ok(![saved.primary, ...saved.supporting].some(item => item.eventId === staleWorkout.id))
})
