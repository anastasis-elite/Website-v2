import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

// Disposable hook execution of the actual manual trackers. No account, browser
// profile, database, health record, or network service is used.
const require = createRequire(import.meta.url)
const content = node => Array.isArray(node) ? node.map(content).join('') : node && typeof node === 'object' ? content(node.props?.children) : node == null ? '' : String(node)
const nodes = (node, match) => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(child => nodes(child, match)) : [...(match(node) ? [node] : []), ...nodes(node.props?.children, match)]
const json = (value, ok = true) => ({ ok, json: async () => value })
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
const start = Date.parse('2026-11-03T18:00:00Z')
const strength = { id: 'squat:synthetic-occurrence', exercise: 'Squat', exercise_category: 'strength', sets: 4, reps: 8, load_type: 'per_hand', recommended_weight: 10, selected_variant_id: 'synthetic-db' }
const cardio = { id: 'manual-cardio:walking:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', session_key: 'manual-cardio:walking:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', exercise: 'Walking', exercise_category: 'cardio', manual_activity: 'cardio-duration-v1', manual_cardio_id: 'walking', duration_unit: 'seconds' }

function mount(path, exercise = strength) {
  let now = start, cursor = 0, tree, queued = [], send = async call => call.body ? json({ success: true }) : json({ success: true, session: null })
  const slots = [], effects = [], storage = new Map(), modules = new Map(), calls = [], finished = [], errors = []
  const localStorage = { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) }
  const react = {
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial; return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next }] },
    useRef(initial) { const index = cursor++; return slots[index] ||= { current: initial } },
    useMemo(fn) { cursor++; return fn() },
    useEffect(fn, deps) { const index = cursor++, prior = effects[index]; if (!prior || deps?.some((value, n) => !Object.is(value, prior.deps[n]))) queued.push(() => { prior?.cleanup?.(); effects[index] = { deps, cleanup: fn() } }) },
  }
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])) } static now() { return now } }
  function load(path) {
    path = resolve(path)
    if (modules.has(path)) return modules.get(path).exports
    if (path.endsWith('.json')) return JSON.parse(readFileSync(path, 'utf8'))
    const module = { exports: {} }; modules.set(path, module)
    const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
    runInNewContext(code, { module, exports: module.exports, Date: Clock, console: { error: error => errors.push(error) }, window: { localStorage, confirm: () => true }, localStorage,
      fetch(url, options) { const call = { url, options, body: options?.body ? JSON.parse(options.body) : null }; calls.push(call); return send(call) },
      require(name) {
        if (name === 'react') return react
        if (name === 'next/navigation') return { useRouter: () => ({ refresh() {} }) }
        if (name === 'next/link') return { __esModule: true, default: 'a' }
        if (name === 'next/image') return { __esModule: true, default: 'img' }
        if (['@/components/workout-feedback/WorkoutFeedback', '@/components/legal/SafetyEscalationNotice'].includes(name)) return { __esModule: true, default: 'aside' }
        if (name.startsWith('@/') || name.startsWith('.')) {
          let target = name.startsWith('@/') ? resolve(name.slice(2)) : resolve(dirname(path), name)
          if (!existsSync(target)) target += existsSync(target + '.ts') ? '.ts' : '.tsx'
          return load(target)
        }
        return require(name)
      },
    }, { filename: path })
    return module.exports
  }
  const Component = load(path).default
  const props = { clientId: 'SYNTHETIC-CLIENT', authUserId: 'synthetic-owner', program: 'ignite', dayName: exercise === cardio ? 'Manual Cardio' : 'Manual Workout', exercises: [exercise], workoutSource: 'manual', timezone: 'America/Chicago', weightUnit: 'kg', onManualExerciseFinished: (...values) => finished.push(values) }
  function render() {
    cursor = 0; queued = []; tree = Component(props)
    while (typeof tree.type === 'function') tree = tree.type(tree.props)
    const pending = queued; queued = []; pending.forEach(effect => effect())
    return tree
  }
  const button = label => nodes(render(), node => node.type === 'button' && content(node) === label)[0]
  render()
  return { render, button, calls, storage, finished, errors, props,
    get tree() { return tree }, setSend(fn) { send = fn }, setTime(value) { now = Date.parse(value) },
    async flush() { await new Promise(setImmediate); render(); await new Promise(setImmediate); render() },
    get writes() { return calls.filter(call => call.body) },
  }
}

test('manual strength requires confirmed final receipt before clearing draft or reporting a finished exercise; retry preserves actuals and original denominator', async () => {
  const app = mount('components/WorkoutTracker.tsx')
  app.button('Set Done').props.onClick(); await app.flush()
  const draft = [...app.storage.values()][0]
  assert.equal(JSON.parse(draft).sets.length, 1)
  app.button('Finish Exercise').props.onClick(); await app.flush()
  assert.equal(app.finished.length, 0)
  assert.match(content(app.tree), /Exercise finish failed/)
  assert.equal([...app.storage.values()][0], draft)
  const failed = app.writes.at(-1).body
  assert.equal(failed.exercise_logs[0].planned_sets, 4)
  assert.equal(failed.completed, false)
  assert.equal(failed.sets[0].weight_unit, 'kg')
  app.setSend(async () => json({ success: true, workout_log_id: 'saved-workout', exercise_session_id: 'saved-exercise-session', completed: false }))
  app.button('Finish Exercise').props.onClick(); await app.flush()
  assert.equal(app.finished.length, 1)
  assert.equal(app.finished[0][0], false, 'One set out of four is still partial')
  const evidence = app.finished[0][1]
  assert.equal(evidence.workoutLogId, 'saved-workout'); assert.equal(evidence.exerciseId, strength.id)
  const signature = JSON.parse(evidence.signature)
  assert.equal(signature.plannedSets, 4); assert.equal(signature.sets.length, 1)
  assert.equal(signature.sets[0].reps, failed.sets[0].reps); assert.equal(signature.sets[0].weight, failed.sets[0].weight)
  assert.equal(signature.sets[0].unit, 'kg')
  assert.equal(app.storage.size, 0)
})

test('pending manual strength finish deduplicates repeated activation and never reports a successful save before the response', async () => {
  const app = mount('components/WorkoutTracker.tsx')
  app.button('Set Done').props.onClick(); await app.flush()
  const pending = deferred(); app.setSend(() => pending.promise)
  const finish = app.button('Finish Exercise').props.onClick
  finish(); finish(); app.render()
  assert.equal(app.writes.length, 2, 'One set save and one final save')
  assert.equal(app.finished.length, 0); assert.ok(app.storage.size > 0)
  pending.resolve(json({ success: true, workout_log_id: 'saved-workout', exercise_session_id: 'saved-session' })); await app.flush()
  assert.equal(app.finished.length, 1)
})

test('manual strength refuses a finish from the previous member-local day before writing and retains its draft', async () => {
  const app = mount('components/WorkoutTracker.tsx')
  app.button('Set Done').props.onClick(); await app.flush()
  const finish = app.button('Finish Exercise').props.onClick
  app.setTime('2026-11-04T07:00:00Z'); finish(); await app.flush()
  assert.equal(app.writes.length, 1); assert.equal(app.finished.length, 0)
  assert.ok(app.storage.size > 0); assert.match(content(app.tree), /Exercise finish failed/)
})

test('manual strength final response that arrives after local midnight cannot report finish or discard prior-day actuals', async () => {
  const app = mount('components/WorkoutTracker.tsx')
  app.button('Set Done').props.onClick(); await app.flush()
  const pending = deferred(); app.setSend(() => pending.promise)
  app.button('Finish Exercise').props.onClick()
  app.setTime('2026-11-04T07:00:00Z')
  pending.resolve(json({ success: true, workout_log_id: 'saved-workout', exercise_session_id: 'saved-session' })); await app.flush()
  assert.equal(app.finished.length, 0); assert.ok(app.storage.size > 0)
  assert.ok([...app.storage.keys()].every(key => key.includes('2026-11-03')), 'Prior-day actuals must stay under their original draft identity')
  assert.equal([...app.storage.keys()].some(key => key.includes('2026-11-04')), false)
})

test('manual cardio rejects an unconfirmed or mismatched final response and retains confirmed seconds for explicit retry', async () => {
  const app = mount('components/ActivityWorkoutTracker.tsx', cardio); await app.flush()
  nodes(app.tree, node => node.type === 'input')[0].props.onChange({ target: { value: '95' } }); app.render()
  app.button('Confirm activity').props.onClick(); app.render()
  app.setSend(async () => json({ success: true }))
  app.button('Finish and review').props.onClick(); await app.flush()
  assert.equal(app.finished.length, 0); assert.match(content(app.tree), /save could not be confirmed/)
  assert.ok([...app.storage.values()].some(value => JSON.parse(value).dirty))
  app.setSend(async call => json({ success: true, completed: true, session: { id: 'saved-cardio', exercise_logs: [{ ...call.body.exercise_logs[0], actual_duration: 96 }] } }))
  app.button('Finish and review').props.onClick(); await app.flush()
  assert.equal(app.finished.length, 0)
  app.setSend(async call => json({ success: true, completed: true, session: { id: 'saved-cardio', updated_at: new Date(start).toISOString(), exercise_logs: call.body.exercise_logs } }))
  app.button('Finish and review').props.onClick(); await app.flush()
  assert.equal(app.finished.length, 1); assert.equal(app.finished[0][0], true)
  const saved = app.writes.at(-1).body.exercise_logs[0]
  assert.equal(saved.actual_duration, 95); assert.equal(saved.duration_unit, 'seconds'); assert.equal(saved.set_logs.length, 0)
  assert.equal(saved.planned_sets, undefined)
  const signature = JSON.parse(app.finished[0][1].signature)
  assert.equal(signature.duration, 95); assert.equal(signature.unit, 'seconds'); assert.equal(signature.plannedSets, null)
})

test('manual cardio can save an incomplete duration session without manufacturing completed credit or strength sets', async () => {
  const app = mount('components/ActivityWorkoutTracker.tsx', cardio); await app.flush()
  app.setSend(async call => json({ success: true, completed: false, session: { id: 'partial-cardio', exercise_logs: call.body.exercise_logs } }))
  app.button('Finish and review').props.onClick(); await app.flush()
  assert.equal(app.finished.length, 1); assert.equal(app.finished[0][0], false)
  assert.equal(JSON.parse(app.finished[0][1].signature).duration, 0)
  assert.equal(app.writes[0].body.exercise_logs[0].completed, false)
  assert.equal(app.writes[0].body.exercise_logs[0].set_logs.length, 0)
})

test('manual cardio pending finish is single-flight and its late next-day response cannot finish the current day', async () => {
  const app = mount('components/ActivityWorkoutTracker.tsx', cardio); await app.flush()
  nodes(app.tree, node => node.type === 'input')[0].props.onChange({ target: { value: '60' } }); app.render()
  app.button('Confirm activity').props.onClick(); app.render()
  const pending = deferred(); app.setSend(() => pending.promise)
  const finish = app.button('Finish and review').props.onClick
  finish(); finish(); app.render()
  assert.equal(app.writes.length, 1); assert.equal(app.finished.length, 0)
  app.setTime('2026-11-04T07:00:00Z')
  pending.resolve(json({ success: true, completed: true, session: { id: 'saved-cardio', exercise_logs: app.writes[0].body.exercise_logs } })); await app.flush()
  assert.equal(app.finished.length, 0); assert.match(content(app.tree), /new day has started/)
  assert.ok([...app.storage.values()].some(value => JSON.parse(value).dirty))
  assert.ok([...app.storage.keys()].every(key => key.includes('2026-11-03')), 'Prior-day cardio actuals must stay under their original draft identity')
  assert.equal([...app.storage.keys()].some(key => key.includes('2026-11-04')), false)
})
