import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'

const { buildTodayActivities, presentTodayActivities } = await importTs('lib/dashboard/todayActivities.ts')
const { buildDailyRecommendation } = await importTs('lib/dashboard/dailyRecommendation.ts')
const { breakfastScheduleEventForDate } = await importTs('lib/schedule/dailyPlanAdapter.ts')
const clone = value => JSON.parse(JSON.stringify(value))

function fixture(logged = true) {
  const logic = { program: 'ignite', client: { id: 'SYNTHETIC-SCHEDULE-OWNER' },
    assessments: { dailyCompleted: true }, symptoms: { redFlag: false },
    capacityStatus: { status: 'moderate_capacity' }, recoveryStatus: { reasoning: 'Existing guidance.' },
    hydration: { target: 80, consumed: 80, remaining: 0, status: 'ready' },
    nutrition: { dataStatus: logged ? 'known' : 'needs_input', calories: { percent: logged ? 40 : 0 }, protein: { percent: 0 },
      pacing: { state: logged ? 'behind' : 'neutral', nextRefreshAt: null, prompt: 'Log what you’ve had.' } },
    flameState: { requirements: { requiredItems: { dailyCheckIn: true, hydration: true, nutrition: true, workoutOrMovement: false, recovery: false } } },
    execution: { nutritionLogged: logged, workoutComplete: false, recoveryComplete: true },
    workout: { assigned: false, title: 'Rest day' },
    workoutDecision: { canTrain: false, assignedWorkout: { workout_state: 'rest' }, reasonForModification: 'Saved rest day.' } }
  const schedule = { date: '2026-11-02', timezone: 'America/Chicago', now: '2026-11-02T17:00:00Z', events: [],
    nextActionableEvent: null, dailyGuide: { date: '2026-11-02', activities: { schedule: { status: 'reviewed' } } } }
  return { logic, schedule }
}

function meal(patch = {}) {
  return { id: 'saved-meal', event_type: 'meal', status: 'scheduled', source: 'manual', suggested: false,
    title: 'Saved meal', flexibility_type: 'flexible', start_at: '2026-11-02T15:00:00Z', end_at: '2026-11-02T15:30:00Z',
    adjusted_start_at: null, adjusted_end_at: null, ...patch }
}

function presentedNutrition(logic, schedule) {
  return presentTodayActivities(logic, schedule).find(activity => activity.id === 'nutrition')
}

function assertHeld(logic, schedule, expected) {
  const canonical = buildTodayActivities(logic, schedule), saved = clone(canonical)
  const actual = presentTodayActivities(logic, schedule, canonical.activities).find(activity => activity.id === 'nutrition')
  assert.ok(actual)
  assert.equal(actual.status, expected.status)
  assert.equal(actual.canResume, expected.canResume)
  assert.equal(actual.deferredUntil, expected.deferredUntil)
  const recommendation = buildDailyRecommendation(logic, schedule)
  assert.equal(recommendation.primary.id, 'pause')
  assert.ok(!recommendation.supporting.some(action => action.category === 'nutrition' || action.category === 'meal'))
  assert.deepEqual(canonical, saved)
  assert.deepEqual(buildTodayActivities(logic, schedule), saved)
  if (logic.execution.nutritionLogged) assert.equal(canonical.activities.find(activity => activity.id === 'nutrition').status, 'completed')
}

test('accepted future adjusted meals keep nutrition deferred and Schedule-managed, including after a recorded log', () => {
  for (const logged of [false, true]) {
    const { logic, schedule } = fixture(logged)
    schedule.events = [meal({ adjusted_start_at: '2026-11-02T18:00:00Z', adjusted_end_at: '2026-11-02T18:30:00Z' })]
    schedule.nextActionableEvent = schedule.events[0]
    assertHeld(logic, schedule, { status: 'deferred', canResume: false, deferredUntil: '2026-11-02T18:00:00Z' })
    schedule.now = '2026-11-02T18:00:00Z'
    assert.equal(presentedNutrition(logic, schedule).status, logged ? 'in_progress' : 'available')
    assert.equal(presentedNutrition(logic, schedule).canResume, false)
    assert.equal(buildDailyRecommendation(logic, schedule).primary.id, 'food-input')
  }
})

test('saved deferred meal start is retained without requiring an adjusted timestamp', () => {
  for (const logged of [false, true]) {
    const { logic, schedule } = fixture(logged)
    schedule.events = [meal({ status: 'deferred', start_at: '2026-11-02T19:00:00Z', end_at: '2026-11-02T19:30:00Z' })]
    assertHeld(logic, schedule, { status: 'deferred', canResume: false, deferredUntil: '2026-11-02T19:00:00Z' })
  }
})

test('all saved meals skipped remains skipped without a Today resume override or calorie recommendation', () => {
  for (const logged of [false, true]) {
    const { logic, schedule } = fixture(logged)
    schedule.events = [meal({ id: 'meal-one', status: 'skipped' }), meal({ id: 'meal-two', status: 'skipped' }),
      meal({ id: 'cancelled-meal', status: 'cancelled' })]
    assertHeld(logic, schedule, { status: 'skipped', canResume: false, deferredUntil: undefined })
    schedule.events.push(meal({ id: 'remaining-meal' }))
    assert.equal(presentedNutrition(logic, schedule).status, logged ? 'in_progress' : 'available', 'A remaining unskipped meal is not a day-wide skip.')
    assert.equal(buildDailyRecommendation(logic, schedule).primary.id, 'food-input')
  }
})

test('daily guide choices retain their priority while saved Schedule holds still control resume permission', () => {
  const { logic, schedule } = fixture()
  schedule.dailyGuide.activities.nutrition = { status: 'deferred', until: '2026-11-02T18:30:00Z' }
  schedule.events = [meal({ adjusted_start_at: '2026-11-02T19:00:00Z' })]
  assertHeld(logic, schedule, { status: 'deferred', canResume: false, deferredUntil: '2026-11-02T18:30:00Z' })
  schedule.dailyGuide.activities.nutrition = { status: 'skipped' }
  assertHeld(logic, schedule, { status: 'skipped', canResume: false, deferredUntil: undefined })
  schedule.events = []
  assertHeld(logic, schedule, { status: 'skipped', canResume: true, deferredUntil: undefined })
  schedule.dailyGuide.activities.nutrition = { status: 'deferred', until: '2026-11-02T18:30:00Z' }
  schedule.events = [meal({ status: 'skipped' })]
  assertHeld(logic, schedule, { status: 'skipped', canResume: false, deferredUntil: undefined })
})

test('calorie on-pace, sleep and full-target suppression still hide saved held meal actions', () => {
  for (const event of [meal({ adjusted_start_at: '2026-11-02T19:00:00Z' }), meal({ status: 'skipped' })]) {
    const { logic, schedule } = fixture()
    schedule.events = [event]
    const before = clone(buildTodayActivities(logic, schedule))
    for (const state of ['on_pace', 'sleep', 'complete']) {
      logic.nutrition.pacing.state = state
      assert.equal(presentedNutrition(logic, schedule), undefined)
      assert.equal(buildDailyRecommendation(logic, schedule).primary.id, 'pause')
      assert.deepEqual(buildTodayActivities(logic, schedule), before)
    }
  }
})

test('unaccepted suggestions, cancelled meals and elapsed deferrals do not create a saved future hold', () => {
  for (const event of [
    meal({ suggested: true, adjusted_start_at: '2026-11-02T19:00:00Z' }),
    meal({ status: 'cancelled', adjusted_start_at: '2026-11-02T19:00:00Z' }),
    meal({ status: 'deferred', start_at: '2026-11-02T16:00:00Z' }),
  ]) {
    const { logic, schedule } = fixture()
    schedule.events = [event]
    const presented = presentedNutrition(logic, schedule)
    assert.equal(presented.status, 'in_progress')
    assert.equal(presented.canResume, false)
    assert.equal(presented.deferredUntil, undefined)
    assert.equal(buildDailyRecommendation(logic, schedule).primary.id, 'food-input')
  }
})

test('breakfast attendance changes never skip or defer Nutrition and never override a real meal hold', () => {
  for (const tier of ['ember', 'ignite', 'phoenix']) for (const logged of [false, true]) {
    const { logic, schedule } = fixture(logged)
    logic.program = tier
    const [breakfast] = breakfastScheduleEventForDate({ userId: 'owner', client: {
      client_id: logic.client.id, onboarding_data: { routinePreferences: { answers: { breakfast_window_time: '08:00' } } },
    }, date: schedule.date, timezone: schedule.timezone })
    const before = clone(logic), baseline = clone(buildTodayActivities(logic, schedule))
    const visibleBefore = clone(presentedNutrition(logic, schedule))
    for (const response of [
      { status: 'skipped' },
      { status: 'deferred', adjusted_start_at: '2026-11-02T19:00:00Z', adjusted_end_at: '2026-11-02T19:30:00Z' },
      { status: 'completed', checkoff: { status: 'completed', completed: true, revision: 1 } },
      { status: 'scheduled', checkoff: { status: 'in_progress', completed: false, revision: 1 } },
    ]) {
      schedule.events = [{ ...breakfast, schedule_date: schedule.date, ...response }]
      assert.deepEqual(buildTodayActivities(logic, schedule), baseline)
      assert.deepEqual(clone(presentedNutrition(logic, schedule)), visibleBefore)
      assert.equal(buildDailyRecommendation(logic, schedule).primary.id, 'food-input')
      assert.deepEqual(logic, before)
    }
    schedule.events = [{ ...breakfast, schedule_date: schedule.date }, meal({ status: 'deferred',
      adjusted_start_at: '2026-11-02T19:00:00Z', adjusted_end_at: '2026-11-02T19:30:00Z' })]
    assert.equal(presentedNutrition(logic, schedule).status, 'deferred')
    assert.equal(presentedNutrition(logic, schedule).deferredUntil, '2026-11-02T19:00:00Z')
  }
})
