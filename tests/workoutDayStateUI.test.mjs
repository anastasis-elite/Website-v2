import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

// Exercise the actual server page using synthetic read-only data. No account,
// environment credentials, database connection, or remote API is used.
const require = createRequire(import.meta.url)
let fixture
const query = () => {
  const result = { data: [], error: null }
  const q = { then: (...args) => Promise.resolve(result).then(...args) }
  for (const method of ['select', 'eq', 'gte', 'lte', 'order', 'limit']) q[method] = () => q
  q.maybeSingle = async () => ({ data: { program: 'ignite' }, error: null })
  return q
}
const mocks = {
  'next/navigation': { redirect: path => { throw new Error(`Unexpected redirect: ${path}`) } },
  '@/components/workout-dashboard/WorkoutDashboard': 'section',
  '@/components/phone-app/PhoneAppFrame': 'div',
  '@/lib/timezone': { getClientTimeZone: () => 'Etc/UTC', getClientLocalDate: () => '2026-11-05' },
  '@/lib/assessment/strengthWorkoutState': { isStrengthWorkout: () => fixture.scheduledStrength === true, strengthTrainingPaused: (logic, flags) => Boolean(flags || logic.symptoms?.redFlag) },
  '@/lib/assessments/getAssessmentWindow': { getAssessmentWindow: () => ({ isOpen: false }) },
  '@/lib/cycle/getCycleStatus': { getCycleStatus: () => ({}) },
  '@/lib/day/getDailyExecutionPlan': { getDailyExecutionPlan: async () => ({}) },
  '@/lib/dashboard/getDashboardContext': { getDashboardContext: async () => ({
    supabase: { from: query }, user: { id: 'synthetic-owner' },
    client: { client_id: 'synthetic-client', auth_user_id: 'synthetic-owner', program: 'ignite' },
  }) },
  '@/lib/dashboard/logic/getProgramLogicEngine': { getProgramLogicEngine: async () => ({ ...fixture.logic, assessments: { strength: {} } }) },
  '@/lib/program/getProgramWorkout': { getProgramWorkout: () => ({ todaysWorkout: {}, adjustedExercises: [], cycleAdjustment: {} }) },
  '@/lib/safety/getRecentSafetyFlags': { getRecentSafetyFlags: async () => fixture.safetyFlags },
  '@/lib/workout/muscleReadiness': { buildMuscleReadiness: () => [] },
  '@/lib/workout/history': { loadWorkoutHistory: async () => ({ data: [] }) },
  '@/lib/program/savedPrescription': { hasUnconfirmedPrescription: () => false, projectSavedExercisePrescription: exercise => exercise, selectPreservedWorkoutSession: () => null },
}
const module = { exports: {} }
const source = readFileSync('app/dashboard/program/[program]/workout/page.tsx', 'utf8')
const { outputText } = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
} })
runInNewContext(outputText, { module, exports: module.exports, require: name => mocks[name] || require(name) })
const Page = module.exports.default

function findDashboard(node) {
  if (Array.isArray(node)) return node.map(findDashboard).find(Boolean)
  if (!node || typeof node !== 'object') return null
  return node.type === 'section' ? node : findDashboard(node.props?.children)
}

for (const [state, label] of [['rest', 'Rest day'], ['unavailable', 'Workout unavailable']]) {
  test(`${state} is presented distinctly from the safety and recovery previews`, async () => {
    fixture = { safetyFlags: [], logic: {
      workout: { title: label }, workoutDecision: {
        assignedWorkout: { workout_state: state, day_name: label, exercises: [] },
        canTrain: false, displayWorkout: true, reasonForModification: `Synthetic ${state} explanation`,
      },
    } }
    const dashboard = findDashboard(await Page({ params: Promise.resolve({ program: 'ignite' }) }))
    assert.equal(dashboard.props.workoutTitle, label)
    assert.equal(dashboard.props.workoutStateLabel, label)
    assert.equal(dashboard.props.previewTitle, label)
    assert.equal(dashboard.props.previewMessage, `Synthetic ${state} explanation`)
    assert.equal(dashboard.props.showInteractiveWorkout, false)

    fixture.safetyFlags = [{ id: 'synthetic-flag' }]
    const safetyDashboard = findDashboard(await Page({ params: Promise.resolve({ program: 'ignite' }) }))
    assert.equal(safetyDashboard.props.previewTitle, 'Safety support first')
    assert.equal(safetyDashboard.props.showInteractiveWorkout, false)
  })
}

test('ready workouts use the compact brand header without changing the actual workout identity', async () => {
  fixture = { safetyFlags: [], logic: {
    workout: { title: 'Low-Capacity Strength Workout' }, workoutDecision: {
      assignedWorkout: { workout_state: 'reduced', day_name: 'Low-Capacity Strength Workout', exercises: [{ exercise: 'Squat', sets: 3, reps: 8 }] },
      canTrain: true, displayWorkout: true, reasonForModification: 'Synthetic adaptation reason.',
    },
  } }
  const page = await Page({ params: Promise.resolve({ program: 'ignite' }) })
  assert.equal(page.props.compactHeader, true)
  assert.equal(page.props.title, undefined)
  assert.equal(page.props.subtitle, undefined)
  const dashboard = findDashboard(page)
  assert.equal(dashboard.props.workoutTitle, 'Low-Capacity Strength Workout')
  assert.equal(dashboard.props.assignedDayName, 'Low-Capacity Strength Workout')
  assert.equal(dashboard.props.showInteractiveWorkout, true)
})


test('a paused scheduled assessment keeps its review routing inside the workout box', async () => {
  fixture = { scheduledStrength: true, safetyFlags: [{ id: 'synthetic-flag' }], logic: {
    workout: { title: 'Strength assessment' }, workoutDecision: {
      assignedWorkout: { workout_state: 'rest', exercises: [] }, canTrain: false, displayWorkout: false,
      reasonForModification: 'Synthetic safety guidance.',
    },
  } }
  const page = await Page({ params: Promise.resolve({ program: 'ignite' }) })
  const dashboard = findDashboard(page)
  assert.equal(dashboard.props.strengthAssessmentWorkout, true)
  assert.equal(dashboard.props.showInteractiveWorkout, false)
  assert.match(dashboard.props.previewMessage, /remain available to review/)
  assert.equal(page.props.compactHeader, true)
})
