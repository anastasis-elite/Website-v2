import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'

const { buildTodayActivities, readDailyGuide } = await importTs('lib/dashboard/todayActivities.ts')
const { buildDailyRecommendation } = await importTs('lib/dashboard/dailyRecommendation.ts')
const date = '2026-10-12', timezone = 'America/Chicago'
const logic = () => ({ program: 'ignite', flameState: { requirements: { requiredItems: {
  dailyCheckIn: true, hydration: true, nutrition: true, workoutOrMovement: true, recovery: false, sleep: false, customTasks: true,
} } }, hydration: { target: 96, consumed: 0, remaining: 96, status: 'needs_input' },
nutrition: { dataStatus: 'needs_input', calories: { percent: 0 }, protein: { percent: 0 } },
assessments: { dailyCompleted: false }, execution: { workoutComplete: false, nutritionLogged: false, recoveryComplete: false, workoutInProgress: false },
workout: { assigned: true }, workoutDecision: { canTrain: true, adjustmentLevel: 'level_0_full_plan', reasonForModification: 'Your existing assigned plan is available.' },
capacityStatus: { status: 'moderate_capacity' }, symptoms: { redFlag: false }, recoveryStatus: { reasoning: 'Review existing recovery guidance.' } })
const schedule = (activities = {}, now = '2026-10-12T15:00:00Z') => ({ date, timezone, now, events: [], nextActionableEvent: null, dailyGuide: { date, activities } })
const activity = (state, id) => state.activities.find(item => item.id === id)

test('Today progress counts applicable required persisted actions without optional tasks or unrelated streak requirements', () => {
  const current = logic(), initial = buildTodayActivities(current, schedule())
  assert.deepEqual([initial.completed, initial.total], [0, 4])
  assert.equal(activity(initial, 'schedule').countsTowardProgress, false)
  assert.equal(activity(initial, 'recovery').canSkip, true)
  current.assessments.dailyCompleted = true
  current.execution.nutritionLogged = true
  current.execution.recoveryComplete = true
  current.hydration = { target: 96, consumed: 96, remaining: 0, status: 'ready' }
  const saved = buildTodayActivities(current, schedule())
  assert.deepEqual([saved.completed, saved.total], [3, 4])
  assert.equal(activity(saved, 'recovery').status, 'completed')
  assert.equal(activity(saved, 'water').canDefer, false)
  current.workout.assigned = false
  current.workoutDecision.canTrain = false
  current.hydration.target = 0
  const inapplicable = buildTodayActivities(current, schedule())
  assert.deepEqual([inapplicable.completed, inapplicable.total], [2, 2])
  assert.equal(activity(inapplicable, 'workout'), undefined)
  assert.equal(activity(inapplicable, 'water'), undefined)
})

test('deferred and skipped activities never become completions; recorded action wins a saved preference', () => {
  const current = logic(), state = schedule({ 'check-in': { status: 'deferred', until: '2026-10-12T16:00:00Z' }, recovery: { status: 'skipped' } })
  const initial = buildTodayActivities(current, state)
  assert.equal(activity(initial, 'check-in').status, 'deferred')
  assert.equal(activity(initial, 'check-in').canResume, true)
  assert.equal(activity(initial, 'recovery').status, 'skipped')
  assert.equal(activity(initial, 'recovery').canResume, true)
  assert.equal(initial.completed, 0)
  assert.notEqual(buildDailyRecommendation(current, state).primary.id, 'check-in')
  assert.ok(!buildDailyRecommendation(current, state).supporting.some(item => item.id === 'recovery'))
  current.assessments.dailyCompleted = true
  assert.equal(activity(buildTodayActivities(current, state), 'check-in').status, 'completed')
  assert.equal(buildTodayActivities(current, state).completed, 1)
  current.assessments.dailyCompleted = false
  state.now = '2026-10-12T16:00:00Z'
  assert.equal(activity(buildTodayActivities(current, state), 'check-in').status, 'available')
  assert.equal(buildDailyRecommendation(current, state).primary.id, 'check-in')
})

test('schedule review needs an explicit same-day record and health reviewed preferences are ignored', () => {
  assert.equal(activity(buildTodayActivities(logic(), schedule()), 'schedule').status, 'available')
  const reviewed = schedule({ schedule: { status: 'reviewed' }, 'check-in': { status: 'reviewed' } })
  assert.equal(activity(buildTodayActivities(logic(), reviewed), 'schedule').status, 'completed')
  assert.equal(activity(buildTodayActivities(logic(), reviewed), 'check-in').status, 'available')
  reviewed.dailyGuide.date = '2026-10-11'
  assert.equal(activity(buildTodayActivities(logic(), reviewed), 'schedule').status, 'available')
  assert.deepEqual(readDailyGuide({ date, activities: { water: { status: 'deferred', until: 'bad-time' }, unknown: { status: 'skipped' } } }, date), { date, activities: {} })
})

test('saved partial workouts resume and accepted later workout times stay out of immediate recommendations', () => {
  const current = logic(), state = schedule()
  current.assessments.dailyCompleted = true
  current.execution.workoutInProgress = true
  assert.equal(activity(buildTodayActivities(current, state), 'workout').status, 'in_progress')
  state.events.push({ id: 'accepted-workout', event_type: 'workout', status: 'scheduled', suggested: false,
    start_at: '2026-10-12T14:00:00Z', end_at: '2026-10-12T14:30:00Z', adjusted_start_at: '2026-10-12T18:00:00Z', adjusted_end_at: '2026-10-12T18:30:00Z' })
  state.nextActionableEvent = state.events[0]
  const held = buildTodayActivities(current, state)
  assert.equal(activity(held, 'workout').status, 'deferred')
  assert.equal(activity(held, 'workout').canResume, false)
  assert.equal(activity(held, 'workout').deferredUntil, '2026-10-12T18:00:00Z')
  const recommendation = buildDailyRecommendation(current, state)
  assert.ok(![recommendation.primary, ...recommendation.supporting].some(item => item.category === 'workout'))
  current.execution.workoutComplete = true
  assert.equal(activity(buildTodayActivities(current, state), 'workout').status, 'completed')
})

test('canonical health completion suppresses stale scheduled copies without hiding real commitments', () => {
  const current = logic(), state = schedule()
  current.assessments.dailyCompleted = true
  current.execution.workoutComplete = true
  current.execution.recoveryComplete = true
  for (const category of ['workout', 'recovery', 'check_in']) {
    const stale = { id: `stale-${category}`, event_type: category, title: 'Stale activity', status: 'scheduled', suggested: false,
      flexibility_type: 'fixed', start_at: '2026-10-12T14:00:00Z', end_at: '2026-10-12T17:00:00Z' }
    state.events = [stale]; state.nextActionableEvent = stale
    const recommendation = buildDailyRecommendation(current, state)
    assert.ok(![recommendation.primary, ...recommendation.supporting].some(item => item.eventId === stale.id))
  }
  const work = { id: 'work', event_type: 'work', title: 'Current commitment', status: 'scheduled', suggested: false,
    flexibility_type: 'fixed', start_at: '2026-10-12T14:00:00Z', end_at: '2026-10-12T17:00:00Z' }
  state.events = [work]; state.nextActionableEvent = work
  assert.equal(buildDailyRecommendation(current, state).primary.id, 'work')
  current.hydration.target = 0
  state.events = []; state.nextActionableEvent = null
  const withoutTarget = buildDailyRecommendation(current, state)
  assert.ok(![withoutTarget.primary, ...withoutTarget.supporting].some(item => item.id === 'water'))
})

test('guided mornings prioritize hydration, evenings use existing recovery and safety cannot be hidden', () => {
  const current = logic(), state = schedule()
  current.assessments.dailyCompleted = true
  assert.equal(buildDailyRecommendation(current, state).primary.id, 'water')
  state.now = '2026-10-13T01:00:00Z'
  assert.equal(buildDailyRecommendation(current, state).primary.id, 'recovery')
  state.dailyGuide.activities.recovery = { status: 'deferred', until: '2026-10-13T02:00:00Z' }
  assert.notEqual(buildDailyRecommendation(current, state).primary.id, 'recovery')
  current.symptoms.redFlag = true
  assert.equal(buildDailyRecommendation(current, state).primary.id, 'safety')
  const recovery = activity(buildTodayActivities(current, state), 'recovery')
  assert.equal(recovery.status, 'available')
  assert.equal(recovery.canSkip, false)
  assert.equal(recovery.canDefer, false)
})

test('all tier activities retain their existing nutrition and recovery capabilities', () => {
  for (const tier of ['ember', 'ignite', 'phoenix']) {
    const current = logic(); current.program = tier
    const today = buildTodayActivities(current, schedule())
    assert.match(activity(today, 'workout').href, new RegExp(`/program/${tier}/workout$`))
    assert.equal(activity(today, 'nutrition').title, tier === 'ember' ? 'Nutrition' : 'Meal logging')
    assert.match(activity(today, 'recovery').detail, tier === 'ember' ? /quiet moment/ : /existing recovery options/)
    assert.doesNotMatch(today.activities.map(item => item.detail).join(' '), /supplement|breakfast|high energy/i)
  }
})
