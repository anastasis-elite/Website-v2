import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

// Exercise the tracker controls with the actual calculation, projection and
// resume modules. Only browser storage, hooks and HTTP persistence are disposable.
const nativeRequire = createRequire(import.meta.url)
const clone = value => JSON.parse(JSON.stringify(value))
let now = Date.parse('2026-11-05T16:00:00Z'), hooks
class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])) } static now() { return now } }
function loader() {
  const cache = new Map()
  function load(path) {
    path = resolve(path)
    if (cache.has(path)) return cache.get(path).exports
    if (path.endsWith('.json')) return JSON.parse(readFileSync(path, 'utf8'))
    const module = { exports: {} }; cache.set(path, module)
    const compiled = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText
    runInNewContext(compiled, { module, exports: module.exports, Date: Clock, Intl, URL, console,
      get localStorage() { return globalThis.localStorage },
      get window() { return globalThis.window },
      fetch: (...args) => globalThis.fetch(...args), require(name) {
        if (name === 'server-only') return {}
        if (name === 'react') return Object.fromEntries(['useState', 'useEffect', 'useRef', 'useMemo'].map(name => [name, (...args) => hooks[name](...args)]))
        if (name === 'next/navigation') return { useRouter: () => ({ refresh() {} }) }
        if (name === 'next/link') return { __esModule: true, default: 'a' }
        if (name.endsWith('.css')) return {}
        const base = name.startsWith('@/') ? resolve(name.slice(2)) : name.startsWith('.') ? resolve(dirname(path), name) : null
        if (!base) return nativeRequire(name)
        return load(/\.(?:json|tsx?)$/.test(base) ? base : existsSync(base + '.ts') ? base + '.ts' : base + '.tsx')
      },
    }, { filename: path })
    return module.exports
  }
  return load
}
const load = loader()
const ActivityTracker = load('components/ActivityWorkoutTracker.tsx').default
const { generateProgram } = load('lib/program/generateProgram.ts')
const { applyCycleTrainingAdjustment, getCycleTrainingAdjustment } = load('lib/cycle/getCycleTrainingAdjustment.ts')
const { runWorkoutDecisionEngine } = load('lib/dashboard/logic/engines.ts')
const { projectSavedExercisePrescription } = load('lib/program/savedPrescription.ts')
const { activityDose } = load('lib/workout/activity.ts')
const { initialWorkoutLogs, workoutSessionKeys } = load('lib/workout/session.ts')
const { hasVerifiedSavedPrescription } = load('lib/workout/issuedPrescription.ts')
const { getClientLocalDate } = load('lib/timezone.ts')
const client = { client_id: 'SYNTHETIC-ISSUED', auth_user_id: 'synthetic-owner', program: 'ember', current_weight: 180,
  timezone: 'Etc/UTC', equipment_access: ['full gym'], primary_goal: 'general_capacity' }
const strength = weight => Object.fromEntries(['bench_press', 'shoulder_press', 'squat', 'romanian_deadlift', 'seated_row', 'bicep_curl', 'lateral_raise', 'close_grip_press']
  .flatMap(key => [[`${key}_weight`, weight], [`${key}_reps`, 10]]))
function issuedPlan({ weight = 100, cycle = true, repeated = false } = {}) {
  const member = { ...client, cycle_tracking_enabled: cycle, last_period_start: new Clock(now - 86400000).toISOString().slice(0, 10), average_cycle_length: 28 }
  const generated = generateProgram({ client: member, initialAssessment: {}, strengthAssessment: strength(weight) })
  const all = generated.days.flatMap(day => day.exercises)
  const source = ['Seated Cable Row', 'Cable Kickback', ...(repeated ? ['Cable Kickback'] : [])].map(name => all.find(exercise => exercise.exercise === name))
  assert.ok(source.every(Boolean), 'the actual Ember template supplies both regression movements')
  const cycleAdjustment = getCycleTrainingAdjustment(member)
  const exercises = source.map(exercise => applyCycleTrainingAdjustment({ exercise, adjustment: cycleAdjustment }))
  const inputs = { date: getClientLocalDate(member, new Clock()), userId: member.auth_user_id, client: member, program: member.program,
    initialAssessment: { data: {} }, strengthAssessments: [{ data: strength(weight) }], todayRecovery: { time_available_minutes: 45, soreness_level: 1 },
    todayWorkoutFeedback: null, photoRecord: null, plannedExercises: exercises,
    plannedWorkout: { day_name: 'Saved session regression', day_intent: 'training', exercises }, cycleAdjustment,
    nutritionLogs: [], nutritionTotals: [], workoutHistory: [], executionHistory: [], missedDayCount: 0 }
  return clone(runWorkoutDecisionEngine(inputs, { status: 'high_capacity' }, { status: 'normal_training_day' },
    { status: 'well_fueled' }, { status: 'ready', percent: 100 }, { redFlag: false, severity: 'low' },
    { correctivePriorities: [], substitutions: [] }).assignedWorkout.exercises)
}
const propsFor = exercises => ({ clientId: client.client_id, authUserId: client.auth_user_id, program: client.program,
  dayName: 'Saved session regression', exercises, loadGuidanceExercises: exercises.map(exercise => projectSavedExercisePrescription(exercise, 'ember')),
  timezone: client.timezone, weightUnit: 'lb' })
function mount(props, server = { session: null }, storage = new Map()) {
  const slots = []; let cursor = 0, effects = [], tree
  const calls = []
  const localStorage = { get length() { return storage.size }, key: index => [...storage.keys()][index] || null,
    getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) }
  const localHooks = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next }] },
    useRef(initial) { const i = cursor++; return slots[i] ||= { current: initial } },
    useMemo(fn) { cursor++; return fn() },
    useEffect(fn, deps) { const i = cursor++; if (!slots[i] || deps?.some((value, n) => value !== slots[i][n])) { slots[i] = deps; effects.push(fn) } },
  }
  function activate() {
    hooks = localHooks
    globalThis.localStorage = localStorage; globalThis.window = { localStorage }
    globalThis.fetch = async (url, options) => {
      const payload = options?.body ? JSON.parse(options.body) : null; calls.push({ url, payload })
      if (payload) {
        const retainedPlan = server.session?.planned_exercises || payload.planned_exercises
        server.session = { id: 'synthetic-session', planned_exercises: clone(retainedPlan), exercise_logs: clone(payload.exercise_logs),
          completed: payload.completed, updated_at: new Clock(++now).toISOString() }
        server.date = getClientLocalDate(client, new Clock())
      }
      const session = server.date && server.date !== getClientLocalDate(client, new Clock()) ? null : server.session
      return Response.json({ success: true, session: clone(session) })
    }
  }
  function render() { activate(); cursor = 0; tree = ActivityTracker(props); for (const effect of effects.splice(0)) effect(); return tree }
  const flush = async () => { await new Promise(setImmediate); render(); await new Promise(setImmediate); render() }
  render()
  return { render, flush, calls, storage, get tree() { return tree } }
}
function nodes(tree, predicate) {
  const result = []
  function visit(node) { if (Array.isArray(node)) return node.forEach(visit); if (!node || typeof node !== 'object') return
    if (predicate(node)) result.push(node); visit(node.props?.children) }
  visit(tree); return result
}
const content = node => Array.isArray(node) ? node.map(content).join('') : node && typeof node === 'object' ? content(node.props?.children) : node == null ? '' : String(node)
const button = (tree, label) => nodes(tree, node => node.type === 'button' && content(node) === label)[0]
const inputWeights = tree => nodes(tree, node => node.type === 'label' && content(node).startsWith('Weight (')).map(label => nodes(label, node => node.type === 'input')[0])
const inputAmounts = tree => nodes(tree, node => node.type === 'label' && content(node).startsWith('Repetitions completed')).map(label => nodes(label, node => node.type === 'input')[0])
const slides = tree => nodes(tree, node => node.type === 'article' && node.props?.['aria-roledescription'] === 'slide')
const edit = (app, input, value) => { input.props.onChange({ target: { value: String(value) } }); app.render() }
const save = async app => { button(app.tree, 'Save / pause').props.onClick(); await app.flush() }

test('partial workout repeatedly restores the exact issued untouched Cable Kickback despite changed current guidance', async () => {
  now = Date.parse('2026-11-05T16:00:00Z')
  const plan = issuedPlan(), server = { session: null }, p = propsFor(plan)
  assert.ok(plan[1].issued_prescription)
  assert.notEqual(plan[1].recommended_weight, plan[1].prescription_calculation.equipment_weight, 'cycle, safety and equipment rounding change the raw load')
  const issuedWeight = activityDose(plan[1]).weight
  let app = mount(p, server); await app.flush()
  assert.equal(inputWeights(app.tree)[1].props.value, issuedWeight)
  button(slides(app.tree)[0], 'Complete set 1').props.onClick(); app.render(); await save(app)
  const originalPlan = clone(server.session.planned_exercises), originalSets = clone(server.session.exercise_logs[0].set_logs)
  assert.equal(server.session.exercise_logs[1].set_logs.length, 0)
  assert.equal(server.session.exercise_logs[1].input_draft, undefined, 'an untouched default remains a suggestion, never an entered actual')
  const changed = issuedPlan({ weight: 350, cycle: false })
  assert.notEqual(changed[1].recommended_weight, issuedWeight)
  for (let attempt = 0; attempt < 3; attempt++) {
    // Reopen with no browser draft: only the persisted server session survives.
    app = mount(propsFor(changed), server); await app.flush()
    assert.equal(inputWeights(app.tree)[1].props.value, issuedWeight)
    assert.match(content(slides(app.tree)[1]), /0\/3 sets/)
    assert.doesNotMatch(content(slides(app.tree)[1]), /Load recommendation unavailable|cannot be verified/)
    await save(app)
    assert.deepEqual(server.session.planned_exercises, originalPlan)
    assert.deepEqual(server.session.exercise_logs[0].set_logs, originalSets)
    assert.equal(server.session.exercise_logs[1].session_key, originalPlan[1].session_key)
    assert.equal(server.session.exercise_logs[1].set_logs.length, 0)
  }
})

test('a browser-only partial session converts untouched suggestions when preferred units change', async () => {
  now = Date.parse('2026-11-05T16:00:00Z')
  const plan = issuedPlan(), server = { session: null }, storage = new Map()
  let app = mount(propsFor(plan), server, storage); await app.flush()
  assert.equal(inputWeights(app.tree)[1].props.value, 55)
  button(slides(app.tree)[0], 'Complete set 1').props.onClick(); app.render(); await app.flush()
  const retained = JSON.parse([...storage.values()][0]), recorded = clone(retained.logs[0].set_logs)
  assert.equal(retained.dirty, true)
  assert.equal(retained.draft[1].weight, 55); assert.equal(retained.draft[1].weightEdited, false)
  assert.equal(recorded[0].weight_unit, 'lb')
  assert.equal(server.session, null)
  assert.equal(app.calls.some(call => call.payload), false)
  app = mount({ ...propsFor(issuedPlan({ weight: 350, cycle: false })), weightUnit: 'kg' }, server, storage); await app.flush()
  assert.equal(inputWeights(app.tree)[1].props.value, Math.round(55 / 2.2046226218 * 10) / 10)
  assert.notEqual(inputWeights(app.tree)[1].props.value, 55, 'a retained lb default is not a typed kg actual')
  assert.match(content(slides(app.tree)[1]), /0\/3 sets/)
  assert.equal(server.session, null)
  await save(app)
  assert.deepEqual(server.session.exercise_logs[0].set_logs, recorded)
  assert.equal(server.session.exercise_logs[1].input_draft, undefined)
  assert.equal(server.session.planned_exercises[1].recommended_weight, 55)
})

test('a valid newer untouched log cannot replace the frozen originally issued plan suggestion', async () => {
  now = Date.parse('2026-11-05T16:00:00Z')
  const plan = issuedPlan(), server = { session: null }
  let app = mount(propsFor(plan), server); await app.flush()
  button(slides(app.tree)[0], 'Complete set 1').props.onClick(); app.render(); await save(app)
  const frozenPlan = clone(server.session.planned_exercises), recorded = clone(server.session.exercise_logs[0].set_logs)
  const changed = issuedPlan({ weight: 350, cycle: false })
  server.session.exercise_logs[1] = clone(initialWorkoutLogs(changed)[1])
  server.session.updated_at = new Clock(++now).toISOString()
  assert.equal(server.session.exercise_logs[1].session_key, frozenPlan[1].session_key)
  assert.equal(server.session.exercise_logs[1].recommended_weight, 255)
  assert.equal(hasVerifiedSavedPrescription(server.session.exercise_logs[1], 'ember'), true, 'the replacement is calculationally valid but belongs to newer guidance')
  app = mount(propsFor(changed), server); await app.flush()
  assert.equal(inputWeights(app.tree)[1].props.value, 55)
  assert.match(content(slides(app.tree)[1]), /0\/3 sets/)
  await save(app)
  assert.deepEqual(server.session.planned_exercises, frozenPlan)
  assert.deepEqual(server.session.exercise_logs[0].set_logs, recorded)
  assert.equal(server.session.exercise_logs[1].recommended_weight, 55)
  assert.deepEqual(server.session.exercise_logs[1].issued_prescription, frozenPlan[1].issued_prescription)
})

test('edited unconfirmed inputs and cleared weight survive server-only pause/reopen without confirming any work', async () => {
  now = Date.parse('2026-11-05T16:00:00Z')
  const plan = issuedPlan(), server = { session: null }
  let app = mount(propsFor(plan), server); await app.flush()
  edit(app, inputWeights(app.tree)[1], 17.5); edit(app, inputAmounts(app.tree)[1], 7); await save(app)
  const saved = server.session.exercise_logs[1]
  assert.equal(saved.input_draft.version, 1); assert.equal(saved.input_draft.session_key, saved.session_key)
  assert.equal(saved.input_draft.weightEdited, true); assert.equal(saved.input_draft.weight, 17.5)
  assert.equal(saved.input_draft.amountEdited, true); assert.equal(saved.input_draft.amount, 7)
  assert.equal(saved.set_logs.length, 0); assert.equal(saved.completed, false)
  app = mount(propsFor(issuedPlan({ weight: 350, cycle: false })), server); await app.flush()
  assert.equal(inputWeights(app.tree)[1].props.value, 17.5); assert.equal(inputAmounts(app.tree)[1].props.value, 7)
  edit(app, inputWeights(app.tree)[1], ''); await save(app)
  assert.equal(server.session.exercise_logs[1].input_draft.weight, null, 'clearing an edited field is persisted explicitly')
  app = mount(propsFor(plan), server); await app.flush()
  assert.equal(inputWeights(app.tree)[1].props.value, ''); assert.equal(inputAmounts(app.tree)[1].props.value, 7)
  edit(app, inputAmounts(app.tree)[1], ''); await save(app)
  assert.equal(server.session.exercise_logs[1].input_draft.amount, null)
  app = mount(propsFor(plan), server); await app.flush()
  assert.equal(inputWeights(app.tree)[1].props.value, ''); assert.equal(inputAmounts(app.tree)[1].props.value, '')
  assert.equal(server.session.exercise_logs[1].set_logs.length, 0)
})

test('actual kg sets retain exact recorded values while unconfirmed next-set edits convert across preferred units', async () => {
  now = Date.parse('2026-11-05T16:00:00Z')
  const plan = issuedPlan(), server = { session: null }
  let app = mount({ ...propsFor(plan), weightUnit: 'kg' }, server); await app.flush()
  edit(app, inputWeights(app.tree)[0], 17.5); edit(app, inputAmounts(app.tree)[0], 9)
  button(slides(app.tree)[0], 'Complete set 1').props.onClick(); app.render()
  edit(app, inputWeights(app.tree)[0], 21.5); edit(app, inputAmounts(app.tree)[0], 6); await save(app)
  const sets = clone(server.session.exercise_logs[0].set_logs)
  assert.equal(sets[0].weight, 17.5); assert.equal(sets[0].weight_unit, 'kg'); assert.equal(sets[0].reps, 9)
  app = mount(propsFor(issuedPlan({ weight: 350, cycle: false })), server); await app.flush()
  assert.equal(inputWeights(app.tree)[0].props.value, Math.round(21.5 * 2.2046226218 * 10) / 10)
  assert.equal(inputAmounts(app.tree)[0].props.value, 6)
  await save(app)
  assert.deepEqual(server.session.exercise_logs[0].set_logs, sets)
  assert.equal(server.session.planned_exercises[0].weight_unit || 'lb', 'lb')
})

test('unconfirmed weight keeps the exact originally typed precision through unit changes and saves', async () => {
  now = Date.parse('2026-11-05T16:00:00Z')
  const plan = issuedPlan(), server = { session: null }
  let app = mount({ ...propsFor(plan), weightUnit: 'kg' }, server); await app.flush()
  edit(app, inputWeights(app.tree)[1], 17.123); edit(app, inputAmounts(app.tree)[1], 9); await save(app)
  const canonical = clone(server.session.exercise_logs[1].input_draft)
  assert.equal(canonical.weight, 17.123); assert.equal(canonical.weight_unit, 'kg')
  for (let attempt = 0; attempt < 2; attempt++) {
    app = mount(propsFor(plan), server); await app.flush()
    assert.equal(inputWeights(app.tree)[1].props.value, Math.round(17.123 * 2.2046226218 * 10) / 10)
    assert.equal(inputAmounts(app.tree)[1].props.value, 9)
    await save(app)
    assert.deepEqual(server.session.exercise_logs[1].input_draft, canonical, 'saving a display conversion retains the exact original input and source unit')
    app = mount({ ...propsFor(plan), weightUnit: 'kg' }, server); await app.flush()
    assert.equal(inputWeights(app.tree)[1].props.value, 17.123)
    assert.equal(inputAmounts(app.tree)[1].props.value, 9)
    await save(app)
    assert.deepEqual(server.session.exercise_logs[1].input_draft, canonical)
    assert.equal(server.session.exercise_logs[1].set_logs.length, 0)
  }
})

test('explicit pause before any edits or sets resumes the exact saved issued suggestion that day', async () => {
  now = Date.parse('2026-11-05T16:00:00Z')
  const plan = issuedPlan(), server = { session: null }
  let app = mount(propsFor(plan), server); await app.flush(); await save(app)
  const savedPlan = clone(server.session.planned_exercises), suggestion = activityDose(plan[1]).weight
  assert.ok(server.session.exercise_logs.every(log => log.set_logs.length === 0 && !log.input_draft && !log.completed))
  const changed = issuedPlan({ weight: 350, cycle: false })
  assert.notEqual(activityDose(changed[1]).weight, suggestion)
  for (let attempt = 0; attempt < 2; attempt++) {
    app = mount(propsFor(changed), server); await app.flush()
    assert.equal(inputWeights(app.tree)[1].props.value, suggestion)
    assert.match(content(slides(app.tree)[1]), /0\/3 sets/)
    await save(app)
    assert.deepEqual(server.session.planned_exercises, savedPlan)
    assert.ok(server.session.exercise_logs.every(log => log.set_logs.length === 0 && !log.input_draft && !log.completed))
  }
})

test('repeated exercise occurrences keep edited inputs attached to their own session key', async () => {
  now = Date.parse('2026-11-05T16:00:00Z')
  const plan = issuedPlan({ repeated: true }), server = { session: null }
  let app = mount(propsFor(plan), server); await app.flush()
  edit(app, inputWeights(app.tree)[2], 12.5); edit(app, inputAmounts(app.tree)[2], 6); await save(app)
  assert.equal(server.session.exercise_logs[1].input_draft, undefined)
  assert.equal(server.session.exercise_logs[2].input_draft.session_key, plan[2].session_key)
  assert.notEqual(plan[1].session_key, plan[2].session_key)
  app = mount(propsFor(plan), server); await app.flush()
  assert.equal(inputWeights(app.tree)[1].props.value, activityDose(plan[1]).weight)
  assert.equal(inputWeights(app.tree)[2].props.value, 12.5); assert.equal(inputAmounts(app.tree)[2].props.value, 6)
})

test('newer unsaved browser edits win over older server inputs, while a stale clean copy yields to newer saved inputs', async () => {
  now = Date.parse('2026-11-05T16:00:00Z')
  const plan = issuedPlan(), changed = issuedPlan({ weight: 350, cycle: false }), server = { session: null }, storage = new Map()
  const kgProps = exercises => ({ ...propsFor(exercises), weightUnit: 'kg' })
  let app = mount(kgProps(plan), server, storage); await app.flush(); await save(app)
  const untouchedServer = clone(server.session)
  now += 1000
  edit(app, inputWeights(app.tree)[1], 19.75); edit(app, inputAmounts(app.tree)[1], 6); await app.flush()
  assert.deepEqual(server.session, untouchedServer, 'unconfirmed browser edits do not mutate server data before save')
  const localDraft = JSON.parse([...storage.values()][0])
  assert.equal(localDraft.dirty, true)
  assert.ok(Date.parse(localDraft.modifiedAt) > Date.parse(server.session.updated_at))
  app = mount(kgProps(changed), server, storage); await app.flush()
  assert.equal(inputWeights(app.tree)[1].props.value, 19.75); assert.equal(inputAmounts(app.tree)[1].props.value, 6)
  await save(app)
  assert.equal(server.session.exercise_logs[1].input_draft.weight, 19.75)
  assert.deepEqual(server.session.planned_exercises, plan)
  const staleStorage = new Map(storage)
  assert.equal(JSON.parse([...staleStorage.values()][0]).dirty, false)
  now += 1000
  const newer = mount(kgProps(changed), server); await newer.flush()
  edit(newer, inputWeights(newer.tree)[1], 27.375); edit(newer, inputAmounts(newer.tree)[1], 8); await save(newer)
  const latest = clone(server.session)
  app = mount(kgProps(changed), server, staleStorage); await app.flush()
  assert.equal(inputWeights(app.tree)[1].props.value, 27.375); assert.equal(inputAmounts(app.tree)[1].props.value, 8)
  assert.deepEqual(server.session, latest)
  await save(app)
  assert.equal(server.session.exercise_logs[1].input_draft.weight, 27.375)
  assert.equal(server.session.exercise_logs[1].input_draft.weight_unit, 'kg')
  assert.equal(server.session.exercise_logs[1].input_draft.amount, 8)
  assert.equal(server.session.exercise_logs[1].set_logs.length, 0)
})

test('corrupt saved input drafts block resume and save without rewriting browser or server records', async () => {
  now = Date.parse('2026-11-05T16:00:00Z')
  const plan = issuedPlan(), p = propsFor(plan)
  const key = `anastasis-session:${p.clientId}:${p.program}:${p.dayName}:${getClientLocalDate(client, new Clock())}:recommended:${JSON.stringify(workoutSessionKeys(plan))}`
  const valid = { version: 1, session_key: plan[1].session_key, weight_unit: 'kg', weightEdited: true, weight: 17.5 }
  for (const invalid of [{ ...valid, session_key: plan[0].session_key }, { ...valid, version: 2 }, { ...valid, weight_unit: 'stone' }]) {
    for (const location of ['local', 'server']) {
      const logs = clone(initialWorkoutLogs(plan))
      logs[1].input_draft = invalid
      const server = { session: { id: 'synthetic-session', planned_exercises: clone(plan),
        exercise_logs: location === 'server' ? clone(logs) : clone(initialWorkoutLogs(plan)), completed: false, updated_at: new Clock().toISOString() } }
      const originalLocal = JSON.stringify({ logs: location === 'local' ? logs : clone(initialWorkoutLogs(plan)),
        plannedExercises: plan, dirty: false, modifiedAt: new Clock().toISOString() }, null, 2)
      const storage = new Map([[key, originalLocal]]), originalServer = clone(server.session)
      const app = mount(p, server, storage); await app.flush()
      assert.equal(inputWeights(app.tree).length, 0, `${location} corrupt draft cannot be adopted as an actual input`)
      assert.equal(button(app.tree, 'Save / pause'), undefined)
      assert.ok(button(app.tree, 'Retry saved progress'))
      assert.match(content(app.tree), /review|original.*prescription/i)
      assert.equal(app.calls.some(call => call.payload), false)
      assert.equal(storage.get(key), originalLocal)
      assert.deepEqual(server.session, originalServer)
      button(app.tree, 'Retry saved progress').props.onClick(); await app.flush()
      assert.equal(app.calls.some(call => call.payload), false)
      assert.equal(storage.get(key), originalLocal)
      assert.deepEqual(server.session, originalServer)
    }
  }
})

test('an equipment selection made before the first set keeps its issued load and equipment on reopen', async () => {
  now = Date.parse('2026-11-05T16:00:00Z')
  const plan = issuedPlan(), server = { session: null }
  let app = mount(propsFor(plan), server); await app.flush()
  const equipment = nodes(slides(app.tree)[0], node => node.type === 'select' && node.props['aria-label'] === 'Equipment')[0]
  assert.equal(equipment.props.disabled, false)
  assert.ok(plan[0].available_variants.some(variant => variant.id === 'machine_row'))
  equipment.props.onChange({ target: { value: 'machine_row' } }); app.render(); await save(app)
  const selected = clone(server.session.exercise_logs[0])
  assert.equal(selected.selected_variant_id, 'machine_row')
  assert.equal(selected.issued_prescription.selected_variant_id, 'machine_row')
  assert.equal(selected.issued_prescription.session_key, plan[0].session_key)
  assert.equal(selected.issued_prescription.weight, selected.recommended_weight)
  assert.equal(selected.set_logs.length, 0)
  for (let attempt = 0; attempt < 2; attempt++) {
    app = mount(propsFor(issuedPlan({ weight: 350, cycle: false })), server); await app.flush()
    const selector = nodes(slides(app.tree)[0], node => node.type === 'select' && node.props['aria-label'] === 'Equipment')[0]
    assert.equal(selector.props.value, 'machine_row')
    assert.equal(inputWeights(app.tree)[0].props.value, activityDose(selected).weight)
    assert.doesNotMatch(content(slides(app.tree)[0]), /Load recommendation unavailable/)
    await save(app)
    assert.equal(server.session.exercise_logs[0].selected_variant_id, selected.selected_variant_id)
    assert.deepEqual(server.session.exercise_logs[0].issued_prescription, selected.issued_prescription)
    assert.equal(server.session.exercise_logs[0].set_logs.length, 0)
  }
})

test('unknown and corrupt saved loads stay blank while explicit user entries remain loggable', async () => {
  now = Date.parse('2026-11-05T16:00:00Z')
  const valid = issuedPlan()[1]
  for (const original of [{ ...valid, exercise: 'Unknown cable movement' },
    { ...valid, recommended_weight: valid.recommended_weight + 999 },
    { ...valid, issued_prescription: { version: 'future-unknown' } }]) {
    const exercise = clone(projectSavedExercisePrescription(original, 'ember'))
    const app = mount(propsFor([exercise])); await app.flush()
    assert.equal(inputWeights(app.tree)[0].props.value, '')
    assert.match(content(app.tree), /Load recommendation unavailable/)
    edit(app, inputWeights(app.tree)[0], 0)
    button(app.tree, 'Complete set 1').props.onClick(); app.render(); await save(app)
    const set = app.calls.find(call => call.payload).payload.exercise_logs[0].set_logs[0]
    assert.equal(set.weight, 0); assert.equal(set.weight_unit, 'lb')
  }
})

test('a new local day uses fresh guidance and cannot inherit yesterday’s issued suggestion or typed draft', async () => {
  now = Date.parse('2026-11-05T16:00:00Z')
  const server = { session: null }, storage = new Map(), yesterday = issuedPlan()
  const app = mount(propsFor(yesterday), server, storage); await app.flush()
  edit(app, inputWeights(app.tree)[1], 17.5); await save(app)
  const oldEntries = [...storage]
  now += 86400000
  const today = issuedPlan({ weight: 350, cycle: false }), reopened = mount(propsFor(today), server, storage); await reopened.flush()
  assert.equal(inputWeights(reopened.tree)[1].props.value, activityDose(today[1]).weight)
  assert.notEqual(inputWeights(reopened.tree)[1].props.value, 17.5)
  for (const [key, value] of oldEntries) assert.equal(storage.get(key), value, 'yesterday’s retained browser record is unchanged')
  assert.equal(reopened.calls.some(call => call.payload), false)
})
