import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const owner = '11111111-1111-4111-8111-111111111111'
const foreign = '22222222-2222-4222-8222-222222222222'
const operation = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const clone = value => JSON.parse(JSON.stringify(value))
const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const custom = () => ({ mode: 'custom', days: Object.fromEntries(weekdays.map(day => [day,
  day === 'Monday' ? ['lats'] : day === 'Tuesday' ? ['chest', 'biceps'] : []])) })
const saved = (choice, effectiveDate = '2026-11-09', id = operation) => ({ choice, effectiveDate, savedAt: '2026-11-03T12:00:00Z', operationId: id })
const preference = (choice = custom(), current = null) => ({ weekdayMusclePreferences: {
  version: 1, revision: 1, current, pending: saved(choice),
  lastOperation: { id: operation, expectedRevision: 0, requestedDate: '2026-11-03', choice },
} })
const source = () => ({ program: 'ember', integration_fixture: 'synthetic-state-and-ordering-only', days: weekdays.map(day => ({ day_name: day,
  day_intent: ['Monday', 'Tuesday'].includes(day) ? 'training' : 'rest',
  exercises: day === 'Monday' ? [{ exercise: 'Existing chest and biceps prescription', primary_muscles: ['chest', 'biceps'], sets: 3, reps: 8, calculated_weight: 25, unit: 'lb', equipment: 'dumbbell', load_type: 'per_hand' }]
    : day === 'Tuesday' ? [{ exercise: 'Existing back prescription', primary_muscles: ['lats'], sets: 4, reps: 6, calculated_weight: 30, unit: 'kg', equipment: 'cable', load_type: 'external_load' }] : [],
})) })

// Actual projection/state/distribution modules, disposable synthetic data only.
function loader(mocks = {}, globals = {}) {
  const cache = new Map()
  function load(path) {
    path = resolve(path)
    if (cache.has(path)) return cache.get(path).exports
    if (path.endsWith('.json')) return JSON.parse(readFileSync(path, 'utf8'))
    const module = { exports: {} };cache.set(path, module)
    const compiled = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
    } }).outputText
    runInNewContext(compiled, { module, exports: module.exports, Date, Request, Response, URL,
      process: { env: { NODE_ENV: 'test' } }, console: { error() {} }, ...globals,
      require(name) {
        if (Object.hasOwn(mocks, name)) return mocks[name]
        if (name === 'server-only') return {}
        const base = name.startsWith('@/') ? resolve(name.slice(2)) : name.startsWith('.') ? resolve(dirname(path), name) : null
        if (!base) return require(name)
        return load(base.endsWith('.json') || base.endsWith('.ts') ? base : existsSync(base + '.ts') ? base + '.ts' : base + '.tsx')
      },
    }, { filename: path })
    return module.exports
  }
  return load
}
const cycleCalls = []
// This deliberately synthetic two-day week is not a supported saved template.
// Mock only the verified-source adapter for state/cycle/API/assessment isolation;
// production adapter refusal is exercised separately below without this mock.
const syntheticVerifiedAdapter = {
  '@/lib/program/weekdayExerciseMapping': {
    resolveVersionedWeekdayExerciseMappings({ programJson }) {
      assert.equal(programJson.integration_fixture, 'synthetic-state-and-ordering-only')
      return { status: 'compatible', provenance: { templateProgram: 'TEST_ONLY_SYNTHETIC', templateVersion: 'TEST_ONLY', mappingVersion: 'TEST_ONLY' },
        missingWeekdays: [], occurrences: programJson.days.flatMap(day => day.exercises.map((exercise, index) => ({
          day: day.day_name, index, exercise,
          mapping: { kind: 'movable', primaryMuscles: exercise.primary_muscles, basis: 'Explicit test-only adapter fixture; not production provenance' },
        }))) }
    },
  },
}
const { getProgramWorkout, projectWeekdayProgram } = loader({
  ...syntheticVerifiedAdapter,
  '@/lib/cycle/getCycleTrainingAdjustment': {
    getCycleTrainingAdjustment: () => ({ unchangedCycleAdjustment: true }),
    applyCycleTrainingAdjustment: ({ exercise, adjustment }) => { cycleCalls.push({ exercise, adjustment });return { ...exercise, cycle_applied: true } },
  },
})('lib/program/getProgramWorkout.ts')
const get = (onboarding_data, now, output = { program: 'ember', program_json: source() }, timezone = 'Etc/UTC') =>
  getProgramWorkout({ client: { program: 'ember', timezone, onboarding_data }, output, now: new Date(now) })

test('synthetic-only unset preserves saved week, weekday selection and existing cycle order without mutating prescriptions', () => {
  const output = { program: 'ember', program_json: source() }, before = clone(output)
  const result = get(undefined, '2026-11-03T12:00:00Z', output)
  assert.equal(result.programJson, output.program_json)
  assert.equal(result.weekdayPreferenceNotice, null)
  assert.equal(result.todaysWorkout.day_name, 'Tuesday')
  assert.equal(result.todaysWorkout.exercises[0], output.program_json.days[1].exercises[0])
  assert.equal(result.adjustedExercises[0].cycle_applied, true)
  assert.deepEqual(output, before)
})

test('synthetic-only pending preference activates at the saved local Monday, never the preceding UTC date or caller-selected day', () => {
  const pending = get(preference(), '2026-11-09T04:30:00Z', undefined, 'America/New_York')
  assert.equal(pending.todaysWorkout.day_name, 'Sunday')
  assert.equal(pending.programJson.days[0].exercises[0].exercise, 'Existing chest and biceps prescription')
  assert.match(pending.weekdayPreferenceNotice, /preferred weekday focus is saved to begin on 2026-11-09/)
  const active = get(preference(), '2026-11-09T05:00:00Z', undefined, 'America/New_York')
  assert.equal(active.todaysWorkout.exercises[0].exercise, 'Existing back prescription')
  assert.match(active.weekdayPreferenceNotice, /preferred weekday focus is in effect from 2026-11-09/)
  assert.match(active.weekdayPreferenceNotice, /Prescribed workdays: Monday, Tuesday\./)
})

test('synthetic-only active custom projection preserves weekly dose and chest plus biceps, before existing cycle handling', () => {
  const output = { program: 'ember', program_json: source() }, before = clone(output)
  cycleCalls.length = 0
  const result = get(preference(), '2026-11-10T12:00:00Z', output)
  assert.equal(result.todaysWorkout.focus, 'Chest + Biceps')
  assert.match(result.weekdayPreferenceNotice, /preferred weekday focus.*Prescribed workdays: Monday, Tuesday\./)
  assert.equal(result.todaysWorkout.exercises[0], output.program_json.days[0].exercises[0])
  assert.equal(cycleCalls.length, 1)
  assert.equal(cycleCalls[0].exercise, output.program_json.days[0].exercises[0])
  assert.equal(cycleCalls[0].adjustment, result.cycleAdjustment)
  assert.deepEqual(clone(result.programJson.days.flatMap(day => day.exercises)).sort((a, b) => a.exercise.localeCompare(b.exercise)),
    before.program_json.days.flatMap(day => day.exercises).sort((a, b) => a.exercise.localeCompare(b.exercise)))
  assert.deepEqual(output, before)
})

test('synthetic-only pending reset keeps current custom week until effective date then restores explicit program default', () => {
  const current = saved(custom(), '2026-11-02', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
  const state = preference({ mode: 'program_default' }, current)
  const before = get(state, '2026-11-03T12:00:00Z')
  assert.equal(before.todaysWorkout.exercises[0].exercise, 'Existing chest and biceps prescription')
  assert.match(before.weekdayPreferenceNotice, /preferred weekday focus is in effect from 2026-11-02\. Prescribed workdays: Monday, Tuesday\./)
  assert.match(before.weekdayPreferenceNotice, /Program-default weekdays are saved to begin on 2026-11-09/)
  const after = get(state, '2026-11-09T12:00:00Z')
  assert.equal(after.todaysWorkout.exercises[0].exercise, 'Existing chest and biceps prescription')
  assert.match(after.weekdayPreferenceNotice, /Program-default weekdays are in effect/)
})

test('synthetic-only unsupported or malformed active preferences retain original plan with honest notice', () => {
  const plan = source();delete plan.days[0].exercises[0].primary_muscles
  const output = { program: 'ember', program_json: plan }, before = clone(output)
  const result = get(preference(), '2026-11-09T12:00:00Z', output)
  assert.equal(result.programJson, plan)
  assert.match(result.weekdayPreferenceNotice, /cannot be applied.*no verified primary-muscle mapping/)
  assert.match(result.weekdayPreferenceNotice, /Your existing prescribed plan has been kept\.$/)
  assert.deepEqual(output, before)
  const invalid = projectWeekdayProgram({ client: { timezone: 'Etc/UTC', onboarding_data: { weekdayMusclePreferences: {} } }, output, now: new Date('2026-11-09T12:00:00Z') })
  assert.equal(invalid.programJson, plan)
  assert.match(invalid.weekdayPreferenceNotice, /unavailable.*plan has been kept/)
})

function apiFixture() {
  const state = { user: { id: owner }, client: { client_id: 'OWNED', auth_user_id: owner, program: 'ember', access: true, active: true, timezone: 'Etc/UTC', onboarding_data: preference() },
    outputs: [{ client_id: 'OWNED', auth_user_id: null, program: 'ember', generated_at: '2026-11-01T12:00:00Z', program_json: source() }],
    queries: [], instant: '2026-11-09T12:00:00Z', errorTable: null }
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [state.instant])) }static now() { return Date.parse(state.instant) } }
  const db = { auth: { getUser: async () => ({ data: { user: state.user }, error: null }) }, from(table) {
    const filters = [], disjunctions = [], orders = [];let count
    const query = { select() { return query }, eq(key, value) { filters.push([key, value]);return query }, or(value) { disjunctions.push(value);return query },
      order(key, options) { orders.push([key, options.ascending]);return query }, limit(value) { count = value;return query },
      insert() { assert.fail('Preference projection must not write') }, update() { assert.fail('Preference projection must not write') }, delete() { assert.fail('Preference projection must not delete') },
      async maybeSingle() {
        state.queries.push({ table, filters: clone(filters), disjunctions: clone(disjunctions) })
        if (state.errorTable === table) return { data: null, error: { message: 'Synthetic read error' } }
        let rows = (table === 'clients' ? [state.client] : state.outputs).filter(row => filters.every(([key, value]) => row[key] === value) && disjunctions.every(value => {
          assert.equal(value, `auth_user_id.eq.${owner},auth_user_id.is.null`)
          return row.auth_user_id === owner || row.auth_user_id === null
        }))
        for (const [key, ascending] of orders) rows = rows.slice().sort((a, b) => String(a[key]).localeCompare(String(b[key])) * (ascending ? 1 : -1))
        return { data: (count ? rows.slice(0, count) : rows)[0] || null, error: null }
      },
    };return query
  } }
  const { POST } = loader({ ...syntheticVerifiedAdapter, 'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } }, '@/lib/supabase/server': { createClient: async () => db } }, { Date: Clock })('app/api/program/workout/route.ts')
  return { state, post: body => POST(new Request('https://synthetic.invalid/api/program/workout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })) }
}

test('synthetic-only workout API owner and capability gates precede saved output reads and projection', async () => {
  const app = apiFixture()
  app.state.user = null;assert.equal((await app.post({ client_id: 'OWNED' })).status, 401)
  app.state.user = { id: foreign };assert.equal((await app.post({ client_id: 'OWNED' })).status, 404)
  app.state.user = { id: owner };assert.equal((await app.post({ client_id: 'OTHER' })).status, 404)
  app.state.client.program = 'tracker';assert.equal((await app.post({ client_id: 'OWNED', program: 'phoenix' })).status, 403)
  assert.ok(app.state.queries.every(query => query.table === 'clients'))
})

test('synthetic-only workout API projects newest owned matching tier including legacy NULL; foreign or other-tier output never wins', async () => {
  const app = apiFixture(), original = clone(app.state.outputs)
  app.state.outputs.push({ ...clone(app.state.outputs[0]), auth_user_id: foreign, generated_at: '2026-11-09T13:00:00Z', program_json: { days: [{ day_name: 'Monday', exercises: [{ exercise: 'Foreign' }] }] } },
    { ...clone(app.state.outputs[0]), auth_user_id: owner, program: 'phoenix', generated_at: '2026-11-09T14:00:00Z' })
  const response = await app.post({ client_id: 'OWNED', day_name: 'Monday' }), result = await response.json()
  assert.equal(response.status, 200)
  assert.equal(result.exercises[0].exercise, 'Existing back prescription')
  assert.match(result.weekdayPreferenceNotice, /preferred weekday focus is in effect from 2026-11-09\. Prescribed workdays: Monday, Tuesday\./)
  assert.deepEqual(app.state.outputs[0], original[0])
  const read = app.state.queries.find(query => query.table === 'program_outputs')
  assert.deepEqual(read.filters, [['client_id', 'OWNED'], ['program', 'ember']])
  assert.deepEqual(read.disjunctions, [`auth_user_id.eq.${owner},auth_user_id.is.null`])
  app.state.outputs = [{ ...original[0], program_json: undefined, output: original[0].program_json }]
  assert.equal((await app.post({ client_id: 'OWNED', dayName: 'Monday' })).status, 200)
})

test('synthetic-only workout API retains pending week despite caller date and exposes read failures without generated or saved writes', async () => {
  const app = apiFixture();app.state.instant = '2026-11-03T12:00:00Z'
  const response = await app.post({ client_id: 'OWNED', dayName: 'Monday', date: '2026-11-09', now: '2026-11-09T12:00:00Z' }), result = await response.json()
  assert.equal(response.status, 200)
  assert.equal(result.exercises[0].exercise, 'Existing chest and biceps prescription')
  assert.match(result.weekdayPreferenceNotice, /saved to begin on 2026-11-09/)
  app.state.errorTable = 'program_outputs'
  assert.equal((await app.post({ client_id: 'OWNED' })).status, 500)
  app.state.errorTable = null;app.state.outputs = []
  assert.equal((await app.post({ client_id: 'OWNED' })).status, 404)
})

test('synthetic-only activated weekday rest preserves scheduled strength assessment, accepted move and skip while genuine safety pause suppresses active training', () => {
  const actual = loader()
  const { projectStrengthWorkout } = actual('lib/assessment/strengthWorkout.ts')
  const { isStrengthWorkout, strengthTrainingPaused } = actual('lib/assessment/strengthWorkoutState.ts')
  const choice = custom();choice.days.Monday = [];choice.days.Tuesday = ['lats'];choice.days.Wednesday = ['chest', 'biceps']
  const date = '2026-11-09', now = new Date(`${date}T12:00:00Z`)
  const client = { client_id: 'OWNED', auth_user_id: owner, program: 'ember', timezone: 'Etc/UTC', onboarding_data: preference(choice) }
  const projected = getProgramWorkout({ client, output: { program: 'ember', program_json: source() }, now })
  assert.equal(projected.todaysWorkout.day_intent, 'rest')
  assert.equal(projected.todaysWorkout.exercises.length, 0)
  const status = { state: 'due', unavailable: false, eligibleDate: date, scheduledDate: date,
    latestCompletedAt: '2026-08-09T12:00:00Z', completedToday: false,
    href: '/dashboard/assessment/start2?period=2026-11-01', workoutHref: '/dashboard/assessment/start2?period=2026-11-01' }
  const logic = { symptoms: { redFlag: false }, recoveryStatus: { status: 'normal_training_day' },
    workoutDecision: { canTrain: false, assignedWorkout: { workout_state: projected.todaysWorkout.day_intent }, adjustmentLevel: 'level_0_full_plan' } }
  assert.equal(isStrengthWorkout(status, date), true)
  assert.equal(strengthTrainingPaused(logic), false, 'A safe custom rest weekday must not displace its separately scheduled assessment')
  const savedSlot = { id: 'existing-monday-workout', user_id: owner, client_id: client.client_id, event_type: 'workout', source: 'program',
    start_at: `${date}T14:00:00Z`, end_at: `${date}T14:30:00Z`, timezone: 'Etc/UTC', all_day: false,
    status: 'scheduled', flexibility_type: 'flexible', movable: true, approval_required: false, suggested: false }
  const original = clone({ client, savedSlot, status })
  const project = () => projectStrengthWorkout({ status, userId: owner, client, date, events: [savedSlot], now })
  assert.equal(project()[0].title, 'Strength assessment')
  assert.equal(project()[0].id, savedSlot.id)
  client.onboarding_data.scheduleOverrides = { [savedSlot.id]: { status: 'scheduled', suggested: false,
    adjusted_start_at: `${date}T19:00:00Z`, adjusted_end_at: `${date}T19:30:00Z` } }
  const moved = project()[0]
  assert.equal(moved.adjusted_start_at, `${date}T19:00:00.000Z`)
  assert.equal(moved.suggested, false);assert.equal(moved.busy, true)
  client.onboarding_data.scheduleOverrides[savedSlot.id] = { status: 'skipped' }
  assert.equal(project()[0].status, 'skipped')
  for (const restriction of ['redFlag', 'recoveryOnly', 'safetyFlags']) {
    const paused = clone(logic)
    if (restriction === 'redFlag') paused.symptoms.redFlag = true
    if (restriction === 'recoveryOnly') paused.recoveryStatus.status = 'full_recovery_or_red_flag'
    assert.equal(strengthTrainingPaused(paused, restriction === 'safetyFlags'), true, restriction)
    assert.equal(isStrengthWorkout(status, date) && !strengthTrainingPaused(paused, restriction === 'safetyFlags'), false)
    assert.equal(status.scheduledDate, date, 'Pausing presentation retains the due date and history access')
  }
  assert.deepEqual(savedSlot, original.savedSlot)
  assert.deepEqual(status, original.status)
})

test('actual resolver refuses unknown, versionless and modified saved prescriptions despite explicit primary-muscle metadata', () => {
  // No verified-adapter or distribution mock in this loader. Synthetic inputs
  // exercise the production resolver and current-week retention path directly.
  const actual = loader()
  const { resolveVersionedWeekdayExerciseMappings } = actual('lib/program/weekdayExerciseMapping.ts')
  const { projectWeekdayProgram: actualProject } = actual('lib/program/getProgramWorkout.ts')
  const { generateProgram } = actual('lib/program/generateProgram.ts')
  const unknown = source();delete unknown.integration_fixture
  unknown.template_program = 'unregistered-template';unknown.template_version = 'v1'
  const versionless = source();delete versionless.integration_fixture
  versionless.template_program = 'ember'
  const modified = generateProgram({ client: { program: 'ember', equipment_access: ['commercial gym'] } })
  const firstExercise = modified.days.find(day => day.exercises.length).exercises[0]
  firstExercise.sets += 1
  firstExercise.primary_muscles = ['chest']
  const expectedRefusal = { unknown: 'unsupported_template_version', versionless: 'unverified_template_provenance', modified: 'template_prescription_mismatch' }
  for (const [label, programJson] of Object.entries({ unknown, versionless, modified })) {
    const before = clone(programJson)
    const resolved = resolveVersionedWeekdayExerciseMappings({ programJson, outputProgram: 'ember' })
    assert.equal(resolved.status, 'unsupported', `${label} source must not be authorized by explicit primary arrays`)
    assert.equal(resolved.issues[0].code, expectedRefusal[label])
    const result = actualProject({ client: { client_id: 'OWNED', program: 'ember', timezone: 'Etc/UTC', onboarding_data: preference() },
      output: { program: 'ember', program_json: programJson }, now: new Date('2026-11-09T12:00:00Z') })
    assert.equal(result.programJson, programJson, `${label} current week keeps its existing saved program`)
    assert.match(result.weekdayPreferenceNotice, /cannot be applied/)
    assert.match(result.weekdayPreferenceNotice, /Your existing prescribed plan has been kept\.$/)
    assert.deepEqual(clone(programJson), before)
  }
})

test('actual six-day generated plan applies preferred focus next Monday without mutating saved sessions or inventing Sunday rest', () => {
  // No verified-source, distribution, cycle or getter mocks: this is a pure
  // generator fixture, not a persisted plan or a hosted member-data test.
  const actual = loader()
  const { generateProgram } = actual('lib/program/generateProgram.ts')
  const { resolveVersionedWeekdayExerciseMappings } = actual('lib/program/weekdayExerciseMapping.ts')
  const { getProgramWorkout: actualWorkout } = actual('lib/program/getProgramWorkout.ts')
  const { getWorkoutForToday } = actual('lib/workout/getWorkoutForToday.ts')
  const client = { client_id: 'OWNED', auth_user_id: owner, program: 'ember', timezone: 'America/New_York',
    equipment_access: ['commercial gym'], onboarding_data: preference() }
  const output = { client_id: client.client_id, auth_user_id: owner, program: 'ember', program_json: generateProgram({ client,
    strengthAssessment: { bench_press_weight: '45', bench_press_reps: '8', squat_weight: '65', squat_reps: '8' } }) }
  const verified = resolveVersionedWeekdayExerciseMappings({ programJson: output.program_json, outputProgram: output.program })
  assert.equal(verified.status, 'compatible')
  assert.equal(verified.provenance.templateProgram, 'ember')
  assert.equal(verified.provenance.templateVersion, 'v1')
  assert.deepEqual(clone(verified.missingWeekdays), ['Sunday'])
  const sourceMonday = output.program_json.days.find(day => day.day_name === 'Monday')
  const sourceTuesday = output.program_json.days.find(day => day.day_name === 'Tuesday')
  const prescribedSets = sourceMonday.exercises.reduce((total, exercise) => total + Number(exercise.sets), 0)
  const savedHistory = [{ log_date: '2026-11-02', planned_exercises: sourceMonday.exercises, planned_sets: prescribedSets,
    exercise_logs: [{ exercise: 'Bench Press', set_logs: [{ set_number: 1, reps: 8, weight: 45, unit: 'lb', completed_at: '2026-11-02T15:00:00Z' }] }] }]
  const currentSession = { date: '2026-11-03', session_id: 'synthetic-current-session', planned_exercises: sourceTuesday.exercises,
    original_planned_sets: sourceTuesday.exercises.reduce((total, exercise) => total + Number(exercise.sets), 0), completed_sets: 1 }
  const activeDraft = { date: '2026-11-03', exercise: sourceTuesday.exercises[0], reps: '8', weight: '65', unit: 'lb' }
  const before = JSON.stringify({ client, output, savedHistory, currentSession, activeDraft })
  const current = actualWorkout({ client, output, now: new Date('2026-11-04T15:00:00Z') })
  assert.equal(current.programJson, output.program_json)
  assert.match(current.weekdayPreferenceNotice, /preferred weekday focus is saved to begin on 2026-11-09/)
  const sundayBefore = actualWorkout({ client, output, now: new Date('2026-11-09T04:30:00Z') })
  assert.equal(sundayBefore.programJson, output.program_json, 'Sunday local time cannot activate Monday focus early')
  assert.equal(sundayBefore.todaysWorkout, undefined)

  const active = actualWorkout({ client, output, now: new Date('2026-11-09T05:00:00Z') })
  assert.notEqual(active.programJson, output.program_json)
  const monday = active.programJson.days.find(day => day.day_name === 'Monday')
  const tuesday = active.programJson.days.find(day => day.day_name === 'Tuesday')
  const thursday = active.programJson.days.find(day => day.day_name === 'Thursday')
  assert.ok(monday.exercises.some(exercise => exercise.exercise === 'Lat Pulldown'))
  assert.ok(!thursday.exercises.some(exercise => exercise.exercise === 'Lat Pulldown'))
  for (const name of ['Bench Press', 'Incline Press', 'Low Cable Fly', 'Dumbbell Bicep Curl']) {
    assert.ok(tuesday.exercises.some(exercise => exercise.exercise === name), `${name} moves to the selected chest plus biceps day`)
  }
  assert.ok(!monday.exercises.some(exercise => exercise.exercise === 'Bench Press'))
  assert.ok(monday.exercises.some(exercise => exercise.exercise === 'Shoulder Press'), 'Unselected clear work stays on its saved day')
  const originalExercises = output.program_json.days.flatMap(day => day.exercises)
  const projectedExercises = active.programJson.days.flatMap(day => day.exercises)
  assert.equal(projectedExercises.length, originalExercises.length)
  for (const exercise of originalExercises) assert.equal(projectedExercises.filter(item => item === exercise).length, 1)
  assert.equal(projectedExercises.reduce((total, exercise) => total + Number(exercise.sets), 0),
    originalExercises.reduce((total, exercise) => total + Number(exercise.sets), 0))
  for (const day of output.program_json.days) {
    const fixed = verified.occurrences.filter(occurrence => occurrence.day === day.day_name && occurrence.mapping.kind === 'pinned').map(occurrence => occurrence.exercise)
    const projected = active.programJson.days.find(candidate => candidate.day_name === day.day_name)
    const retained = projected.exercises.filter(exercise => fixed.includes(exercise))
    assert.equal(retained.length, fixed.length)
    retained.forEach((exercise, index) => assert.equal(exercise, fixed[index], 'Mixed and unclear work retains its exact source day and relative sequence'))
  }
  const workdays = active.programJson.days.filter(day => day.exercises.length).map(day => day.day_name)
  assert.deepEqual(clone(workdays), ['Monday', 'Tuesday', 'Thursday', 'Friday'])
  assert.equal(workdays.length, output.program_json.days.filter(day => day.exercises.length).length)
  assert.match(active.weekdayPreferenceNotice, /preferred weekday focus is in effect from 2026-11-09/)
  assert.match(active.weekdayPreferenceNotice, /Prescribed workdays: Monday, Tuesday, Thursday, Friday\./)
  assert.match(active.weekdayPreferenceNotice, /Sunday is unspecified in the saved source, not confirmed rest\./)
  assert.equal(active.programJson.days.some(day => day.day_name === 'Sunday'), false)
  const sundayAfter = actualWorkout({ client, output, now: new Date('2026-11-15T17:00:00Z') })
  assert.equal(sundayAfter.todaysWorkout, undefined)
  assert.equal(sundayAfter.adjustedExercises.length, 0)
  const sundayState = getWorkoutForToday({ inputs: { client }, plannedWorkout: sundayAfter.todaysWorkout,
    assignedExercises: sundayAfter.adjustedExercises, capacityStatus: 'high_capacity',
    fuelReadiness: { status: 'well_fueled' }, recoveryStatus: 'normal_training_day' })
  assert.equal(sundayState.type, 'unavailable')
  assert.equal(sundayState.completionEligible, false)
  assert.equal(JSON.stringify({ client, output, savedHistory, currentSession, activeDraft }), before)
  assert.equal(savedHistory[0].planned_exercises, sourceMonday.exercises)
  assert.equal(currentSession.planned_exercises, sourceTuesday.exercises)
  assert.equal(activeDraft.exercise, sourceTuesday.exercises[0])
})
