import assert from 'node:assert/strict'
import test, { after, mock } from 'node:test'
import { importTs } from './typescriptModule.mjs'

const { runHydrationEngine } = await importTs('lib/dashboard/logic/engines.ts')
const { buildDailyRecommendation } = await importTs('lib/dashboard/dailyRecommendation.ts')
const { buildTodayActivities, presentTodayActivities } = await importTs('lib/dashboard/todayActivities.ts')
const { getClientLocalDate } = await importTs('lib/timezone.ts')

mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-31T18:00:00Z') })
after(() => mock.timers.reset())

function fixture(consumed, { client = {}, recovery = {} } = {}) {
  const member = { timezone: 'America/Chicago', wake_time: '07:00', bed_time: '19:00', ...client }
  const date = getClientLocalDate(member)
  const inputs = { date, client: member, todayRecovery: recovery,
    dailyPlan: { dailyTargets: { water: 100 }, dailyRemaining: { water: 100 - consumed } },
    nutritionLogs: [{ log_date: date, water_consumed_oz: consumed }] }
  const logic = { program: 'ignite', hydration: runHydrationEngine(inputs),
    flameState: { requirements: { requiredItems: { dailyCheckIn: true, hydration: true, nutrition: true, workoutOrMovement: true } } },
    nutrition: { dataStatus: 'known', calories: { percent: 100 }, protein: { percent: 100 } },
    assessments: { dailyCompleted: true }, execution: { workoutComplete: false, nutritionLogged: true, recoveryComplete: false },
    workout: { assigned: true }, workoutDecision: { canTrain: true, adjustmentLevel: 'level_0_full_plan', reasonForModification: 'Your assigned exercises are ready.' },
    capacityStatus: { status: 'moderate_capacity' }, symptoms: { redFlag: false }, recoveryStatus: { reasoning: 'Existing recovery options are available.' } }
  const schedule = { date, timezone: member.timezone, now: new Date().toISOString(), events: [], nextActionableEvent: null,
    dailyGuide: { date, activities: {} } }
  return { logic, schedule, inputs }
}
const recommendations = (logic, schedule) => { const plan = buildDailyRecommendation(logic, schedule); return [plan.primary, ...plan.supporting] }

test('logged water on pace advances Today while preserving the real daily goal and all water access', () => {
  mock.timers.setTime(Date.parse('2026-10-31T18:00:00Z')) // 13:00 Chicago; half the waking day.
  const behind = fixture(20)
  assert.equal(buildDailyRecommendation(behind.logic, behind.schedule).primary.id, 'water')
  const onPace = fixture(50)
  const before = structuredClone(onPace)
  assert.equal(onPace.logic.hydration.expectedPercent, 50)
  assert.equal(onPace.logic.hydration.paceState, 'on_pace')
  assert.equal(buildDailyRecommendation(onPace.logic, onPace.schedule).primary.id, 'workout')
  assert.equal(recommendations(onPace.logic, onPace.schedule).some(action => action.category === 'hydration'), false)
  const activities = buildTodayActivities(onPace.logic, onPace.schedule)
  const water = activities.activities.find(activity => activity.id === 'water')
  assert.equal(water.status, 'in_progress')
  assert.equal(water.href, '/dashboard/nutrition?log=water')
  assert.equal(water.countsTowardProgress, true)
  assert.equal(presentTodayActivities(onPace.logic, onPace.schedule).some(activity => activity.id === 'water'), false)
  assert.equal(onPace.logic.hydration.remaining, 50)
  assert.equal(buildDailyRecommendation(onPace.logic, onPace.schedule).evidence.water, 'partial')
  assert.deepEqual(onPace, before, 'Recommendations must not mutate targets, logs or schedule.')
})

test('Today resurfaces water immediately after its exact crossing while readiness keeps its existing tolerance', () => {
  mock.timers.setTime(Date.parse('2026-10-31T18:00:00Z'))
  const justSaved = fixture(50)
  assert.equal(buildDailyRecommendation(justSaved.logic, justSaved.schedule).primary.id, 'workout')
  assert.equal(justSaved.logic.hydration.presentationPacing.nextRefreshAt, '2026-10-31T18:00:00.001Z')
  mock.timers.setTime(Date.parse('2026-10-31T18:01:00Z'))
  const afterSave = fixture(50)
  assert.equal(afterSave.logic.hydration.paceState, 'on_pace')
  assert.equal(afterSave.logic.hydration.presentationPacing.state, 'behind')
  assert.equal(buildDailyRecommendation(afterSave.logic, afterSave.schedule).primary.id, 'water')
  assert.ok(presentTodayActivities(afterSave.logic, afterSave.schedule).some(activity => activity.id === 'water'))
  mock.timers.setTime(Date.parse('2026-10-31T21:00:00Z')) // 16:00 local: 75% elapsed, still 50% logged.
  const later = fixture(50)
  assert.equal(later.logic.hydration.expectedPercent, 75)
  assert.equal(buildDailyRecommendation(later.logic, later.schedule).primary.id, 'water')
  assert.doesNotMatch(buildDailyRecommendation(later.logic, later.schedule).primary.reason, /drink \d|must|finish/i)
})

test('on-pace water suppresses scheduled duplicates without hiding real current commitments', () => {
  mock.timers.setTime(Date.parse('2026-10-31T18:00:00Z'))
  const { logic, schedule } = fixture(50)
  const waterEvent = { id: 'scheduled-water', event_type: 'hydration', title: 'Hydration', status: 'scheduled', suggested: false,
    flexibility_type: 'fixed', start_at: '2026-10-31T17:45:00Z', end_at: '2026-10-31T18:15:00Z' }
  schedule.events = [waterEvent]; schedule.nextActionableEvent = waterEvent
  assert.equal(recommendations(logic, schedule).some(action => action.category === 'hydration'), false)
  schedule.events.push({ ...waterEvent, id: 'current-work', event_type: 'work', title: 'Work' })
  assert.equal(buildDailyRecommendation(logic, schedule).primary.id, 'current-work')
})

test('the hydration engine uses member timezone, overnight waking days, sleep fallback and existing defaults', () => {
  mock.timers.setTime(Date.parse('2026-10-31T18:00:00Z'))
  const chicago = fixture(35)
  const pacific = fixture(35, { client: { timezone: 'America/Los_Angeles' } })
  assert.equal(chicago.logic.hydration.expectedPercent, 50)
  assert.equal(buildDailyRecommendation(chicago.logic, chicago.schedule).primary.id, 'water')
  assert.equal(pacific.logic.hydration.expectedPercent, 33)
  assert.equal(buildDailyRecommendation(pacific.logic, pacific.schedule).primary.id, 'workout')
  mock.timers.setTime(Date.parse('2026-11-01T06:00:00Z')) // 01:00 Chicago before DST fold.
  const overnight = fixture(50, { client: { wake_time: '19:00', bed_time: '07:00' } })
  assert.equal(overnight.logic.hydration.expectedPercent, 50)
  assert.equal(overnight.logic.hydration.paceState, 'on_pace')
  assert.equal(overnight.logic.hydration.presentationPacing.state, 'neutral')
  assert.equal(overnight.logic.hydration.presentationPacing.reason, 'overnight_unavailable')
  assert.equal(recommendations(overnight.logic, overnight.schedule).some(action => action.category === 'hydration'), true)
  assert.doesNotMatch(recommendations(overnight.logic, overnight.schedule).find(action => action.category === 'hydration').reason, /behind|drink more|catch up/i)
  mock.timers.setTime(Date.parse('2026-10-31T20:00:00Z')) // 15:00 Chicago.
  const sleepFallback = fixture(50, { client: { wake_time: null, bed_time: null }, recovery: { sleep_wake_time: '09:00', sleep_bedtime: '21:00' } })
  assert.equal(sleepFallback.logic.hydration.expectedPercent, 50)
  const defaults = fixture(60, { client: { wake_time: null, bed_time: null } })
  assert.equal(defaults.logic.hydration.expectedPercent, 52) // Existing 07:00–22:30 fallback.
  assert.equal(defaults.logic.hydration.paceState, 'on_pace')
  assert.equal(defaults.logic.hydration.presentationPacing.state, 'neutral')
  assert.equal(defaults.logic.hydration.presentationPacing.reason, 'missing_schedule')
})

test('unknown intake stays actionable and on-pace status never completes the daily water target', () => {
  mock.timers.setTime(Date.parse('2026-10-31T18:00:00Z'))
  const unknown = fixture(0)
  assert.equal(unknown.logic.hydration.status, 'needs_input')
  assert.equal(buildDailyRecommendation(unknown.logic, unknown.schedule).primary.id, 'water')
  const partial = fixture(90)
  assert.equal(buildTodayActivities(partial.logic, partial.schedule).activities.find(activity => activity.id === 'water').status, 'in_progress')
  const complete = fixture(100)
  assert.equal(buildTodayActivities(complete.logic, complete.schedule).activities.find(activity => activity.id === 'water').status, 'completed')
  assert.equal(buildDailyRecommendation(complete.logic, complete.schedule).evidence.water, 'completed')
})
