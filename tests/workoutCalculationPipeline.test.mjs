import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url), cache = new Map()
const fixed = Date.parse('2026-11-02T15:00:00Z')
class Clock extends Date { constructor(...args) { super(...(args.length ? args : [fixed])) } static now() { return fixed } }
function load(path) {
  path = resolve(path)
  if (cache.has(path)) return cache.get(path).exports
  if (path.endsWith('.json')) return JSON.parse(readFileSync(path, 'utf8'))
  const module = { exports: {} }; cache.set(path, module)
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  runInNewContext(code, { module, exports: module.exports, Date: Clock, Intl, console, require(name) {
    if (name === 'server-only') return {}
    const base = name.startsWith('@/') ? resolve(name.slice(2)) : name.startsWith('.') ? resolve(dirname(path), name) : null
    if (!base) return require(name)
    return load(/\.(?:json|tsx?)$/.test(base) ? base : existsSync(base + '.ts') ? base + '.ts' : base + '.tsx')
  } }, { filename: path })
  return module.exports
}
const { generateProgram, getFounderSelectedExercise } = load('lib/program/generateProgram.ts')
const { buildSelectedPrescription } = load('lib/workout/selectedPrescription.ts')
const { getManualWorkoutLibrary } = load('lib/workout/manualWorkout.ts')
const cycle = load('lib/cycle/getCycleTrainingAdjustment.ts')
const engines = load('lib/dashboard/logic/engines.ts')
const client = { program: 'ember', timezone: 'UTC', equipment_access: ['cable'], capacity_state: 'high', injuries: [], limitations: [], primary_goal: 'strength' }
const strength = { seated_row_weight: 200, seated_row_reps: 8, lateral_raise_weight: 40, lateral_raise_reps: 8 }
function inputs(exercise, patch = {}) {
  const effectiveClient = patch.client || client
  return { date: '2026-11-02', userId: 'synthetic-owner', client: effectiveClient, program: 'ember',
    dailyPlan: { calories: 2000, dailyTargets: { protein: 100, carbs: 200, fats: 60, water: 90 }, dailyRemaining: { calories: 2000, protein: 100, carbs: 200, fats: 60, water: 90 } },
    todayRecovery: { check_in_completed_at: new Clock().toISOString(), energy_level: 8, sleep_hours: 8, sleep_quality: 8, stress_level: 2, soreness_level: 1 },
    recentRecovery: [], todaySymptoms: [], recentSymptoms: [], nutritionLogs: [], nutritionTotals: [], macroEntries: [], mealEntries: [], recentFuelingHistory: [], workoutHistory: [], strengthAssessments: [{ data: strength }], initialAssessment: { data: {} }, photoRecord: null, todayWorkoutFeedback: null, executionHistory: [], missedDayCount: 0, monthlyAssessmentsDueCount: 0, todayRecoveryActivities: [], phoenixTaskIds: [], healthMetrics: { today: {}, recent: [] },
    plannedWorkout: { day_name: 'Selected exercise', day_intent: 'training', exercises: [exercise] }, plannedExercises: [exercise], cycleAdjustment: cycle.getCycleTrainingAdjustment(effectiveClient), ...patch }
}
function daily(exercise, patch) {
  const initial = inputs(exercise, patch), adjusted = cycle.applyCycleTrainingAdjustment({ exercise, adjustment: initial.cycleAdjustment })
  const i = { ...initial, plannedExercises: [adjusted] }
  const s = engines.runSymptomEngine(i), capacity = engines.runCapacityEngine(i, s), recovery = engines.runRecoveryEngine(i, s), hydration = engines.runHydrationEngine(i), nutrition = engines.runNutritionEngine(i)
  const fuel = engines.runFuelReadinessEngine(i, hydration, nutrition, recovery)
  return { adjusted, decision: engines.runWorkoutDecisionEngine(i, capacity, recovery, fuel, hydration, s, engines.runPostureCompensationEngine(i)) }
}
function bases(name, variantId) {
  const generated = generateProgram({ client, initialAssessment: {}, strengthAssessment: strength }).days.flatMap(day => day.exercises).find(ex => ex.exercise === name)
  const selected = getFounderSelectedExercise({ client, initialAssessment: {}, strengthAssessment: strength, catalogExercise: getManualWorkoutLibrary().find(ex => ex.exercise === name), variantId, now: new Clock() }).exercise
  return { generated, selected }
}

test('generated and manual selections retain equipment and cycle once before identical daily safety rules', () => {
  for (const [name, variantId] of [['Seated Cable Row', 'seated_cable_row'], ['Dumbbell Lateral Raise', 'cable_lateral_raise']]) {
    const { generated, selected } = bases(name, variantId)
    assert.equal(generated.calculated_weight, selected.calculated_weight)
    for (const patch of [{}, { client: { ...client, cycle_tracking_enabled: true, last_period_start: '2026-11-01', average_cycle_length: 28 } }, { todayWorkoutFeedback: { response: 'too_much_today' } }, { photoRecord: { posture_flags: { shoulder: true } } }]) {
      const before = JSON.stringify({ generated, selected, strength }), { adjusted, decision } = daily(generated, patch)
      const assigned = decision.assignedWorkout.exercises.find(ex => ex.exercise === name)
      const manual = buildSelectedPrescription({ inputs: inputs(selected, patch), exercise: selected, variantId })
      assert.equal(manual.status, 'available')
      assert.equal(manual.prescription.weightLb, assigned.recommended_weight)
      assert.equal(manual.prescription.reps, assigned.recommended_reps)
      assert.equal(manual.prescription.sets, assigned.sets)
      assert.equal(assigned.calculated_weight, generated.calculated_weight, 'daily variant metadata must not overwrite converted source')
      assert.equal(assigned.recommended_weight, adjusted.recommended_weight * assigned.prescription_safety_multiplier)
      assert.equal(JSON.stringify({ generated, selected, strength }), before)
    }
  }
})

test('cycle caution and moderate daily reductions compose with the established structural factor', () => {
  const { generated } = bases('Seated Cable Row', 'seated_cable_row')
  const patch = { client: { ...client, cycle_tracking_enabled: true, last_period_start: '2026-11-01', average_cycle_length: 28 }, todayWorkoutFeedback: { response: 'too_much_today' }, photoRecord: { posture_flags: { shoulder: true } } }
  const { adjusted, decision } = daily(generated, patch), assigned = decision.assignedWorkout.exercises[0]
  assert.equal(decision.adjustmentLevel, 'level_2_moderate_modify')
  assert.equal(adjusted.recommended_weight, cycle.roundRecommendedWeight(generated.calculated_weight * .85 * .98))
  assert.equal(assigned.prescription_safety_multiplier, .8 * .88)
  assert.equal(assigned.recommended_weight, adjusted.recommended_weight * .8 * .88)
})

test('safety red flags still block training and explicit zero does not revive stale weight', () => {
  const { generated } = bases('Seated Cable Row', 'seated_cable_row')
  const { decision } = daily(generated, { todaySymptoms: [{ severity: 9, symptom_types: { name: 'chest pain', category: 'pain' } }] })
  assert.equal(decision.canTrain, false)
  assert.equal(decision.assignedWorkout.workout_state, 'recovery')
  const zero = cycle.applyCycleTrainingAdjustment({ exercise: { calculated_weight: 0, recommended_weight: 100, reps: 8 }, adjustment: cycle.getCycleTrainingAdjustment(client) })
  assert.equal(zero.baseline_weight, null)
  assert.equal(zero.recommended_weight, null)
})

test('unverified exercise loads remain intact through cycle and safety without taking the day offline', () => {
  const { generated } = bases('Seated Cable Row', 'seated_cable_row')
  const legacy = { ...generated, prescription_calculation: undefined, load_guidance_status: 'unverified',
    load_guidance_reason: 'Saved load needs review.', baseline_weight: 65, calculated_weight: 30,
    cycle_adjusted_weight: 25, recommended_weight: 27, weight: 29, weight_goal: 32 }
  const before = JSON.stringify(legacy)
  const { adjusted, decision } = daily(legacy, { client: { ...client, cycle_tracking_enabled: true,
    last_period_start: '2026-11-01', average_cycle_length: 28 }, todayWorkoutFeedback: { response: 'too_much_today' } })
  assert.equal(decision.canTrain, true)
  assert.equal(decision.assignedWorkout.workout_state, 'planned')
  const assigned = decision.assignedWorkout.exercises[0]
  for (const field of ['baseline_weight', 'calculated_weight', 'cycle_adjusted_weight', 'recommended_weight', 'weight', 'weight_goal']) {
    assert.equal(adjusted[field], legacy[field], `Cycle must not rewrite unverified ${field}`)
    assert.equal(assigned[field], legacy[field], `Safety must not rewrite unverified ${field}`)
  }
  assert.equal(assigned.load_guidance_status, 'unverified')
  assert.equal(decision.adjustmentLevel, 'level_2_moderate_modify')
  assert.ok(assigned.recommended_reps < legacy.reps, 'Existing cycle/safety rep guidance stays active')
  assert.ok(assigned.sets < legacy.sets, 'Existing safety set reduction stays active')
  assert.equal(JSON.stringify(legacy), before)
})

test('a noncalculated core exercise stays loggable without a fabricated zero target and red flags still pause it', () => {
  const core = { exercise: 'Cable Crunch', sets: 3, reps: 20, load_type: 'total_load',
    baseline_weight: null, calculated_weight: null, cycle_adjusted_weight: null, recommended_weight: null,
    load_guidance_status: 'not_calculated', load_guidance_reason: 'No established measured input.' }
  const { decision } = daily(core)
  assert.equal(decision.canTrain, true)
  assert.equal(decision.assignedWorkout.workout_state, 'planned')
  assert.equal(decision.assignedWorkout.exercises[0].recommended_weight, null)
  const paused = daily(core, { todaySymptoms: [{ severity: 9, symptom_types: { name: 'chest pain', category: 'pain' } }] }).decision
  assert.equal(paused.canTrain, false)
  assert.equal(paused.assignedWorkout.workout_state, 'recovery')
})

test('existing timed and non-strength activity doses survive normal daily load processing unchanged', () => {
  const { generated } = bases('Seated Cable Row', 'seated_cable_row')
  const activities = [
    { exercise: 'Cooldown Walk', sets: '', reps: '15 min', load_guidance_status: 'not_calculated', recommended_weight: null },
    { exercise: 'Breathwork', reps: '5 slow breaths', load_guidance_status: 'not_calculated', recommended_weight: null },
    { exercise: 'Glute Stretch', sets: 2, reps: '1min', load_guidance_status: 'not_calculated', recommended_weight: null },
  ]
  const adjusted = cycle.applyCycleTrainingAdjustment({ exercise: generated, adjustment: cycle.getCycleTrainingAdjustment(client) })
  const i = inputs(adjusted, { plannedExercises: [adjusted, ...activities] })
  const s = engines.runSymptomEngine(i), capacity = engines.runCapacityEngine(i, s), recovery = engines.runRecoveryEngine(i, s)
  const hydration = engines.runHydrationEngine(i), nutrition = engines.runNutritionEngine(i)
  const fuel = engines.runFuelReadinessEngine(i, hydration, nutrition, recovery)
  const decision = engines.runWorkoutDecisionEngine(i, capacity, recovery, fuel, hydration, s, engines.runPostureCompensationEngine(i))
  assert.equal(decision.canTrain, true)
  for (const original of activities) {
    const assigned = decision.assignedWorkout.exercises.find(exercise => exercise.exercise === original.exercise)
    assert.equal(JSON.stringify(assigned), JSON.stringify(original))
  }
})
