import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'

const { calculateTodayHydrationPacing } = await importTs('lib/hydration/todayPacing.ts')
const { runHydrationEngine } = await importTs('lib/dashboard/logic/engines.ts')
const { buildTodayActivities, presentTodayActivities } = await importTs('lib/dashboard/todayActivities.ts')
const { buildDailyRecommendation } = await importTs('lib/dashboard/dailyRecommendation.ts')
const client = { timezone: 'America/New_York', wake_time: '05:00', bed_time: '21:00' }
const pacing = (time, changes = {}) => calculateTodayHydrationPacing({ client, target: 80, consumed: 40,
  hasLoggedIntake: true, now: new Date(`2026-11-02T${time}-05:00`), ...changes })

test('water uses cumulative saved wake-window fractions and exact equality without changing the goal', () => {
  for (const [time, consumed, expected] of [['09:00:00', 20, 25], ['13:00:00', 40, 50], ['17:00:00', 60, 75]]) {
    const result = pacing(time, { consumed })
    assert.equal(result.state, 'on_pace');assert.equal(result.expectedPercent, expected)
    assert.equal(result.consumedPercent, expected)
    assert.equal(result.nextRefreshAt, new Date(`2026-11-02T${time}.001-05:00`).toISOString())
  }
  const ahead = pacing('09:00:00')
  assert.equal(ahead.nextRefreshAt, '2026-11-02T18:00:00.001Z')
  const behind = calculateTodayHydrationPacing({ client, target: 80, consumed: 40, hasLoggedIntake: true, now: new Date(ahead.nextRefreshAt) })
  assert.equal(behind.state, 'behind');assert.equal(behind.prompt, 'A little moment of care: log the water you’ve had today.')
  assert.doesNotMatch(behind.prompt, /drink \d|must|catch up|extra water|finish/i)
})

test('missing water logs, target, errors and saved clocks remain neutral, without invented defaults', () => {
  assert.equal(pacing('13:00:00', { hasLoggedIntake: false, consumed: 0 }).reason, 'unlogged')
  for (const target of [0, -1, NaN, Infinity]) assert.equal(pacing('13:00:00', { target }).reason, 'missing_target')
  assert.equal(pacing('13:00:00', { available: false }).reason, 'unavailable')
  assert.equal(pacing('13:00:00', { consumed: -1 }).reason, 'invalid_consumed')
  for (const clock of [{ wake_time: null }, { bed_time: '' }, { wake_time: '25:00' }, { bed_time: '05:00' }]) {
    const result = pacing('13:00:00', { client: { ...client, ...clock }, consumed: 80 })
    assert.equal(result.state, 'neutral');assert.equal(result.reason, 'missing_schedule')
  }
})

test('sleep hides reminders and overnight calendar totals stay neutral across midnight', () => {
  for (const time of ['04:00:00', '21:00:00', '23:00:00']) {
    const result = pacing(time, { consumed: 0, hasLoggedIntake: false })
    assert.equal(result.state, 'sleep');assert.equal(result.expectedPercent, null)
    assert.doesNotMatch(result.prompt, /behind|drink|deficit|finish/i)
  }
  assert.equal(pacing('04:00:00').nextRefreshAt, '2026-11-02T10:00:00.000Z')
  assert.equal(pacing('23:00:00').nextRefreshAt, '2026-11-03T10:00:00.000Z')
  const overnight = { ...client, wake_time: '19:00', bed_time: '07:00' }
  for (const time of ['23:00:00', '01:00:00', '06:59:59']) {
    const result = pacing(time, { client: overnight, consumed: 80 })
    assert.equal(result.state, 'neutral');assert.equal(result.reason, 'overnight_unavailable')
    assert.equal(result.expectedPercent, null);assert.doesNotMatch(result.prompt, /behind|drink more|deficit/i)
  }
  assert.equal(pacing('13:00:00', { client: overnight }).state, 'sleep')
})

test('full water target stops reminders and member timezone/DST retain exact crossing instants', () => {
  assert.equal(pacing('13:00:00', { consumed: 80 }).state, 'complete')
  assert.equal(pacing('13:00:00', { consumed: 100 }).state, 'complete')
  assert.equal(pacing('13:00:00', { client: { ...client, timezone: 'America/Los_Angeles' } }).expectedPercent, 31.25)
  const spring = calculateTodayHydrationPacing({ client: { ...client, wake_time: '00:00', bed_time: '08:00' },
    target: 70, consumed: 30, hasLoggedIntake: true, now: new Date('2026-03-08T04:00:00-04:00') })
  assert.ok(Math.abs(spring.expectedPercent - 3 / 7 * 100) < 1e-9)
  assert.equal(spring.nextRefreshAt, '2026-03-08T08:00:00.001Z')
})

function fixture(state = 'behind') {
  const logic = { program: 'ignite', client: { id: 'SYNTHETIC-OWNER' }, hydration: { target: 80, consumed: 20, remaining: 60, status: 'building',
    presentationPacing: { state, prompt: 'Log the water you’ve had.', nextRefreshAt: null } },
    nutrition: { dataStatus: 'known', calories: { percent: 100 }, protein: { percent: 100 }, pacing: { state: 'complete' } },
    flameState: { requirements: { requiredItems: { hydration: true } } }, assessments: { dailyCompleted: true },
    execution: { workoutComplete: true, nutritionLogged: true, recoveryComplete: true }, workout: { assigned: false },
    workoutDecision: { canTrain: false, assignedWorkout: { workout_state: 'rest' } },
    capacityStatus: { status: 'moderate_capacity' }, symptoms: { redFlag: false }, recoveryStatus: { reasoning: 'Existing guidance.' } }
  const schedule = { date: '2026-11-02', timezone: client.timezone, now: '2026-11-02T18:00:00Z', events: [], nextActionableEvent: null,
    dailyGuide: { date: '2026-11-02', activities: { schedule: { status: 'reviewed' } } } }
  return { logic, schedule }
}
const waterCard = (logic, schedule) => presentTodayActivities(logic, schedule).find(activity => activity.id === 'water')
const actions = (logic, schedule) => { const result = buildDailyRecommendation(logic, schedule);return [result.primary, ...result.supporting] }
test('one water presentation decision controls card and next step while keeping canonical progress intact', () => {
  const { logic, schedule } = fixture(), before = structuredClone(buildTodayActivities(logic, schedule))
  for (const state of ['on_pace', 'complete', 'sleep']) {
    logic.hydration.presentationPacing.state = state
    assert.equal(waterCard(logic, schedule), undefined)
    assert.equal(actions(logic, schedule).some(action => action.category === 'hydration'), false)
    assert.deepEqual(buildTodayActivities(logic, schedule), before)
  }
  for (const state of ['behind', 'neutral']) {
    logic.hydration.presentationPacing.state = state
    assert.ok(waterCard(logic, schedule));assert.equal(buildDailyRecommendation(logic, schedule).primary.id, 'water')
  }
  assert.equal(logic.hydration.target, 80);assert.equal(logic.hydration.remaining, 60)
  // An unavailable saved target can coexist with a readiness fallback's
  // completed arithmetic. Its neutral action must never claim completion.
  logic.hydration.status = 'ready';logic.hydration.remaining = 0
  const neutral = buildDailyRecommendation(logic, schedule)
  assert.equal(neutral.primary.id, 'water');assert.equal(neutral.primary.completed, false)
  assert.equal(neutral.evidence.water, 'completed', 'Recorded progress remains canonical.')
})

test('saved water skip/defer intent and Schedule-owned resume limits survive pace resurfacing', () => {
  const event = { id: 'SYNTHETIC-WATER', event_type: 'hydration', status: 'scheduled', suggested: false,
    title: 'Saved water reminder', flexibility_type: 'flexible', start_at: '2026-11-02T19:00:00Z', end_at: '2026-11-02T19:10:00Z' }
  const { logic, schedule } = fixture()
  schedule.events = [{ ...event, adjusted_start_at: event.start_at }]
  assert.equal(waterCard(logic, schedule).status, 'deferred')
  assert.equal(waterCard(logic, schedule).canResume, false)
  assert.equal(waterCard(logic, schedule).deferredUntil, event.start_at)
  assert.equal(actions(logic, schedule).some(action => action.category === 'hydration'), false)
  schedule.events = [{ ...event, status: 'skipped' }]
  assert.equal(waterCard(logic, schedule).status, 'skipped');assert.equal(waterCard(logic, schedule).canResume, false)
  assert.equal(actions(logic, schedule).some(action => action.category === 'hydration'), false)
  schedule.events = [];schedule.dailyGuide.activities.water = { status: 'skipped' }
  assert.equal(waterCard(logic, schedule).canResume, true)
  schedule.dailyGuide.activities.water = { status: 'deferred', until: '2026-11-02T18:30:00Z' }
  assert.equal(waterCard(logic, schedule).status, 'deferred');assert.equal(waterCard(logic, schedule).canResume, true)
  schedule.now = '2026-11-02T18:30:00Z'
  assert.equal(waterCard(logic, schedule).status, 'in_progress');assert.equal(buildDailyRecommendation(logic, schedule).primary.id, 'water')
})

test('hydration presentation uses saved water and no invented target while leaving readiness values unchanged', t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-11-02T18:00:00Z') })
  const inputs = { date: '2026-11-02', client, dailyPlan: { dailyTargets: { water: 80 }, dailyRemaining: { water: 60 } },
    nutritionLogs: [{ log_date: '2026-11-02', water_consumed_oz: 20 }], todayRecovery: {}, hydrationHistoryAvailable: false }
  const before = structuredClone(inputs), result = runHydrationEngine(inputs)
  assert.equal(result.target, 80);assert.equal(result.consumed, 20);assert.equal(result.remaining, 60)
  assert.equal(result.presentationPacing.state, 'neutral')
  assert.equal(result.presentationPacing.reason, 'unavailable')
  assert.deepEqual(inputs, before)
  const missing = runHydrationEngine({ ...inputs, dailyPlan: { dailyTargets: {}, dailyRemaining: {} } })
  assert.equal(missing.target, 100, 'The existing readiness fallback is preserved.')
  assert.equal(missing.presentationPacing.state, 'neutral')
  assert.equal(missing.presentationPacing.reason, 'missing_target')
})
