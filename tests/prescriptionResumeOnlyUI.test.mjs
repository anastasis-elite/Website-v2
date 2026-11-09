import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

// Execute the existing React component's controls and effects with disposable
// browser storage and API responses. No customer account or service is used.
const require = createRequire(import.meta.url)
function moduleUrl(path, cache = new Map()) {
  path = resolve(path)
  if (cache.has(path)) return cache.get(path)
  if (path.endsWith('.json')) return `data:text/javascript;base64,${Buffer.from(`export default ${readFileSync(path, 'utf8')}`).toString('base64')}`
  const { outputText } = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ES2020, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } })
  const output = outputText.replace(/from ['"]([^'"]+)['"]/g, (original, specifier) => {
    if (specifier.endsWith('.css')) return `from 'data:text/javascript;base64,${Buffer.from('export default {}').toString('base64')}'`
    const mock = specifier === 'react' ? 'export const useState=(...a)=>globalThis.workoutControlsHooks.useState(...a); export const useEffect=(...a)=>globalThis.workoutControlsHooks.useEffect(...a); export const useRef=(...a)=>globalThis.workoutControlsHooks.useRef(...a); export const useMemo=(...a)=>globalThis.workoutControlsHooks.useMemo(...a); export const useId=()=>"synthetic-workout-dialog";' : specifier === 'next/navigation' ? 'export const useRouter=()=>({refresh(){}})' : specifier === 'next/image' ? "export default 'img'" : specifier === 'next/link' ? "export default 'a'" : ['@/components/workout-feedback/WorkoutFeedback', '@/components/legal/SafetyEscalationNotice'].includes(specifier) ? "export default 'aside'" : null
    if (mock) return `from 'data:text/javascript;base64,${Buffer.from(mock).toString('base64')}'`
    const base = specifier.startsWith('@/') ? resolve(specifier.slice(2)) : specifier.startsWith('.') ? resolve(dirname(path), specifier) : null
    if (base) {
      if (base.endsWith('.json')) return `from '${moduleUrl(base, cache)}'`
      let dependency
      try { readFileSync(base + '.ts'); dependency = base + '.ts' } catch { dependency = base + '.tsx' }
      return `from '${moduleUrl(dependency, cache)}'`
    }
    return `from '${pathToFileURL(require.resolve(specifier)).href}'`
  })
  const url = `data:text/javascript;base64,${Buffer.from(output).toString('base64')}`
  cache.set(path, url)
  return url
}
const ActivityTracker = (await import(moduleUrl('components/ActivityWorkoutTracker.tsx'))).default

function mount(Component, props, initialStorage = new Map()) {
  const slots = []; let cursor = 0, effects = [], tree, previousChildKey
  const calls = []; let serverSession = JSON.parse(initialStorage.get('__disposableServer') || 'null')
  const localStorage = { get length() { return initialStorage.size }, key: index => [...initialStorage.keys()][index] || null, getItem: key => initialStorage.get(key) || null, setItem: (key, value) => initialStorage.set(key, value), removeItem: key => initialStorage.delete(key) }
  globalThis.window = { localStorage, confirm: () => true }; globalThis.localStorage = localStorage
  globalThis.fetch = async (url, options) => {
    const payload = options?.body ? JSON.parse(options.body) : null; calls.push({ url, payload })
    if (payload) { serverSession = { exercise_logs: structuredClone(payload.exercise_logs), updated_at: new Date().toISOString() }; initialStorage.set('__disposableServer', JSON.stringify(serverSession)) }
    return Response.json({ success: true, session: serverSession })
  }
  globalThis.workoutControlsHooks = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next }] },
    useRef(initial) { const i = cursor++; return slots[i] ||= { current: initial } },
    useMemo(fn) { cursor++; return fn() },
    useEffect(fn, deps) { const i = cursor++; if (!slots[i] || deps?.some((value, n) => value !== slots[i][n])) { slots[i] = deps; effects.push(fn) } },
  }
  function render(nextProps = props) {
    props = nextProps
    cursor = 0; tree = Component(props)
    if (typeof tree.type === 'function' && previousChildKey !== tree.key) {
      slots.length = 0; cursor = 0; previousChildKey = tree.key
    }
    while (typeof tree.type === 'function') tree = tree.type(tree.props)
    for (const effect of effects.splice(0)) effect()
    return tree
  }
  const flush = async () => { await new Promise(setImmediate); render(); await new Promise(setImmediate); render() }
  render()
  return { render, flush, calls, storage: initialStorage, get tree() { return tree } }
}
function nodes(tree, predicate) {
  const result = []
  function visit(node) {
    if (Array.isArray(node)) return node.forEach(visit)
    if (!node || typeof node !== 'object') return
    if (predicate(node)) result.push(node)
    visit(node.props?.children)
  }
  visit(tree); return result
}
const content = node => Array.isArray(node) ? node.map(content).join('') : node && typeof node === 'object' ? content(node.props?.children) : node == null ? '' : String(node)
const button = (tree, label) => nodes(tree, n => n.type === 'button' && content(n) === label)[0]
const props = exercises => ({ clientId: 'DISPOSABLE-TEST', authUserId: 'disposable-user', program: 'ignite', dayName: 'Control regression', exercises, timezone: 'America/Chicago' })
const bodyweight = { id: 'squat', exercise: 'Squat', exercise_category: 'strength', sets: 1, reps: 8, load_type: 'bodyweight' }

test('resume-only without recorded work hides prescriptions and never overwrites browser storage or saves', async () => {
  const storage = new Map(), app = mount(ActivityTracker, { ...props([bodyweight]), resumeOnly: true }, storage)
  assert.equal(nodes(app.tree, node => node.type === 'input').length, 0)
  assert.match(content(app.tree), /Checking your saved workout progress/)
  await app.flush()
  assert.match(content(app.tree), /saved workout needs review/)
  assert.equal(nodes(app.tree, node => node.type === 'input').length, 0)
  assert.equal(button(app.tree, 'Save / pause'), undefined)
  assert.equal(storage.size, 0)
  assert.equal(app.calls.some(call => call.payload), false)
})

test('resume-only restores a local partial workout with original session keys, actuals and 50-percent denominator', async () => {
  const exercise = { ...bodyweight, sets: 4 }, p = props([exercise])
  const date = (await import(moduleUrl('lib/timezone.ts'))).getClientLocalDate({ timezone: p.timezone })
  const legacyKey = `anastasis-session:${p.clientId}:${p.program}:${p.dayName}:${date}`
  const log = { ...exercise, session_key: 'squat:0', completed: false, skipped: false,
    set_logs: [{ set_number: 1, weight: 0, reps: 7, weight_unit: 'lb', completed_at: new Date().toISOString() }] }
  const stored = { logs: [log], plannedExercises: [exercise], dirty: true, modifiedAt: new Date().toISOString() }
  const storage = new Map([[legacyKey, JSON.stringify(stored)]])
  const app = mount(ActivityTracker, { ...p, resumeOnly: true }, storage)
  await app.flush()
  assert.equal(nodes(app.tree, node => node.props?.role === 'progressbar')[0].props['aria-valuenow'], 25)
  assert.match(content(app.tree), /Set 1: 7 reps/)
  assert.ok(button(app.tree, 'Save / pause'))
  button(app.tree, 'Save / pause').props.onClick(); await app.flush()
  const saved = app.calls.find(call => call.payload)?.payload
  assert.equal(saved.exercise_logs[0].session_key, 'squat:0')
  assert.deepEqual(saved.exercise_logs[0].set_logs, log.set_logs)
  assert.equal(saved.planned_exercises[0].sets, 4)
  assert.equal(saved.completed, false)
  assert.equal(storage.get(legacyKey), JSON.stringify(stored))
})

test('resume-only leaves an incomplete legacy local prescription untouched and unavailable', async () => {
  const exercise = { ...bodyweight, sets: 4 }, p = props([exercise])
  const date = (await import(moduleUrl('lib/timezone.ts'))).getClientLocalDate({ timezone: p.timezone })
  const key = `anastasis-session:${p.clientId}:${p.program}:${p.dayName}:${date}`
  const original = JSON.stringify({ logs: [{ ...exercise, sets: undefined, session_key: 'squat:0', set_logs: [{ weight: 0, reps: 7 }] }], dirty: true })
  const storage = new Map([[key, original]]), app = mount(ActivityTracker, { ...p, resumeOnly: true }, storage)
  await app.flush()
  assert.match(content(app.tree), /browser draft have been kept unchanged/)
  assert.equal(nodes(app.tree, node => node.type === 'input').length, 0)
  assert.equal(storage.size, 1); assert.equal(storage.get(key), original)
  assert.equal(app.calls.some(call => call.payload), false)
})

test('resume-only retains actual sets from a full-dose raw legacy browser array', async () => {
  const exercise = { ...bodyweight, sets: 4 }, p = props([exercise]), date = (await import(moduleUrl('lib/timezone.ts'))).getClientLocalDate({ timezone: p.timezone })
  const key = `anastasis-session:${p.clientId}:${p.program}:${p.dayName}:${date}`
  const log = { ...exercise, session_key: 'squat:0', set_logs: [{ set_number: 1, weight: 0, reps: 7, weight_unit: 'lb', completed_at: new Date().toISOString() }] }
  const original = JSON.stringify([log]), storage = new Map([[key, original]])
  const app = mount(ActivityTracker, { ...p, resumeOnly: true }, storage)
  await app.flush()
  assert.equal(nodes(app.tree, node => node.props?.role === 'progressbar')[0].props['aria-valuenow'], 25)
  button(app.tree, 'Save / pause').props.onClick(); await app.flush()
  const saved = app.calls.find(call => call.payload).payload
  assert.deepEqual(saved.exercise_logs[0].set_logs, log.set_logs)
  assert.equal(saved.planned_exercises[0].sets, 4)
  assert.equal(storage.get(key), original)
})

test('resume-only discovers a unique reduced local session and saves with its original dayName, subset keys and storage key', async () => {
  const p = props([bodyweight, { ...bodyweight, id: 'second' }]), date = (await import(moduleUrl('lib/timezone.ts'))).getClientLocalDate({ timezone: p.timezone })
  const exercise = { ...bodyweight, sets: 4, session_key: 'squat:0' }, dayName = 'Reduced: strength workout'
  const key = `anastasis-session:${p.clientId}:${p.program}:${dayName}:${date}:recommended:${JSON.stringify(['squat:0'])}`
  const log = { ...exercise, completed: false, set_logs: [{ set_number: 1, weight: 0, reps: 7, weight_unit: 'lb', completed_at: new Date().toISOString() }] }
  const stored = { logs: [log], plannedExercises: [exercise], dirty: true, modifiedAt: new Date().toISOString() }
  const storage = new Map([[key, JSON.stringify(stored)]]), app = mount(ActivityTracker, { ...p, resumeOnly: true }, storage)
  await app.flush()
  assert.equal(nodes(app.tree, node => node.props?.role === 'progressbar')[0].props['aria-valuenow'], 25)
  const reads = app.calls.filter(call => !call.payload)
  assert.equal(reads.length, 2)
  const originalRead = new URL(reads[1].url, 'https://synthetic.invalid')
  assert.equal(originalRead.searchParams.get('dayName'), dayName)
  assert.deepEqual(JSON.parse(originalRead.searchParams.get('planKeys')), ['squat:0'])
  button(app.tree, 'Save / pause').props.onClick(); await app.flush()
  const saved = app.calls.find(call => call.payload).payload
  assert.equal(saved.day_name, dayName); assert.equal(saved.planned_exercises.length, 1)
  assert.equal(saved.planned_exercises[0].sets, 4); assert.equal(saved.exercise_logs[0].session_key, 'squat:0')
  assert.deepEqual(saved.exercise_logs[0].set_logs, log.set_logs)
  assert.deepEqual([...storage.keys()].filter(item => !item.startsWith('__')), [key])
})

test('resume-only ambiguous reduced local sessions remain untouched without exposing prescription controls', async () => {
  const p = props([bodyweight]), date = (await import(moduleUrl('lib/timezone.ts'))).getClientLocalDate({ timezone: p.timezone })
  const exercise = { ...bodyweight, sets: 4, session_key: 'squat:0' }
  const stored = JSON.stringify({ logs: [{ ...exercise, set_logs: [{ weight: 0, reps: 7 }] }], plannedExercises: [exercise] })
  const prefix = `anastasis-session:${p.clientId}:${p.program}:`, suffix = `:${date}:recommended:${JSON.stringify(['squat:0'])}`
  const storage = new Map([[`${prefix}First reduced${suffix}`, stored], [`${prefix}Second reduced${suffix}`, stored]]), before = [...storage]
  const app = mount(ActivityTracker, { ...p, resumeOnly: true }, storage)
  await app.flush()
  assert.match(content(app.tree), /saved workout needs review/)
  assert.equal(nodes(app.tree, node => node.type === 'input').length, 0)
  assert.equal(app.calls.length, 1); assert.equal(app.calls.some(call => call.payload), false)
  assert.deepEqual([...storage], before)
})
