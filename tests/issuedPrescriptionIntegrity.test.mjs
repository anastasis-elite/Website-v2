import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'

const { generateProgram } = await importTs('lib/program/generateProgram.ts')
const { applyCycleTrainingAdjustment } = await importTs('lib/cycle/getCycleTrainingAdjustment.ts')
const { runWorkoutDecisionEngine } = await importTs('lib/dashboard/logic/engines.ts')
const { projectSavedExercisePrescription, selectPreservedWorkoutSession } = await importTs('lib/program/savedPrescription.ts')
const { hasVerifiedRawCalculation, hasVerifiedFinalPrescription, hasVerifiedSavedPrescription } = await importTs('lib/workout/issuedPrescription.ts')
const { changePrescriptionVariant } = await importTs('lib/workout/changePrescriptionVariant.ts')
const { initialWorkoutLogs } = await importTs('lib/workout/session.ts')
const client = { client_id: 'synthetic-integrity', auth_user_id: 'synthetic-owner', program: 'ember', current_weight: 180,
  timezone: 'Etc/UTC', equipment_access: ['full gym'], primary_goal: 'general_capacity' }
const strength = Object.fromEntries(['bench_press', 'shoulder_press', 'squat', 'romanian_deadlift', 'seated_row', 'bicep_curl', 'lateral_raise', 'close_grip_press']
  .flatMap(key => [[`${key}_weight`, 100], [`${key}_reps`, 10]]))
const source = generateProgram({ client, initialAssessment: {}, strengthAssessment: strength }).days.flatMap(day => day.exercises).find(exercise => exercise.exercise === 'Seated Cable Row')
const clone = value => JSON.parse(JSON.stringify(value))
function issue({ fuel = 'well_fueled', cycle = false, low = false, structural = false, recovery = 'normal_training_day', hydration = 'ready', progress = false, sourceExercise = source } = {}) {
  const adjustment = { weightMultiplier: typeof cycle === 'object' ? cycle.weightMultiplier : cycle ? .85 * .98 : 1,
    repAdjustment: typeof cycle === 'object' ? cycle.repAdjustment : cycle ? -2 : 0,
    label: cycle ? 'Cycle-aware reduced load' : 'Baseline training load', note: 'Recorded cycle inputs', cautionActive: Boolean(cycle) }
  const adjusted = applyCycleTrainingAdjustment({ exercise: sourceExercise, adjustment })
  const inputs = { date: new Date().toISOString().slice(0, 10), userId: client.auth_user_id, client, program: 'ember',
    initialAssessment: { data: {} }, photoRecord: structural ? { posture_flags: { shoulder: true } } : null,
    todayRecovery: { time_available_minutes: 45, soreness_level: 1 }, todayWorkoutFeedback: null,
    plannedWorkout: { day_name: 'Integrity workout', day_intent: 'training', exercises: [adjusted] }, plannedExercises: [adjusted],
    cycleAdjustment: adjustment,
    nutritionLogs: progress ? [1, 2, 3].map(id => ({ id, protein: 100, fiber_target_g: 10, iron_target_mg: 10 })) : [],
    nutritionTotals: progress ? [1, 2, 3].map(id => ({ nutrition_log_id: id, protein_eaten_g: 100, fiber_eaten_g: 10, iron_eaten_mg: 10 })) : [],
    workoutHistory: progress ? [1, 2, 3].map(id => ({ id, completed: true })) : [], executionHistory: [], missedDayCount: 0 }
  return clone(runWorkoutDecisionEngine(inputs, { status: low ? 'low_capacity' : 'high_capacity' },
    { status: recovery, reasoning: 'Saved readiness' }, { status: fuel, reasoning: 'Saved fuel input' },
    { status: hydration, percent: 100, recoverySupportNote: 'Saved hydration' }, { redFlag: false, severity: 'none' },
    { correctivePriorities: [], substitutions: [] }).assignedWorkout.exercises.find(exercise => exercise.exercise === sourceExercise.exercise))
}

test('raw rep calculation and final cycle, readiness, safety, rounding and reduced doses verify independently', () => {
  for (const options of [{}, { cycle: true }, { fuel: 'unknown_needs_input' }, { fuel: 'under_fueled', structural: true }, { low: true, cycle: true },
    { recovery: 'push_day', progress: true }, { hydration: 'building' }, { fuel: 'slightly_under_fueled' }]) {
    const exercise = issue(options), before = clone(exercise)
    assert.equal(hasVerifiedRawCalculation(exercise, 'ember'), true)
    assert.equal(hasVerifiedFinalPrescription(exercise), true)
    assert.equal(projectSavedExercisePrescription(exercise, 'ember'), exercise)
    assert.equal(exercise.issued_prescription.weight, exercise.recommended_weight)
    assert.equal(exercise.issued_prescription.weight_unit, 'lb')
    assert.equal(exercise.issued_prescription.adjustments.daily.fuel_status, options.fuel || 'well_fueled')
    assert.equal(exercise.issued_prescription.adjustments.daily.recovery_reason, 'Saved readiness')
    assert.deepEqual(exercise, before)
  }
  const adjusted = issue({ cycle: true })
  assert.notEqual(adjusted.reps, adjusted.issued_prescription.calculation_reps)
  assert.notEqual(adjusted.recommended_weight, adjusted.prescription_calculation.equipment_weight)
})

test('unknown, corrupt, mismatched equipment, unit and occurrence snapshots never authorize a load', () => {
  const original = issue({ cycle: true, structural: true })
  const changes = [
    e => { e.recommended_weight += 5 }, e => { e.reps += 1 }, e => { e.baseline_weight += 5 },
    e => { e.issued_prescription.version = 'unknown' }, e => { e.issued_prescription.session_key = 'other:0' },
    e => { e.issued_prescription.weight_unit = 'kg' }, e => { e.weight_unit = 'kg' },
    e => { e.issued_prescription.adjustments = {} }, e => { e.issued_prescription.adjustments.daily.fuel_rep_adjustment = -2 },
    e => { e.issued_prescription.adjustments.daily.structural_multiplier = .5 },
    e => { e.issued_prescription.calculation_reps = 3 }, e => { e.prescription_calculation.equipment_weight += 5 },
    e => { e.selected_variant_id = 'unknown' }, e => { e.exercise = 'Unknown exercise' },
    e => { e.suggested_load_rounding = 'unknown' }, e => { e.cycle_rep_adjustment = -10 },
  ]
  for (const change of changes) {
    const exercise = clone(original); change(exercise); const before = clone(exercise)
    assert.equal(hasVerifiedSavedPrescription(exercise, 'ember'), false)
    assert.equal(projectSavedExercisePrescription(exercise, 'ember').load_guidance_status, 'unverified')
    assert.deepEqual(exercise, before)
  }
})

test('every established cycle phase composes with readiness while low dumbbell loads retain their equipment grid', () => {
  for (const modifier of [1, .98, 1.02]) {
    for (const [weightMultiplier, repAdjustment] of [[.85, -2], [.9, -1], [1.03, 0], [1.02, 0], [.95, -1]]) {
      const exercise = issue({ cycle: { weightMultiplier: weightMultiplier * modifier, repAdjustment } })
      assert.equal(hasVerifiedSavedPrescription(exercise, 'ember'), true)
      assert.equal(exercise.issued_prescription.adjustments.cycle.rep_adjustment, repAdjustment)
    }
  }
  const lowSource = generateProgram({ client, initialAssessment: {}, strengthAssessment: { ...strength, lateral_raise_weight: 10 } })
    .days.flatMap(day => day.exercises).find(exercise => exercise.exercise === 'Dumbbell Lateral Raise')
  const low = issue({ sourceExercise: lowSource, structural: true })
  assert.equal(hasVerifiedSavedPrescription(low), true)
  assert.ok(low.recommended_weight > 0 && low.recommended_weight <= 15)
  assert.equal(low.recommended_weight % 2.5, 0)
  assert.equal(low.issued_prescription.load_type, 'per_hand')
  const progress = issue({ recovery: 'push_day', progress: true })
  assert.equal(progress.issued_prescription.adjustments.daily.load_progression, true)
  assert.equal(progress.issued_prescription.adjustments.daily.endurance_progression, true)
  assert.equal(progress.prescription_safety_multiplier, 1.025)
})

test('refreshing new guidance never mutates the previously issued source, stages or exact suggestion', () => {
  const saved = issue({ cycle: true }), before = clone(saved), sourceBefore = clone(source)
  const current = projectSavedExercisePrescription(source, 'ember', client, { data: { ...strength, seated_row_weight: 300 } })
  assert.notEqual(current.recommended_weight, saved.recommended_weight)
  assert.equal(projectSavedExercisePrescription(saved, 'ember'), saved)
  assert.deepEqual(source, sourceBefore)
  assert.deepEqual(saved, before)
})

test('legacy recovery requires a provable original rep target and final transforms; missing daily rep provenance stays unknown', () => {
  const legacyCycle = applyCycleTrainingAdjustment({ exercise: source, adjustment: { weightMultiplier: .85 * .98, repAdjustment: -2,
    label: 'Cycle-aware reduced load', note: 'Saved cycle adjustment', cautionActive: true } })
  assert.equal(projectSavedExercisePrescription(legacyCycle, 'ember'), legacyCycle)
  const marked = { ...legacyCycle, load_guidance_status: 'unverified', load_guidance_reason: 'The original saved load cannot be verified as current guidance. Old projection.' }
  assert.equal(projectSavedExercisePrescription(marked, 'ember').load_guidance_status, undefined)
  assert.equal(marked.load_guidance_status, 'unverified')
  const ambiguous = issue({ cycle: true, fuel: 'under_fueled' }); delete ambiguous.issued_prescription
  assert.equal(projectSavedExercisePrescription(ambiguous, 'ember').load_guidance_status, 'unverified')
  for (const patch of [{ cycle_weight_multiplier: undefined }, { baseline_reps: undefined }, { calculated_weight: 999 },
    { load_guidance_status: 'not_calculated' }, { load_guidance_status: 'unverified', load_guidance_reason: 'Unsupported equipment' }]) {
    assert.notEqual(projectSavedExercisePrescription({ ...legacyCycle, ...patch }, 'ember').load_guidance_status, undefined)
  }
})

test('verified equipment changes reissue the exact occurrence while corrupt or unsupported changes cannot transfer a load', () => {
  const exercise = issue(), changed = changePrescriptionVariant(exercise, 'single_arm_dumbbell_row')
  assert.ok(changed)
  assert.equal(changed.session_key, exercise.session_key)
  assert.equal(changed.issued_prescription.selected_variant_id, 'single_arm_dumbbell_row')
  assert.equal(changed.issued_prescription.load_type, 'single_side')
  assert.equal(hasVerifiedSavedPrescription(changed), true)
  assert.equal(changePrescriptionVariant({ ...exercise, recommended_weight: 999 }, 'single_arm_dumbbell_row'), null)
})

test('explicitly paused unstarted issued sessions preserve their plan without granting legacy defaults or corrupt records a resume', () => {
  const plan = [issue()], now = new Date()
  const session = { ...client, day_name: 'Integrity workout', workout_source: 'recommended', workout_date: now.toISOString(),
    planned_exercises: plan, exercise_logs: initialWorkoutLogs(plan), completed: false }
  assert.equal(selectPreservedWorkoutSession({ sessions: [session], client, now }), session)
  const legacy = clone(session); delete legacy.planned_exercises[0].issued_prescription
  assert.equal(selectPreservedWorkoutSession({ sessions: [legacy], client, now }), null)
  const corrupt = clone(session); corrupt.planned_exercises[0].issued_prescription.weight = 999
  assert.equal(selectPreservedWorkoutSession({ sessions: [corrupt], client, now }), null)
  assert.equal(selectPreservedWorkoutSession({ sessions: [{ ...session, exercise_logs: [null] }], client, now }), null)
})
