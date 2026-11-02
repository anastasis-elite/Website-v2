import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'

const { buildDailyRecommendation } = await importTs('lib/dashboard/dailyRecommendation.ts')
const { buildTodayActivities, presentTodayActivities } = await importTs('lib/dashboard/todayActivities.ts')
const { getStreakRequirementProgress } = await importTs('lib/dashboard/logic/streakRequirementProgress.ts')
const date = '2026-11-02'
const completeTitle = 'Day completed'
const completeReason = 'Reward yourself with a little treat.'
const neutralTitle = 'Leave a little room for yourself'
const neutralReason = 'There is no additional action in your recorded plan right now. Leave the rest flexible.'

function flame({ program = 'ignite', day = date, required = {}, completed = {} } = {}) {
  const requiredItems = { dailyCheckIn: true, nutrition: true, hydration: true, workoutOrMovement: false,
    recovery: program === 'phoenix', sleep: false, customTasks: false, ...required }
  const completedItems = { dailyCheckIn: true, nutrition: true, hydration: true, workoutOrMovement: false,
    recovery: true, sleep: false, customTasks: false, ...completed }
  const streakEligible = Object.entries(requiredItems).every(([key, value]) => !value || completedItems[key])
  return { streakEligible, dailyScore: 100, requirements: { date: day, programTier: program,
    capacityStatus: 'moderate_capacity', missedDayCount: 0, requiredItems, completedItems,
    completionScore: 100, streakEligible, resetMessage: null } }
}
function fixture(program = 'ignite') {
  const logic = { program, client: { id: 'SYNTHETIC-COMPLETE-DAY' }, flameState: flame({ program }),
    hydration: { target: 80, consumed: 80, remaining: 0, status: 'ready', presentationPacing: { state: 'complete' } },
    nutrition: { dataStatus: 'known', calories: { target: 2000, consumed: 2000, remaining: 0, percent: 100 },
      protein: { percent: 100 }, pacing: { state: 'complete' } },
    assessments: { dailyCompleted: true }, execution: { workoutComplete: false, nutritionLogged: true, recoveryComplete: true },
    workout: { assigned: false, title: 'Rest day' }, workoutDecision: { canTrain: false,
      assignedWorkout: { workout_state: 'rest' }, reasonForModification: 'Existing intentional rest day.' },
    capacityStatus: { status: 'moderate_capacity' }, symptoms: { redFlag: false },
    recoveryStatus: { reasoning: 'Existing recovery guidance.' } }
  const schedule = { date, timezone: 'America/Chicago', now: `${date}T19:00:00Z`, events: [], nextActionableEvent: null,
    dailyGuide: { date, activities: { schedule: { status: 'reviewed' } } } }
  return { logic, schedule }
}
function assertNeutral(primary) {
  assert.equal(primary.id, 'pause')
  assert.equal(primary.title, neutralTitle)
  assert.equal(primary.reason, neutralReason)
  assert.equal(primary.completed, false)
  assert.equal(primary.availability, 'confirmed')
  assert.equal(primary.href, '/dashboard/schedule')
}
function assertComplete(primary) {
  assert.equal(primary.id, 'pause')
  assert.equal(primary.title, completeTitle)
  assert.equal(primary.reason, completeReason)
  assert.equal(primary.completed, true)
  assert.equal(primary.availability, 'completed')
  assert.equal(primary.href, '/dashboard/schedule')
}

test('the exact completed-day copy uses the same secured required-item evidence as Today progress, without changing inputs or navigation', () => {
  for (const program of ['ember', 'ignite', 'phoenix']) {
    const { logic, schedule } = fixture(program), before = structuredClone({ logic, schedule })
    const progress = getStreakRequirementProgress(logic.flameState, schedule.date,
      { programTier: logic.program, now: schedule.now, timezone: schedule.timezone })
    assert.equal(progress.available, true)
    assert.equal(progress.secured, true)
    assert.equal(progress.completedCount, progress.requiredCount)
    const result = buildDailyRecommendation(logic, schedule)
    assertComplete(result.primary)
    assert.equal(result.supporting.length, 0)
    assert.equal(result.date, schedule.date)
    assert.deepEqual({ logic, schedule }, before)
  }
})

test('an incomplete requirement stays neutral even with no next action, no visible cards and a full optional score', () => {
  const { logic, schedule } = fixture()
  logic.flameState = flame({ required: { customTasks: true }, completed: { customTasks: false } })
  assert.equal(logic.flameState.dailyScore, 100)
  assert.equal(logic.flameState.requirements.completionScore, 100)
  assert.equal(logic.flameState.streakEligible, false)
  assert.deepEqual(presentTodayActivities(logic, schedule), [])
  assert.equal(schedule.nextActionableEvent, null)
  const canonical = buildTodayActivities(logic, schedule)
  assert.equal(canonical.completed, canonical.total, 'Canonical activity totals are not the complete streak denominator.')
  assertNeutral(buildDailyRecommendation(logic, schedule).primary)
})

test('water and calorie cards hidden by pace or sleep never establish required completion', () => {
  for (const state of ['on_pace', 'sleep']) {
    const { logic, schedule } = fixture()
    logic.hydration = { target: 80, consumed: 40, remaining: 40, status: 'ready', presentationPacing: { state } }
    logic.nutrition.calories = { target: 2000, consumed: 1000, remaining: 1000, percent: 50 }
    logic.nutrition.pacing = { state }
    logic.execution.nutritionLogged = false
    logic.flameState = flame({ completed: { hydration: false, nutrition: false } })
    assert.deepEqual(presentTodayActivities(logic, schedule), [])
    assertNeutral(buildDailyRecommendation(logic, schedule).primary)
  }
})

test('missing, failed, stale, wrong-tier and inconsistent required evidence cannot display completed-day copy', () => {
  const invalid = [undefined, null, { error: 'Synthetic unavailable result' },
    { streakEligible: true },
    flame({ day: '2026-11-01' }), flame({ program: 'phoenix' }),
    { ...flame(), streakEligible: false },
    { ...flame(), requirements: { ...flame().requirements, completedItems: {} } },
    { ...flame(), requirements: { ...flame().requirements, requiredItems: { ...flame().requirements.requiredItems, arbitrary: true } } },
  ]
  for (const value of invalid) {
    const { logic, schedule } = fixture()
    logic.flameState = value
    assertNeutral(buildDailyRecommendation(logic, schedule).primary)
  }
})

test('selected dates must match both authoritative evidence and the current member-local day across midnight', () => {
  const { logic, schedule } = fixture()
  schedule.now = '2026-11-03T05:59:59Z' // Still November 2 in America/Chicago.
  assertComplete(buildDailyRecommendation(logic, schedule).primary)
  schedule.now = '2026-11-03T06:00:00Z'
  assertNeutral(buildDailyRecommendation(logic, schedule).primary)

  schedule.now = '2026-11-03T05:59:59Z'
  schedule.date = '2026-11-03'
  schedule.dailyGuide.date = schedule.date
  logic.flameState = flame({ day: schedule.date })
  assertNeutral(buildDailyRecommendation(logic, schedule).primary)
  schedule.now = '2026-11-03T06:00:00Z'
  assertComplete(buildDailyRecommendation(logic, schedule).primary)

  for (const invalidDate of ['unknown', '', '2026-11-04']) {
    schedule.date = invalidDate
    schedule.dailyGuide.date = invalidDate
    logic.flameState = flame({ day: invalidDate })
    assertNeutral(buildDailyRecommendation(logic, schedule).primary)
  }
})

test('real safety, pending check-in and current commitment actions retain priority and their existing destinations', () => {
  const safety = fixture(); safety.logic.symptoms.redFlag = true
  let primary = buildDailyRecommendation(safety.logic, safety.schedule).primary
  assert.equal(primary.id, 'safety'); assert.equal(primary.href, '/dashboard/recovery')
  assert.notEqual(primary.title, completeTitle)

  const checkIn = fixture(); checkIn.logic.assessments.dailyCompleted = false
  checkIn.logic.flameState = flame({ completed: { dailyCheckIn: false } })
  primary = buildDailyRecommendation(checkIn.logic, checkIn.schedule).primary
  assert.equal(primary.id, 'check-in'); assert.equal(primary.href, '/dashboard/check-in')
  assert.notEqual(primary.title, completeTitle)

  const commitment = fixture()
  commitment.schedule.events = [{ id: 'synthetic-appointment', event_type: 'appointment', title: 'Saved appointment',
    status: 'scheduled', flexibility_type: 'fixed', suggested: false,
    start_at: '2026-11-02T18:30:00Z', end_at: '2026-11-02T19:30:00Z' }]
  primary = buildDailyRecommendation(commitment.logic, commitment.schedule).primary
  assert.equal(primary.id, 'synthetic-appointment')
  assert.equal(primary.title, 'Saved appointment')
  assert.equal(primary.href, '/dashboard/schedule#event-synthetic-appointment')
  assert.equal(primary.completed, false)
})

test('invalid schedule clocks or zones retain existing rejection instead of returning a completed day', () => {
  for (const patch of [{ now: 'not-a-timestamp' }, { timezone: 'Not/A_Zone' }]) {
    const { logic, schedule } = fixture()
    assert.throws(() => buildDailyRecommendation(logic, { ...schedule, ...patch }), RangeError)
  }
})

test('the shared schedule service keeps neutral and completed fallback actions idle without completion or defer controls', async t => {
  const { getDailyScheduleState } = await importTs('lib/schedule/service.ts', {
    '@/lib/calendar/service': 'export const importedScheduleEvents = async () => []',
    '@/lib/day/getDailyExecutionPlan': 'export const getDailyExecutionPlan = async () => { throw new Error("Unexpected plan read") }',
    '@/lib/dashboard/logic/getProgramLogicForClient': 'export const getProgramLogicForClient = async () => { throw new Error("Unexpected logic read") }',
  })
  const RealDate = globalThis.Date
  const now = RealDate.parse('2026-11-02T19:00:00Z')
  globalThis.Date = class extends RealDate {
    constructor(...args) { super(...(args.length ? args : [now])) }
    static now() { return now }
  }
  t.after(() => { globalThis.Date = RealDate })
  const supabase = { from() {
    const result = { data: [], error: null }
    const query = { select() { return query }, eq() { return query }, or() { return query },
      order() { return Promise.resolve(result) }, then(resolve) { return Promise.resolve(result).then(resolve) } }
    return query
  } }
  for (const secured of [false, true]) {
    const { logic, schedule } = fixture()
    if (!secured) logic.flameState = flame({ required: { customTasks: true }, completed: { customTasks: false } })
    const state = await getDailyScheduleState({ supabase, user: { id: 'synthetic-owner' },
      client: { client_id: logic.client.id, program: logic.program, timezone: schedule.timezone,
        daily_structure_reviewed_at: '2026-11-02T12:00:00Z', onboarding_data: { dailyGuide: schedule.dailyGuide } },
      date, logic, dailyPlan: { date, timezone: schedule.timezone, timing: {}, completedDailyTasks: [] } })
    if (secured) assertComplete(state.dailyRecommendation.primary)
    else assertNeutral(state.dailyRecommendation.primary)
    assert.equal(state.nextAction.title, secured ? completeTitle : neutralTitle)
    assert.equal(state.nextAction.reason, secured ? completeReason : neutralReason)
    assert.equal(state.nextAction.action_route, '/dashboard/schedule')
    assert.equal(state.nextAction.urgency, 'none')
    assert.equal(state.nextAction.can_complete, false)
    assert.equal(state.nextAction.can_defer, false)
    assert.equal(state.nextAction.overdue, false)
    assert.equal(state.nextAction.start_at, null)
    assert.deepEqual(state.unavailableSources, [])
  }
})
