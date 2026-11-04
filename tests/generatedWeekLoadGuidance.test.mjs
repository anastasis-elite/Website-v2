import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { importTs } from './typescriptModule.mjs'

const { generateProgram } = await importTs('lib/program/generateProgram.ts')
const { getProgramWorkout } = await importTs('lib/program/getProgramWorkout.ts')
const { runWorkoutDecisionEngine } = await importTs('lib/dashboard/logic/engines.ts')
const { hasNoCalculatedLoad } = await importTs('lib/workout/loadGuidance.ts')
const strength = {
  bench_press_weight: 100, bench_press_reps: 10, shoulder_press_weight: 80, shoulder_press_reps: 10,
  squat_weight: 150, squat_reps: 10, romanian_deadlift_weight: 140, romanian_deadlift_reps: 10,
  seated_row_weight: 200, seated_row_reps: 10, bicep_curl_weight: 40, bicep_curl_reps: 10,
  lateral_raise_weight: 30, lateral_raise_reps: 10, close_grip_press_weight: 100, close_grip_press_reps: 10,
}
const clientFor = (program, equipment = ['full gym']) => ({ client_id: 'synthetic-client', auth_user_id: 'synthetic-owner',
  program, timezone: 'Etc/UTC', equipment_access: equipment, capacity_state: 'high', injuries: [], limitations: [], primary_goal: 'strength' })
const capacity = { status: 'high_capacity' }, recovery = { status: 'normal_training_day' }
const fuel = { status: 'well_fueled', preWorkoutAction: '', postWorkoutPriority: '' }
const hydration = { status: 'ready', percent: 100 }, symptoms = { severity: 'none', redFlag: false }
const posture = { correctivePriorities: [], substitutions: [] }
const find = (exercises, name) => exercises.find(exercise => exercise.exercise === name)
function decisionFor(client, output, now) {
  const projection = getProgramWorkout({ client, output, now })
  const inputs = { client, program: client.program, date: now.toISOString().slice(0, 10),
    plannedWorkout: projection.todaysWorkout, plannedExercises: projection.adjustedExercises, cycleAdjustment: projection.cycleAdjustment,
    dailyPlan: {}, todayRecovery: { energy_level: 8, sleep_hours: 8, sleep_quality: 8, stress_level: 2, soreness_level: 1 },
    nutritionLogs: [], nutritionTotals: [], macroEntries: [], mealEntries: [], recentFuelingHistory: [], workoutHistory: [],
    strengthAssessments: [{ data: strength }], initialAssessment: { data: {} }, todaySymptoms: [], executionHistory: [], missedDayCount: 0,
    todayRecoveryActivities: [], phoenixTaskIds: [], healthMetrics: { today: {}, recent: [] } }
  return { projection, decision: runWorkoutDecisionEngine(inputs, capacity, recovery, fuel, hydration, symptoms, posture) }
}

for (const program of ['ember', 'ignite']) {
  test(`${program} complete generated week keeps every prescribed training day usable with honest core load guidance`, () => {
    const client = clientFor(program), source = JSON.parse(readFileSync(`data/template/${program}Gym.json`, 'utf8'))
    const originalInputs = JSON.stringify({ client, strength, source })
    const generated = generateProgram({ client, initialAssessment: {}, strengthAssessment: strength })
    const output = { program, program_json: generated }, saved = JSON.stringify(output)
    assert.equal(generated.days.length, source.days.length)
    for (const [index, sourceDay] of source.days.entries()) {
      const generatedDay = generated.days[index]
      assert.equal(generatedDay.day_name, sourceDay.day_name)
      assert.deepEqual(generatedDay.exercises.map(({ exercise, order, sets, reps }) => ({ exercise, order, sets, reps })),
        sourceDay.exercises.map(({ exercise, order, sets, reps }) => ({ exercise, order, sets, reps })))
      const now = new Date(`2026-11-${String(2 + index).padStart(2, '0')}T12:00:00Z`)
      const { projection, decision } = decisionFor(client, output, now)
      assert.equal(projection.todaysWorkout.day_name, sourceDay.day_name)
      if (!sourceDay.exercises.length) {
        assert.equal(decision.assignedWorkout.workout_state, 'rest')
        assert.equal(decision.canTrain, false)
        assert.equal(decision.assignedWorkout.exercises.length, 0)
        continue
      }
      assert.equal(decision.assignedWorkout.workout_state, 'planned', sourceDay.day_name)
      assert.equal(decision.canTrain, true, sourceDay.day_name)
      assert.equal(decision.assignedWorkout.exercises.length, sourceDay.exercises.length)
      for (const exercise of decision.assignedWorkout.exercises) {
        assert.equal(exercise.prescription_status, undefined)
        assert.ok(exercise.sets > 0 && exercise.recommended_reps > 0)
        if (hasNoCalculatedLoad(exercise)) {
          assert.equal(exercise.recommended_weight, null)
          assert.equal(exercise.calculated_weight, null)
          assert.equal(exercise.cycle_adjusted_weight, null)
        }
      }
    }
    const all = generated.days.flatMap(day => day.exercises)
    for (const name of ['Cable Crunch', 'Hanging Knee Raise']) {
      const exercise = find(all, name)
      assert.equal(exercise.load_guidance_status, 'not_calculated')
      assert.equal(exercise.load_type, 'total_load', 'Do not infer a new bodyweight or equipment mapping.')
      assert.equal(exercise.calculated_weight, null)
      assert.equal(exercise.recommended_weight, null)
      assert.equal(exercise.prescription_calculation, undefined)
    }
    for (const exercise of all.filter(exercise => exercise.exercise === 'Side Plank')) {
      assert.equal(exercise.load_type, 'bodyweight')
      assert.equal(exercise.calculated_weight, 0)
      assert.equal(exercise.recommended_weight, 0)
      assert.equal(exercise.load_guidance_status, undefined)
    }
    assert.equal(find(all, 'Seated Cable Row').intensity_factor, program === 'ember' ? .40 : .60)
    assert.equal(find(all, 'Lat Pulldown').intensity_factor, program === 'ember' ? .35 : .55)
    assert.equal(decisionFor(client, output, new Date('2026-11-08T12:00:00Z')).decision.assignedWorkout.workout_state, 'unavailable', 'Absent source Sunday remains absent.')
    assert.equal(JSON.stringify(output), saved, 'Projection and daily safety never mutate the saved source week.')
    assert.equal(JSON.stringify({ client, strength, source }), originalInputs)
  })
}

test('bodyweight movements retain zero added load without an assessment while unsupported external loads remain unknown', () => {
  for (const program of ['ember', 'ignite']) {
    const client = clientFor(program), generated = generateProgram({ client, strengthAssessment: {} })
    const all = generated.days.flatMap(day => day.exercises)
    for (const exercise of all.filter(exercise => exercise.load_type === 'bodyweight')) {
      assert.equal(exercise.recommended_weight, 0)
      assert.equal(exercise.calculated_weight, 0)
      assert.equal(exercise.prescription_status, undefined)
    }
    for (const name of ['Seated Cable Row', 'Cable Crunch', 'Hanging Knee Raise']) {
      const exercise = find(all, name)
      assert.equal(exercise.recommended_weight, null)
      assert.equal(exercise.calculated_weight, null)
      assert.equal(exercise.prescription_status, undefined)
      assert.ok(hasNoCalculatedLoad(exercise))
    }
    for (const sourceDay of generated.days.filter(day => day.exercises.length)) {
      const index = generated.days.indexOf(sourceDay)
      const { decision } = decisionFor(client, { program, program_json: generated }, new Date(`2026-11-0${2 + index}T12:00:00Z`))
      assert.equal(decision.assignedWorkout.workout_state, 'planned')
      assert.equal(decision.canTrain, true)
    }
  }
})

test('restricted inventory retains established unloaded movements without inventing compatibility for unmapped gym exercises', () => {
  for (const program of ['ember', 'ignite']) {
    const generated = generateProgram({ client: clientFor(program, ['bodyweight']), strengthAssessment: {} })
    const all = generated.days.flatMap(day => day.exercises)
    assert.ok(all.some(exercise => exercise.exercise === 'Side Plank'))
    assert.ok(all.every(exercise => exercise.load_type === 'bodyweight' && exercise.recommended_weight === 0))
    assert.ok(generated.excluded_exercises.some(exercise => exercise.exercise === 'Hanging Knee Raise'))
    assert.ok(generated.excluded_exercises.some(exercise => exercise.exercise === 'Cable Crunch'))
    assert.ok(!generated.excluded_exercises.some(exercise => exercise.exercise === 'Side Plank'))
  }
})
