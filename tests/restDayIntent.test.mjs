import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'

const jsonMocks = {}
for (const file of ['lib/program/generateProgram.ts', 'lib/program/templateDayIntent.ts']) {
  for (const [, path] of readFileSync(file, 'utf8').matchAll(/from '(@\/[^']+\.json)'/g)) {
    jsonMocks[path] = `export default ${readFileSync(path.slice(2), 'utf8')}`
  }
}
const { generateProgram } = await importTs('lib/program/generateProgram.ts', jsonMocks)
const { getProgramWorkout } = await importTs('lib/program/getProgramWorkout.ts', jsonMocks)
const { getWorkoutForToday } = await importTs('lib/workout/getWorkoutForToday.ts')
const { runWorkoutDecisionEngine, runFlameExecutionEngine } = await importTs('lib/dashboard/logic/engines.ts')
const { getDailyTraining } = await importTs('lib/dashboard/dailyTraining.ts')
const { buildDailyRecommendation } = await importTs('lib/dashboard/dailyRecommendation.ts')

function selectWorkout(output, instant = '2026-10-28T12:00:00Z', timezone = 'Etc/UTC') {
  const OriginalDate = globalThis.Date
  globalThis.Date = class extends OriginalDate {
    constructor(...args) { super(...(args.length ? args : [instant])) }
    static now() { return new OriginalDate(instant).getTime() }
  }
  try { return getProgramWorkout({ client: { timezone, program: 'ember' }, output }) }
  finally { globalThis.Date = OriginalDate }
}

const plannedExercise = { exercise: 'Squat', exercise_category: 'strength', sets: 3, reps: 8 }
const readiness = { recoveryStatus: 'normal_training_day', fuelReadiness: { status: 'well_fueled' }, capacityStatus: 'high_capacity' }
function today(plannedWorkout, assignedExercises = plannedWorkout?.exercises || [], changes = {}) {
  return getWorkoutForToday({ inputs: { client: { timezone: 'Etc/UTC' } }, ...readiness, plannedWorkout, assignedExercises, ...changes })
}
function inputs(plannedWorkout) {
  return {
    client: { timezone: 'Etc/UTC', equipment_access: ['gym'] }, program: 'ember', date: '2026-10-28',
    plannedWorkout, plannedExercises: plannedWorkout?.exercises || [], dailyPlan: {},
    nutritionTotals: [], nutritionLogs: [], workoutHistory: [], strengthAssessments: [], todaySymptoms: [],
    todayRecoveryActivities: [], phoenixTaskIds: [], executionHistory: [], missedDayCount: 0,
  }
}
const fuel = { status: 'well_fueled', preWorkoutAction: '', postWorkoutPriority: '' }
const recovery = { status: 'normal_training_day' }
const hydration = { status: 'ready', percent: 100 }
const symptoms = { severity: 'none', redFlag: false }
const posture = { correctivePriorities: [], substitutions: [] }
function decide(plannedWorkout, capacity = 'high_capacity') {
  return runWorkoutDecisionEngine(inputs(plannedWorkout), { status: capacity }, recovery, fuel, hydration, symptoms, posture)
}

test('generated templates carry explicit source intent before equipment filtering', () => {
  for (const program of ['ember', 'ignite']) {
    const generated = generateProgram({ client: { program, equipment_access: ['commercial gym'] } })
    assert.equal(generated.template_program, program)
    assert.equal(generated.template_version, 'v1')
    assert.equal(generated.days.find(day => day.day_name === 'Wednesday').day_intent, 'rest')
    assert.equal(generated.days.find(day => day.day_name === 'Saturday').day_intent, 'rest')
    assert.equal(generated.days.find(day => day.day_name === 'Monday').day_intent, 'training')
    assert.equal(generated.days.find(day => day.day_name === 'Wednesday').exercises.length, 0)
  }
  const restricted = generateProgram({ client: { program: 'ember', equipment_access: ['unsupported-equipment'] } })
  const emptyTraining = restricted.days.find(day => day.day_intent === 'training' && day.exercises.length === 0)
  assert.ok(emptyTraining, 'fixture must exercise a training day emptied by equipment filtering')
  assert.ok(restricted.excluded_exercises.some(exercise => exercise.day === emptyTraining.day_name))
  assert.equal(today(emptyTraining).type, 'unavailable')
})

test('existing saved plans use only known, matching source intent and never mutate the saved plan', () => {
  for (const program of ['ember', 'ignite']) {
    const output = { program, program_json: { program, days: [{ day_name: 'Wednesday', exercises: [] }] } }
    const original = structuredClone(output)
    assert.equal(selectWorkout(output).todaysWorkout.day_intent, 'rest')
    assert.deepEqual(output, original)
  }
  const cases = [
    { program: 'unknown', days: [{ day_name: 'Wednesday', exercises: [] }] },
    { program: '__proto__', days: [{ day_name: 'Wednesday', exercises: [] }] },
    { program: 'ember', template_version: 'unknown', days: [{ day_name: 'Wednesday', exercises: [] }] },
    { program: 'ember', days: [{ day_name: 'Wednesday' }] },
    { program: 'ember', days: [] },
    { program: 'ember', days: [{ day_name: 'Wednesday', day_intent: 'training', exercises: [] }] },
    { program: 'ember', excluded_exercises: [{ day: 'Wednesday', exercise: 'Squat' }], days: [{ day_name: 'Wednesday', exercises: [] }] },
  ]
  for (const program_json of cases) {
    const { todaysWorkout, adjustedExercises } = selectWorkout({ program: 'ember', program_json })
    assert.equal(today(todaysWorkout, adjustedExercises).type, 'unavailable')
  }
  const trainingMonday = selectWorkout({ program: 'ember', program_json: { program: 'ember', days: [{ day_name: 'Monday', exercises: [] }] } }, '2026-10-26T12:00:00Z')
  assert.equal(today(trainingMonday.todaysWorkout).type, 'unavailable')
})

test('weekday selection respects client timezone and absent weekdays remain unavailable', () => {
  const program_json = { program: 'ember', days: [
    { day_name: 'Tuesday', day_intent: 'training', exercises: [plannedExercise] },
    { day_name: 'Wednesday', exercises: [] },
  ] }
  const selected = selectWorkout({ program_json }, '2026-10-28T00:30:00Z', 'America/Chicago')
  assert.equal(selected.todaysWorkout.day_name, 'Tuesday')
  assert.equal(today(selected.todaysWorkout, selected.adjustedExercises).type, 'planned')
  const sunday = selectWorkout({ program_json }, '2026-11-01T12:00:00Z')
  assert.equal(sunday.todaysWorkout, undefined)
  assert.equal(today(sunday.todaysWorkout).type, 'unavailable')
})

test('intentional rest stays rest through reduced readiness without substituting exercises', () => {
  const rest = { day_name: 'Wednesday', day_intent: 'rest', exercises: [] }
  for (const changes of [{}, { capacityStatus: 'low_capacity' }, { fuelReadiness: { status: 'depleted' } }, { recoveryStatus: 'active_recovery' }, { recoveryStatus: 'full_recovery_or_red_flag' }]) {
    const result = today(rest, [], changes)
    assert.equal(result.type, 'rest')
    assert.equal(result.title, 'Rest day')
    assert.equal(result.completionEligible, false)
    assert.deepEqual(result.exercises, [])
    assert.doesNotMatch(result.reason, /fail|missing|incomplete|foundational|generat/i)
  }
})

test('missing, contradictory and incomplete training days remain unavailable at every capacity', () => {
  for (const plan of [null, { day_name: 'Monday', day_intent: 'training', exercises: [] }, { day_name: 'Monday', exercises: [{ exercise: '' }] }, { day_name: 'Monday', exercises: [{ exercise: 'Mobility flow', exercise_category: 'recovery' }] }, { day_name: 'Wednesday', day_intent: 'rest', exercises: [plannedExercise] }]) {
    for (const changes of [{}, { capacityStatus: 'low_capacity' }, { fuelReadiness: { status: 'depleted' } }]) {
      const result = today(plan, plan?.exercises || [], changes)
      assert.equal(result.type, 'unavailable')
      assert.equal(result.title, 'Workout unavailable')
      assert.equal(result.completionEligible, false)
      assert.deepEqual(result.exercises, [])
      assert.match(result.reason, /missing or incomplete/)
    }
  }
  assert.equal(today({ day_name: 'Monday', day_intent: 'training', exercises: [plannedExercise] }).type, 'planned')
  assert.equal(today({ day_name: 'Monday', day_intent: 'training', exercises: [plannedExercise] }, [plannedExercise], { capacityStatus: 'low_capacity' }).type, 'reduced')
})

test('dashboard decisions and labels keep rest distinct from unavailable, recovery and training', () => {
  for (const [plan, state, label] of [[{ day_name: 'Wednesday', day_intent: 'rest', exercises: [] }, 'rest', 'Rest day'], [{ day_name: 'Monday', day_intent: 'training', exercises: [] }, 'unavailable', 'Workout unavailable']]) {
    for (const capacity of ['high_capacity', 'low_capacity']) {
      const decision = decide(plan, capacity)
      assert.equal(decision.assignedWorkout.workout_state, state)
      assert.equal(decision.canTrain, false)
      assert.equal(decision.intensityTarget, label)
      assert.equal(decision.allowLoadProgression, false)
      assert.equal(decision.allowEnduranceProgression, false)
      assert.deepEqual(decision.assignedWorkout.exercises, [])
      const training = getDailyTraining({ workoutDecision: decision, symptoms, assessments: { dailyCompleted: false } })
      assert.equal(training.mode, state)
      assert.equal(training.label, label)
    }
  }
})

test('rest is not counted as a completed workout or required workout in the daily streak', () => {
  const plan = { day_name: 'Wednesday', day_intent: 'rest', exercises: [] }
  const decision = decide(plan)
  const result = runFlameExecutionEngine({ inputs: inputs(plan), hydration, nutrition: { dataStatus: 'known' }, capacity: { status: 'high_capacity' }, workoutDecision: decision })
  assert.equal(result.requirements.requiredItems.workoutOrMovement, false)
  assert.equal(result.requirements.completedItems.workoutOrMovement, false)
})

test('rest and unavailable plans do not become safety or workout recommendations', () => {
  for (const plan of [{ day_name: 'Wednesday', day_intent: 'rest', exercises: [] }, { day_name: 'Monday', day_intent: 'training', exercises: [] }]) {
    const decision = decide(plan)
    const logic = {
      program: 'ember', workoutDecision: decision, workout: { assigned: false }, symptoms,
      nutrition: { dataStatus: 'known', calories: { percent: 100 }, protein: { percent: 100 } },
      hydration: { target: 64, consumed: 64, remaining: 0, status: 'ready' },
      assessments: { dailyCompleted: true }, execution: {}, recoveryStatus: { reasoning: 'Recovery guidance' },
      capacityStatus: { status: 'high_capacity' },
    }
    const next = { id: 'saved-workout', event_type: 'workout', suggested: false, start_at: '2026-10-28T13:00:00Z', end_at: '2026-10-28T14:00:00Z', status: 'scheduled' }
    const result = buildDailyRecommendation(logic, { date: '2026-10-28', timezone: 'Etc/UTC', now: '2026-10-28T12:00:00Z', events: [], nextActionableEvent: next })
    assert.equal(result.training.mode, decision.assignedWorkout.workout_state)
    assert.equal(result.primary.category, 'none')
    assert.equal(result.supporting.length, 0)
    const activeWorkout = { ...next, flexibility_type: 'fixed', start_at: '2026-10-28T11:00:00Z', end_at: '2026-10-28T13:00:00Z' }
    const active = buildDailyRecommendation(logic, { date: '2026-10-28', timezone: 'Etc/UTC', now: '2026-10-28T12:00:00Z', events: [activeWorkout], nextActionableEvent: activeWorkout })
    assert.equal(active.primary.category, 'none', 'A saved calendar workout does not override rest or unavailable intent')
    assert.equal(active.supporting.length, 0)
  }
})
