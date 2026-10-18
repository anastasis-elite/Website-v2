import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'

const { getTierCapabilities } = await importTs('lib/entitlements.ts')
const { getAdaptiveDashboard } = await importTs('lib/dashboard/getAdaptiveDashboard.ts')
const engines = await importTs('lib/dashboard/logic/engines.ts', {
  '@/lib/workout-os/structuralFilter': `
    export const buildStructuralFilter = () => ({ modifier: 1, avoidTags: [], internalSignals: [], movementEmphasis: [], preferredTags: [] })
  `,
  '@/lib/workout-os/runWorkoutOS': `
    export function runWorkoutOS(context) {
      globalThis.micronutrientMemberCopyFixture.contexts.push(structuredClone(context))
      return structuredClone(globalThis.micronutrientMemberCopyFixture.prescription)
    }
  `,
  '@/lib/workout/getWorkoutForToday': `
    export const getWorkoutForToday = ({ assignedExercises }) => ({ type: 'planned', title: 'Synthetic assigned plan', exercises: assignedExercises, completionEligible: true, reason: 'Follow the assigned plan.' })
    export const workoutFallbackAdjustmentLevel = () => { throw new Error('Unexpected fallback in member-copy fixture') }
  `,
})

const micronutrientCopy = 'Consistent micronutrient logging and performance support a small endurance progression.'
const tiers = ['ember', 'EMBER', 'invalid-tier', null, undefined, 'ignite', 'phoenix']

function fixture(program) {
  const logs = Array.from({ length: 3 }, (_, index) => ({
    id: `synthetic-log-${index}`, protein: 100,
    fiber_target_g: 30, potassium_target_mg: 3000, magnesium_target_mg: 300, iron_target_mg: 18,
  }))
  return {
    program,
    client: { primary_goal: 'strength', equipment_access: ['dumbbell'] },
    nutritionLogs: logs,
    nutritionTotals: logs.map(log => ({
      nutrition_log_id: log.id, protein_eaten_g: 100,
      fiber_eaten_g: 30, potassium_eaten_mg: 3000, magnesium_eaten_mg: 300, iron_eaten_mg: 18,
    })),
    workoutHistory: Array.from({ length: 3 }, () => ({ completed: true })),
    todayRecovery: { soreness_level: 2 },
    executionHistory: [], missedDayCount: 0,
    plannedWorkout: { day_name: 'Synthetic strength' },
    plannedExercises: [{ id: 'synthetic-squat', exercise: 'Goblet squat', equipment: 'dumbbell', sets: 3, recommended_reps: 8, recommended_weight: 20 }],
  }
}

function workoutDecision(program, { endurance = true, load = true } = {}) {
  const prescription = {
    canTrain: true, adjustmentLevel: 'level_0_full_plan',
    dose: { level: 'high', sets: 5, reps: 8, rpe: 'RPE 8', restSeconds: 90, keepAccessories: true, keepFinisher: true, timeMinutes: 45 },
    goal: 'strength', clientCues: ['Move with control.'],
    allowLoadProgression: load, allowEnduranceProgression: endurance,
  }
  globalThis.micronutrientMemberCopyFixture = { prescription, contexts: [] }
  const output = engines.runWorkoutDecisionEngine(
    fixture(program),
    { status: 'high_capacity' },
    { status: 'normal_training_day' },
    { status: 'well_fueled', preWorkoutAction: 'Review macro guidance.', postWorkoutPriority: 'Eat a balanced meal.' },
    { status: 'ready', percent: 100 },
    { redFlag: false, severity: 'mild' },
    { correctivePriorities: [], substitutions: [] },
  )
  return { output, context: globalThis.micronutrientMemberCopyFixture.contexts[0] }
}

function withoutMemberExplanation({ modifications, reasonForModification, ...decision }) {
  return decision
}

test('adaptive micro tracking follows the central capability while macros and water stay available', async () => {
  for (const program of tiers) {
    const dashboard = await getAdaptiveDashboard({ client: { program } })
    const allowed = program === 'ignite' || program === 'phoenix'
    assert.equal(getTierCapabilities(program).nutritionMicronutrients, allowed)
    assert.equal(dashboard.showMicroTracking, allowed)
    assert.equal(dashboard.showMacroTargets, true)
    assert.equal(dashboard.showWaterTarget, true)
  }
})

test('menstrual and luteal cycle copy omits minerals only without the micronutrient capability', () => {
  for (const phase of ['menstrual', 'luteal']) {
    const input = {
      cycleStatus: { enabled: true, phase, cycleDay: 4, recoveryNote: 'Use the current recovery signal.' },
      cycleAdjustment: { note: 'Use the current training signal.' },
      recentSymptoms: [{ likely_cycle_related: true, symptom_types: { name: 'Synthetic symptom' } }],
    }
    const baseline = engines.runCycleEngine({ ...input, program: 'ignite' })
    for (const program of tiers) {
      const result = engines.runCycleEngine({ ...input, program })
      assert.equal(result.nutritionAdjustment, getTierCapabilities(program).nutritionMicronutrients
        ? 'Protect regular meals, fluids, and minerals if symptoms are present.'
        : 'Protect regular meals and fluids if symptoms are present.')
      assert.deepEqual({ ...result, nutritionAdjustment: baseline.nutritionAdjustment }, baseline)
    }
  }
})

test('other phases and disabled cycle results stay unchanged across the capability boundary', () => {
  for (const status of [{ enabled: true, phase: 'follicular' }, { enabled: true, phase: 'unknown' }, { enabled: false }]) {
    const input = { cycleStatus: status, recentSymptoms: [] }
    const baseline = engines.runCycleEngine({ ...input, program: 'ignite' })
    for (const program of tiers) assert.deepEqual(engines.runCycleEngine({ ...input, program }), baseline)
  }
})

test('positive micronutrient history keeps identical OS inputs, assigned exercises, dose and progression flags across tiers', () => {
  for (const load of [true, false]) {
    const baseline = workoutDecision('ignite', { load })
    assert.equal(baseline.context.microsConsistent, true)
    assert.equal(baseline.context.proteinConsistent, true)
    assert.equal(baseline.context.performanceStable, true)
    assert.equal(baseline.output.allowEnduranceProgression, true)
    assert.equal(baseline.output.assignedWorkout.exercises[0].sets, 4)
    assert.equal(baseline.output.assignedWorkout.exercises[0].rest_seconds, 90)
    for (const program of tiers) {
      const current = workoutDecision(program, { load })
      assert.deepEqual(current.context, baseline.context)
      assert.deepEqual(withoutMemberExplanation(current.output), withoutMemberExplanation(baseline.output))
      const expected = getTierCapabilities(program).nutritionMicronutrients
        ? baseline.output.modifications
        : baseline.output.modifications.filter(copy => copy !== micronutrientCopy)
      assert.deepEqual(current.output.modifications, expected)
      assert.equal(current.output.reasonForModification, expected[0] || 'Follow the assigned plan.')
    }
  }
})

test('an unqualified endurance signal adds no micronutrient copy for any tier', () => {
  const baseline = workoutDecision('ignite', { endurance: false })
  assert.equal(baseline.output.allowEnduranceProgression, false)
  assert.equal(baseline.output.modifications.includes(micronutrientCopy), false)
  for (const program of tiers) {
    const current = workoutDecision(program, { endurance: false })
    assert.deepEqual(current.context, baseline.context)
    assert.deepEqual(current.output, baseline.output)
  }
})
