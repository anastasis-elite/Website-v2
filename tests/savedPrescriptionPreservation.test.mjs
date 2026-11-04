import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const clone = value => JSON.parse(JSON.stringify(value))
const now = new Date('2026-11-05T16:00:00Z')
class FixedDate extends Date { constructor(...args) { super(...(args.length ? args : [now.toISOString()])) } static now() { return now.getTime() } }
function loader(mocks = {}) {
  const cache = new Map()
  function load(path) {
    path = resolve(path)
    if (cache.has(path)) return cache.get(path).exports
    if (path.endsWith('.json')) return JSON.parse(readFileSync(path, 'utf8'))
    const module = { exports: {} };cache.set(path, module)
    const compiled = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText
    runInNewContext(compiled, { module, exports: module.exports, Date: FixedDate, Request, Response, URL, Buffer, console,
      process: { env: { NODE_ENV: 'test' } }, require(name) {
        if (Object.hasOwn(mocks, name)) return mocks[name]
        if (name === 'server-only') return {}
        const base = name.startsWith('@/') ? resolve(name.slice(2)) : name.startsWith('.') ? resolve(dirname(path), name) : null
        if (!base) return require(name)
        return load(/\.(json|tsx?)$/.test(base) ? base : existsSync(base + '.ts') ? base + '.ts' : base + '.tsx')
      },
    }, { filename: path })
    return module.exports
  }
  return load
}
const actual = loader()
const { projectSavedExercisePrescription, selectPreservedWorkoutSession } = actual('lib/program/savedPrescription.ts')
const { getProgramWorkout } = actual('lib/program/getProgramWorkout.ts')
const { generateProgram } = actual('lib/program/generateProgram.ts')
const { getWorkoutForToday } = actual('lib/workout/getWorkoutForToday.ts')
const { initialWorkoutLogs, resumeWorkoutSession, workoutSessionKeys } = actual('lib/workout/session.ts')
const { workoutCompletion } = actual('lib/workout/activity.ts')
const { getSavedPlanState } = actual('lib/program/getSavedPlanState.ts')
const client = { client_id: 'SYNTHETIC', auth_user_id: 'synthetic-owner', program: 'ember', timezone: 'Etc/UTC', equipment_access: ['full gym'] }
const strength = Object.fromEntries(['bench_press', 'shoulder_press', 'squat', 'romanian_deadlift', 'seated_row', 'bicep_curl', 'lateral_raise', 'close_grip_press']
  .flatMap(key => [[`${key}_weight`, '100'], [`${key}_reps`, '10']]))
const generated = generateProgram({ client, initialAssessment: {}, strengthAssessment: strength })
const row = generated.days.flatMap(day => day.exercises).find(exercise => exercise.exercise === 'Seated Cable Row')
const legacy = () => { const exercise = clone(row);delete exercise.prescription_calculation;return exercise }
const output = exercises => ({ program: 'ember', program_json: { ...clone(generated), days: [{ day_name: 'Thursday', day_intent: 'training', exercises }] } })
const neutral = (day, exercises) => getWorkoutForToday({ inputs: { client }, plannedWorkout: day, assignedExercises: exercises,
  recoveryStatus: 'normal_training_day', fuelReadiness: { status: 'well_fueled' }, capacityStatus: 'high_capacity' })
function session(exercises = [legacy(), { id: 'bodyweight', exercise: 'Side Plank', load_type: 'bodyweight', sets: 2, reps: 8 }]) {
  const logs = initialWorkoutLogs(exercises)
  logs[0].set_logs = [{ set_number: 1, reps: 10, weight: 35, weight_unit: 'lb', completed_at: now.toISOString() }]
  return { id: 'preserved-session', ...client, day_name: 'Thursday', workout_source: 'recommended', workout_date: now.toISOString(),
    planned_exercises: exercises, exercise_logs: logs, completed: false, updated_at: now.toISOString() }
}

test('exact provenance passes while unverified loads keep every source load and dose field for review', () => {
  assert.ok(row.prescription_calculation)
  assert.equal(projectSavedExercisePrescription(row, 'ember'), row)
  for (const exercise of [legacy(), { ...row, prescription_calculation: { version: 'founder-load-v2' } },
    { ...row, prescription_calculation: { ...row.prescription_calculation, reference_exercise: 'Lat Pulldown' } },
    { ...row, calculated_weight: row.calculated_weight * 2 }, { ...row, exercise: 'Unknown row' },
    { ...row, baseline_weight: row.baseline_weight + 5, prescription_calculation: { ...row.prescription_calculation, base_weight: row.baseline_weight + 5 } },
    { ...row, rep_multiplier: 0.001, prescription_calculation: { ...row.prescription_calculation, rep_multiplier: 0.001 } }]) {
    const before = JSON.stringify(exercise)
    const projected = projectSavedExercisePrescription(exercise, 'ember')
    assert.equal(projected.prescription_status, undefined)
    assert.equal(projected.load_guidance_status, 'unverified')
    assert.match(projected.load_guidance_reason, /cannot be verified|original saved load/i)
    assert.equal(JSON.stringify(exercise), before)
    for (const field of ['baseline_weight', 'calculated_weight', 'recommended_weight', 'cycle_adjusted_weight', 'estimated_1rm', 'intensity_factor', 'rep_multiplier']) {
      assert.equal(projected[field], exercise[field], `${field} remains original review context`)
    }
    assert.equal(projected.sets, exercise.sets)
  }
  assert.equal(projectSavedExercisePrescription(row, undefined).load_guidance_status, 'unverified')
  assert.equal(projectSavedExercisePrescription(row, 'phoenix').load_guidance_status, 'unverified')
  for (const exercise of [{ exercise: 'Side Plank', load_type: 'bodyweight', calculated_weight: 0 },
    { exercise: 'Cooldown Walk', exercise_category: 'recovery', duration_minutes: 10 }]) {
    assert.equal(projectSavedExercisePrescription(exercise, 'ember'), exercise)
  }
})

test('all legacy tiers retain available doses and identities without recalculating stored loads or triggering regeneration', () => {
  for (const program of ['ember', 'ignite', 'phoenix']) {
  const member = { ...client, program, cycle_tracking_enabled: true, last_period_start: '2026-11-04', average_cycle_length: 28 }
  const saved = output([legacy()])
  saved.program = program;saved.program_json.program = program
  if (program === 'phoenix') saved.program_json.phoenix_track = 'phoenixStrength'
  const savedBefore = JSON.stringify(saved)
  const result = getProgramWorkout({ client: member, output: saved, now })
  assert.equal(result.programJson, saved.program_json)
  assert.equal(result.todaysWorkout.exercises[0], saved.program_json.days[0].exercises[0])
  assert.equal(result.todaysWorkout.prescription_status, undefined)
  assert.equal(result.adjustedExercises[0].prescription_status, undefined)
  assert.equal(result.adjustedExercises[0].load_guidance_status, 'unverified')
  for (const field of ['baseline_weight', 'calculated_weight', 'recommended_weight', 'cycle_adjusted_weight', 'estimated_1rm']) {
    assert.equal(result.adjustedExercises[0][field], saved.program_json.days[0].exercises[0][field], `${program} ${field} is never recalculated from rounded legacy 1RM`)
  }
  assert.deepEqual(clone(workoutSessionKeys(result.adjustedExercises)), clone(workoutSessionKeys(saved.program_json.days[0].exercises)))
  assert.equal(result.adjustedExercises[0].sets, saved.program_json.days[0].exercises[0].sets)
  assert.equal(result.adjustedExercises[0].recommended_reps, Math.max(1, saved.program_json.days[0].exercises[0].reps - 2), 'Existing cycle rep reduction still applies')
  assert.equal(neutral(result.todaysWorkout, result.adjustedExercises).type, 'planned')
  assert.equal(neutral(result.todaysWorkout, result.adjustedExercises).completionEligible, true)
  assert.equal(getSavedPlanState(saved).status, 'ready', 'Calculation review does not authorize the existing regenerate-plan repair')
  assert.equal(JSON.stringify(saved), savedBefore)
  }
  const corrected = getProgramWorkout({ client, output: output([row]), now })
  assert.equal(corrected.todaysWorkout.prescription_status, undefined)
  assert.equal(neutral(corrected.todaysWorkout, corrected.adjustedExercises).type, 'planned')
})

test('saved obsolete outage markers recover bodyweight and noncalculated load treatment without deleting stored fields', () => {
  const fixtures = [
    { exercise: 'Side Plank', load_type: 'bodyweight', sets: 3, reps: 30, baseline_weight: null, calculated_weight: null, recommended_weight: null },
    { exercise: 'Cooldown Walk', exercise_category: 'recovery', duration_minutes: 10 },
    { exercise: 'Hanging Knee Raise', sets: 3, reps: 12, load_type: 'total_load', baseline_weight: null, calculated_weight: null, recommended_weight: null },
    { exercise: 'Seated Cable Row', sets: 3, reps: 10, load_type: 'total_load', baseline_weight: null, calculated_weight: null, recommended_weight: null },
  ]
  for (const [index, original] of fixtures.entries()) {
    const source = { ...original, prescription_status: 'unavailable', prescription_unavailable_reason: 'Old gate' }, before = JSON.stringify(source)
    const projected = projectSavedExercisePrescription(source, 'ember')
    assert.equal(projected.prescription_status, undefined)
    assert.equal(projected.prescription_unavailable_reason, undefined)
    assert.equal(projected.load_type, original.load_type)
    assert.equal(projected.calculated_weight, original.calculated_weight)
    assert.equal(projected.sets, original.sets)
    if (index === 2) assert.equal(projected.load_guidance_status, 'not_calculated', 'Unsupported Crunch input is not invented as a bodyweight baseline')
    if (index === 3) assert.equal(projected.load_guidance_status, 'unverified', 'Missing known strength input has no trusted external load')
    if (index < 2) assert.equal(projected.load_guidance_status, undefined)
    for (const program of ['ignite', 'phoenix', 'phoenixStrength']) {
      const otherTier = projectSavedExercisePrescription(source, program)
      assert.equal(otherTier.load_guidance_status, projected.load_guidance_status)
      for (const [field, value] of Object.entries(original)) assert.equal(otherTier[field], value)
    }
    assert.equal(JSON.stringify(source), before)
  }
  for (const original of [{ exercise: 'Hanging Knee Raise', load_type: 'total_load', calculated_weight: null },
    { exercise: 'Custom movement', sets: 3, reps: 8 }]) {
    const projected = projectSavedExercisePrescription(original, 'ember')
    assert.equal(projected.load_guidance_status, 'not_calculated')
    for (const [field, value] of Object.entries(original)) assert.equal(projected[field], value)
  }
  const bodyweight = { exercise: 'Side Plank', load_type: 'bodyweight', calculated_weight: 0 }
  assert.equal(projectSavedExercisePrescription(bodyweight, 'ember'), bodyweight)
})

test('partial and completed sessions retain exact planned snapshots, occurrence keys, actuals and 50% completion', () => {
  for (const completed of [false, true]) {
    const saved = session();saved.completed = completed
    const before = JSON.stringify(saved)
    const selected = selectPreservedWorkoutSession({ sessions: [saved], client, now })
    assert.equal(selected, saved)
    assert.equal(selected.planned_exercises, saved.planned_exercises)
    const initial = initialWorkoutLogs(selected.planned_exercises)
    const resumed = resumeWorkoutSession(initial, null, selected)
    assert.deepEqual(clone(workoutSessionKeys(resumed.logs)), clone(workoutSessionKeys(saved.exercise_logs)))
    assert.deepEqual(clone(resumed.logs[0].set_logs), clone(saved.exercise_logs[0].set_logs))
    assert.equal(resumed.logs[0].recommended_weight, saved.exercise_logs[0].recommended_weight)
    const count = workoutCompletion(resumed.logs, selected.planned_exercises)
    assert.equal(count.requiredSets, Math.ceil(count.totalSets / 2))
    assert.equal(count.completedSets, 1)
    assert.equal(JSON.stringify(saved), before)
  }
})

test('session preservation refuses foreign, old, manual, unstarted, incoherent and ambiguous snapshots', () => {
  const saved = session()
  const bad = [
    { ...saved, client_id: 'OTHER' }, { ...saved, auth_user_id: 'other-owner' }, { ...saved, program: 'ignite' },
    { ...saved, workout_date: '2026-11-04T16:00:00Z' }, { ...saved, workout_source: 'manual' },
    { ...saved, exercise_logs: initialWorkoutLogs(saved.planned_exercises) },
    { ...saved, planned_exercises: [] }, { ...saved, exercise_logs: [{ ...saved.exercise_logs[0], session_key: 'other-key' }] },
  ]
  for (const candidate of bad) assert.equal(selectPreservedWorkoutSession({ sessions: [candidate], client, now }), null)
  assert.equal(selectPreservedWorkoutSession({ sessions: [saved, { ...saved, id: 'other-session', day_name: 'Other workout' }], client, now }), null)
})

function findDashboard(node) {
  if (Array.isArray(node)) return node.map(findDashboard).find(Boolean)
  return node && typeof node === 'object' ? node.type === 'dashboard-fixture' ? node : findDashboard(node.props?.children) : null
}
function pageFixture(savedSession) {
  let safetyFlags = [], redFlag = false
  const storedOutput = output([legacy()]), sessions = savedSession ? [savedSession] : []
  const query = () => { const q = { then: (...args) => Promise.resolve({ data: [] }).then(...args), maybeSingle: async () => ({ data: storedOutput }) }
    for (const name of ['select', 'eq', 'order', 'limit']) q[name] = () => q
    return q }
  const load = loader({
    'next/navigation': { redirect: path => { throw Error(path) } },
    '@/components/workout-dashboard/WorkoutDashboard': { __esModule: true, default: 'dashboard-fixture' },
    '@/components/phone-app/PhoneAppFrame': { __esModule: true, default: 'frame-fixture' },
    '@/lib/dashboard/getDashboardContext': { getDashboardContext: async () => ({ supabase: { from: query }, user: { id: client.auth_user_id }, client }) },
    '@/lib/cycle/getCycleStatus': { getCycleStatus: () => ({}) },
    '@/lib/day/getDailyExecutionPlan': { getDailyExecutionPlan: async () => ({}) },
    '@/lib/dashboard/logic/getProgramLogicEngine': { getProgramLogicEngine: async args => ({ assessments: { strength: {} }, symptoms: { redFlag },
      recoveryStatus: { status: 'normal_training_day' }, workout: { title: 'Thursday' },
      workoutDecision: { assignedWorkout: { workout_state: 'planned', day_name: 'Thursday', exercises: args.plannedExercises }, canTrain: !redFlag, displayWorkout: true,
        adjustmentLevel: redFlag ? 'level_4_rest_or_red_flag' : 'level_0_full_plan', reasonForModification: 'Existing daily training guidance.' } }) },
    '@/lib/safety/getRecentSafetyFlags': { getRecentSafetyFlags: async () => safetyFlags },
    '@/lib/workout/muscleReadiness': { buildMuscleReadiness: () => [] },
    '@/lib/workout/history': { workoutLocalDate: (row, timeZone) => actual('lib/workout/history.ts').workoutLocalDate(row, timeZone), loadWorkoutHistory: async () => ({ data: sessions }) },
  })
  return { render: async () => findDashboard(await load('app/dashboard/program/[program]/workout/page.tsx').default({ params: Promise.resolve({ program: 'ember' }) })),
    block: kind => { if (kind === 'flag') safetyFlags = [{ id: 'synthetic-safety-flag' }];else redFlag = true } }
}

test('actual workout page keeps new legacy sessions and saved work accessible while safety still pauses training', async () => {
  const saved = session(), before = JSON.stringify(saved), fixture = pageFixture(saved)
  const dashboard = await fixture.render()
  assert.equal(dashboard.props.showInteractiveWorkout, true)
  assert.equal(dashboard.props.assignedDayName, saved.day_name)
  assert.equal(dashboard.props.assignedWorkoutId, saved.id)
  assert.equal(dashboard.props.assignedExercises, saved.planned_exercises)
  assert.equal(dashboard.props.loadGuidanceExercises[0].load_guidance_status, 'unverified')
  assert.equal(dashboard.props.loadGuidanceExercises[0].recommended_weight, saved.planned_exercises[0].recommended_weight)
  assert.match(dashboard.props.workoutStateLabel, /original prescription retained/)
  assert.equal(JSON.stringify(saved), before)
  const localRecovery = await pageFixture(null).render()
  assert.equal(localRecovery.props.showInteractiveWorkout, true, 'Legacy exercise identity and dose remain accessible for new actual logs or matching drafts')
  assert.equal(localRecovery.props.calculationResumeOnly, undefined)
  assert.equal(localRecovery.props.loadGuidanceExercises, localRecovery.props.assignedExercises, 'Presentation sidecar uses the rendered assigned order')
  assert.equal(localRecovery.props.loadGuidanceExercises[0].load_guidance_status, 'unverified')
  for (const kind of ['flag', 'redFlag']) {
    const blocked = pageFixture(saved);blocked.block(kind)
    assert.equal((await blocked.render()).props.showInteractiveWorkout, false)
  }
})
