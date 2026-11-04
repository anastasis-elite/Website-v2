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
  const storageWrites = []
  const localStorage = { get length() { return initialStorage.size }, key: index => [...initialStorage.keys()][index] || null, getItem: key => initialStorage.get(key) || null, setItem: (key, value) => { storageWrites.push({ key, value }); initialStorage.set(key, value) }, removeItem: key => initialStorage.delete(key) }
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
  return { render, flush, calls, storageWrites, storage: initialStorage, get tree() { return tree } }
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

const row = () => ({ id: 'row', exercise: 'Seated Cable Row', exercise_category: 'strength', sets: 4, reps: 8,
  load_type: 'total_load', recommended_weight: 999, calculated_weight: 999, selected_variant_id: 'seated_cable_row' })
const inputWeights = tree => nodes(tree, node => node.type === 'label' && content(node).startsWith('Weight ('))
  .map(label => nodes(label, node => node.type === 'input')[0])
const localDate = async p => (await import(moduleUrl('lib/timezone.ts'))).getClientLocalDate({ timezone: p.timezone })
const localKey = (p, date, dayName = p.dayName, keys = p.exercises.map((exercise, index) => `${exercise.id}:${index}`)) =>
  `anastasis-session:${p.clientId}:${p.program}:${dayName}:${date}:recommended:${JSON.stringify(keys)}`

test('legacy unverified exercise stays loggable with dose retained, blank actual load and no old recommendation', async () => {
  const exercise = row(), before = structuredClone(exercise), p = props([exercise])
  const app = mount(ActivityTracker, { ...p, loadGuidanceExercises: [{ ...exercise, load_guidance_status: 'unverified', load_guidance_reason: 'Review the saved calculation.' }] })
  await app.flush()
  assert.equal(inputWeights(app.tree)[0].props.value, '')
  assert.match(content(app.tree), /Load recommendation unavailable/)
  assert.match(content(app.tree), /4 sets · 8 reps/)
  assert.doesNotMatch(content(app.tree), /999 lb|No added load prescribed/)
  assert.ok(button(app.tree, 'Save / pause'))
  button(app.tree, 'Complete set 1').props.onClick(); app.render()
  assert.match(content(app.tree), /Enter a valid amount/)
  inputWeights(app.tree)[0].props.onChange({ target: { value: '35' } }); app.render()
  button(app.tree, 'Complete set 1').props.onClick(); app.render()
  button(app.tree, 'Save / pause').props.onClick(); await app.flush()
  const saved = app.calls.find(call => call.payload).payload
  assert.equal(saved.exercise_logs[0].set_logs[0].weight, 35)
  assert.equal(saved.planned_exercises[0].recommended_weight, 999)
  assert.equal(saved.exercise_logs[0].load_guidance_status, undefined)
  assert.equal(saved.planned_exercises[0].sets, 4)
  assert.deepEqual(exercise, before)
})

test('not-calculated external exercises require an actual load entry while explicit bodyweight remains zero', async () => {
  const unknown = { ...row(), id: 'crunch', exercise: 'Crunch', recommended_weight: null, calculated_weight: null,
    baseline_weight: null, load_guidance_status: 'not_calculated', load_guidance_reason: 'No supported measured input.' }
  const app = mount(ActivityTracker, props([unknown, bodyweight]))
  await app.flush()
  assert.equal(inputWeights(app.tree)[0].props.value, '')
  assert.match(content(app.tree), /Bodyweight · no added load/)
  assert.doesNotMatch(content(app.tree), /No added load prescribed/)
  inputWeights(app.tree)[0].props.onChange({ target: { value: '0' } }); app.render()
  button(app.tree, 'Complete set 1').props.onClick(); app.render()
  button(app.tree, 'Save / pause').props.onClick(); await app.flush()
  assert.equal(app.calls.find(call => call.payload).payload.exercise_logs[0].set_logs[0].weight, 0)
})

test('started server sessions retain actual kg entries and original prescription while old load is not shown as current guidance', async () => {
  const exercise = row(), p = { ...props([exercise]), weightUnit: 'kg' }
  const set = { set_number: 1, weight: 22, weight_unit: 'kg', reps: 7, completed_at: new Date().toISOString() }
  const session = { planned_exercises: [exercise], exercise_logs: [{ ...exercise, session_key: 'row:0', completed: false, set_logs: [set] }], updated_at: new Date().toISOString() }
  const storage = new Map([['__disposableServer', JSON.stringify(session)]]), app = mount(ActivityTracker, p, storage)
  await app.flush()
  assert.equal(inputWeights(app.tree)[0].props.value, 22)
  assert.match(content(app.tree), /Set 1: 7 reps · 22 kg/)
  assert.match(content(app.tree), /Load recommendation unavailable/)
  assert.match(content(app.tree), /1 of 4 prescribed sets recorded/)
  button(app.tree, 'Save / pause').props.onClick(); await app.flush()
  const saved = app.calls.find(call => call.payload).payload
  assert.deepEqual(saved.exercise_logs[0].set_logs, [set])
  assert.equal(saved.planned_exercises[0].recommended_weight, 999)
  assert.equal(saved.exercise_logs[0].session_key, 'row:0')
})

test('dirty Row work cannot turn an untouched unknown Crunch draft zero into entered actual load', async () => {
  const first = row(), crunch = { ...row(), id: 'crunch', exercise: 'Crunch', sets: 3, recommended_weight: null, calculated_weight: null }
  const p = props([first, crunch]), date = await localDate(p), key = localKey(p, date)
  const set = { set_number: 1, weight: 30, weight_unit: 'lb', reps: 7, completed_at: new Date().toISOString() }
  const stored = { plannedExercises: [first, crunch], logs: [{ ...first, session_key: 'row:0', set_logs: [set] }, { ...crunch, session_key: 'crunch:1', set_logs: [] }],
    draft: [{ weight: 999, amount: 8 }, { weight: 0, amount: 8 }], dirty: true, modifiedAt: new Date().toISOString() }
  const storage = new Map([[key, JSON.stringify(stored)]]), app = mount(ActivityTracker, p, storage)
  await app.flush()
  assert.deepEqual(inputWeights(app.tree).map(input => input.props.value), [30, ''])
  button(app.tree, 'Complete set 1').props.onClick(); app.render()
  assert.match(content(app.tree), /Enter a valid amount/)
  const retained = JSON.parse(storage.get(key))
  assert.equal(retained.draft[1].weight, null)
  assert.equal(retained.draft[1].retainedWeight, 0)
  assert.equal(retained.draft[1].weightEdited, false)
  button(app.tree, 'Save / pause').props.onClick(); await app.flush()
  const saved = app.calls.find(call => call.payload).payload
  assert.deepEqual(saved.exercise_logs[0].set_logs, [set])
  assert.deepEqual(saved.exercise_logs[1].set_logs, [])
  assert.equal(saved.planned_exercises.reduce((sum, exercise) => sum + exercise.sets, 0), 7)
})

test('explicit per-exercise actual edits survive reload for unknown load guidance', async () => {
  const exercise = row(), p = { ...props([exercise]), weightUnit: 'kg' }, date = await localDate(p), key = localKey(p, date)
  const stored = { plannedExercises: [exercise], logs: [{ ...exercise, session_key: 'row:0', set_logs: [] }],
    draft: [{ weight: 17.5, amount: 8, weightEdited: true }], dirty: true, modifiedAt: new Date().toISOString() }
  const app = mount(ActivityTracker, p, new Map([[key, JSON.stringify(stored)]]))
  await app.flush()
  assert.equal(inputWeights(app.tree)[0].props.value, 17.5)
  button(app.tree, 'Complete set 1').props.onClick(); app.render()
  button(app.tree, 'Save / pause').props.onClick(); await app.flush()
  const set = app.calls.find(call => call.payload).payload.exercise_logs[0].set_logs[0]
  assert.equal(set.weight, 17.5); assert.equal(set.weight_unit, 'kg')
})

test('normal legacy logging discovers an existing unique reduced local session and retains its original identity', async () => {
  const full = [bodyweight, { ...bodyweight, id: 'second' }], p = props(full), date = await localDate(p)
  const exercise = { ...bodyweight, sets: 4, session_key: 'squat:0' }, dayName = 'Reduced strength workout', key = localKey(p, date, dayName, ['squat:0'])
  const set = { set_number: 1, weight: 0, reps: 7, weight_unit: 'lb', completed_at: new Date().toISOString() }
  const stored = { logs: [{ ...exercise, set_logs: [set] }], plannedExercises: [exercise], dirty: true, modifiedAt: new Date().toISOString() }
  const storage = new Map([[key, JSON.stringify(stored)]]), app = mount(ActivityTracker, p, storage)
  await app.flush()
  assert.match(content(app.tree), /1 of 4 prescribed sets recorded/)
  button(app.tree, 'Save / pause').props.onClick(); await app.flush()
  const saved = app.calls.find(call => call.payload).payload
  assert.equal(saved.day_name, dayName); assert.equal(saved.planned_exercises.length, 1)
  assert.equal(saved.planned_exercises[0].sets, 4); assert.equal(saved.exercise_logs[0].session_key, 'squat:0')
  assert.deepEqual(saved.exercise_logs[0].set_logs, [set])
  assert.deepEqual([...storage.keys()].filter(key => !key.startsWith('__')), [key])
})

test('normal logging keeps ambiguous older reduced drafts intact while current logging remains available', async () => {
  const p = props([row()]), date = await localDate(p), exercise = { ...bodyweight, session_key: 'squat:0' }
  const stored = JSON.stringify({ plannedExercises: [exercise], logs: [{ ...exercise, set_logs: [{ weight: 0, reps: 7 }] }] })
  const first = localKey(p, date, 'First reduced', ['squat:0']), second = localKey(p, date, 'Second reduced', ['squat:0'])
  const storage = new Map([[first, stored], [second, stored]]), app = mount(ActivityTracker, p, storage)
  await app.flush()
  assert.equal(inputWeights(app.tree)[0].props.value, '')
  assert.ok(button(app.tree, 'Save / pause'))
  assert.equal(storage.get(first), stored); assert.equal(storage.get(second), stored)
  assert.equal(app.calls.length, 1)
})

test('a newer empty server snapshot cannot overwrite an older discovered reduced draft with the current full plan', async () => {
  const p = props([bodyweight, { ...bodyweight, id: 'second' }]), date = await localDate(p)
  const exercise = { ...bodyweight, sets: 4, session_key: 'squat:0' }, dayName = 'Existing reduced session'
  const key = localKey(p, date, dayName, ['squat:0'])
  const original = JSON.stringify({ logs: [{ ...exercise, set_logs: [{ weight: 0, reps: 7 }] }], plannedExercises: [exercise],
    dirty: true, modifiedAt: '2026-11-04T12:00:00Z' })
  const server = JSON.stringify({ planned_exercises: [exercise], exercise_logs: [{ ...exercise, set_logs: [] }], updated_at: '2026-11-04T13:00:00Z' })
  const storage = new Map([[key, original], ['__disposableServer', server]]), before = [...storage]
  const app = mount(ActivityTracker, p, storage)
  await app.flush()
  assert.match(content(app.tree), /Both have been kept/)
  assert.equal(inputWeights(app.tree).length, 0)
  assert.equal(button(app.tree, 'Save / pause'), undefined)
  assert.equal(app.calls.length, 2); assert.equal(app.calls.some(call => call.payload), false)
  assert.deepEqual([...storage], before)
})

test('normal exact-key started drafts with an unknown original set denominator stay untouched and require recovery', async () => {
  const exercise = { ...row(), sets: 1 }, p = props([exercise]), date = await localDate(p), key = localKey(p, date)
  const log = { ...exercise, session_key: 'row:0', set_logs: [{ set_number: 1, weight: 0, weight_unit: 'kg', reps: 7, completed_at: new Date().toISOString() }] }
  delete log.sets
  const original = JSON.stringify({ logs: [log], dirty: true, modifiedAt: new Date().toISOString() }, null, 2)
  const storage = new Map([[key, original]]), before = [...storage], app = mount(ActivityTracker, p, storage)
  assert.doesNotMatch(content(app.tree), /prescribed sets recorded|needed for workout checkoff/)
  assert.equal(inputWeights(app.tree).length, 0)
  await app.flush()
  assert.deepEqual([...storage], before, 'an incomplete started draft must not be rewritten with today’s inferred denominator')
  assert.equal(app.storageWrites.length, 0)
  assert.equal(app.calls.some(call => call.payload), false)
  assert.equal(inputWeights(app.tree).length, 0)
  assert.equal(button(app.tree, 'Save / pause'), undefined)
  assert.doesNotMatch(content(app.tree), /prescribed sets recorded|needed for workout checkoff/)
  assert.match(content(app.tree), /review|recover|original prescription/i)
  assert.ok(button(app.tree, 'Retry saved progress'))
  button(app.tree, 'Retry saved progress').props.onClick(); await app.flush()
  assert.deepEqual([...storage], before)
  assert.equal(app.storageWrites.length, 0)
  assert.equal(app.calls.some(call => call.payload), false)
})

test('normal exact-key incomplete raw legacy arrays cannot inherit the current set denominator', async () => {
  const exercise = { ...row(), sets: 1 }, p = props([exercise]), date = await localDate(p), key = localKey(p, date)
  const log = { ...exercise, session_key: 'row:0', set_logs: [{ weight: 0, weight_unit: 'kg', reps: 7, completed_at: new Date().toISOString() }] }
  delete log.sets
  const original = JSON.stringify([log]), storage = new Map([[key, original]]), app = mount(ActivityTracker, p, storage)
  await app.flush()
  assert.equal(storage.get(key), original)
  assert.equal(app.storageWrites.length, 0)
  assert.equal(app.calls.some(call => call.payload), false)
  assert.equal(inputWeights(app.tree).length, 0)
  assert.equal(button(app.tree, 'Save / pause'), undefined)
  assert.doesNotMatch(content(app.tree), /needed for workout checkoff|prescribed sets recorded/)
  assert.match(content(app.tree), /review|recover|original prescription/i)
  assert.ok(button(app.tree, 'Retry saved progress'))
})

test('normal exact-key started local sessions keep their original four-set snapshot when current guidance has one set', async () => {
  const current = { ...row(), sets: 1 }, originalPlan = { ...row(), sets: 4 }, p = props([current]), date = await localDate(p), key = localKey(p, date)
  const set = { set_number: 1, weight: 0, weight_unit: 'kg', reps: 7, completed_at: new Date().toISOString() }
  const stored = { plannedExercises: [originalPlan], logs: [{ ...originalPlan, session_key: 'row:0', set_logs: [set] }],
    dirty: true, modifiedAt: new Date().toISOString() }
  const app = mount(ActivityTracker, { ...p, weightUnit: 'kg' }, new Map([[key, JSON.stringify(stored)]]))
  await app.flush()
  assert.match(content(app.tree), /1 of 4 prescribed sets recorded/)
  assert.match(content(app.tree), /2 needed for workout checkoff/)
  assert.equal(inputWeights(app.tree)[0].props.value, 0)
  assert.ok(button(app.tree, 'Save / pause'))
  button(app.tree, 'Save / pause').props.onClick(); await app.flush()
  const saved = app.calls.find(call => call.payload).payload
  assert.deepEqual(saved.exercise_logs[0].set_logs, [set])
  assert.equal(saved.exercise_logs[0].session_key, 'row:0')
  assert.equal(saved.planned_exercises[0].sets, 4)
  assert.equal(saved.completed, false)
})

test('normal exact-key raw legacy local arrays retain coherent original dose and actual kg sets', async () => {
  const current = { ...row(), sets: 1 }, p = { ...props([current]), weightUnit: 'kg' }, date = await localDate(p), key = localKey(p, date)
  const set = { set_number: 1, weight: 17.5, weight_unit: 'kg', reps: 7, completed_at: new Date().toISOString() }
  const originalPlan = { ...row(), sets: 4, session_key: 'row:0', set_logs: [set] }
  const app = mount(ActivityTracker, p, new Map([[key, JSON.stringify([originalPlan])]]))
  await app.flush()
  assert.match(content(app.tree), /1 of 4 prescribed sets recorded/)
  assert.match(content(app.tree), /2 needed for workout checkoff/)
  assert.equal(inputWeights(app.tree)[0].props.value, 17.5)
  assert.ok(button(app.tree, 'Save / pause'))
  button(app.tree, 'Save / pause').props.onClick(); await app.flush()
  const saved = app.calls.find(call => call.payload).payload
  assert.deepEqual(saved.exercise_logs[0].set_logs, [set])
  assert.equal(saved.planned_exercises[0].sets, 4)
  assert.equal(saved.exercise_logs[0].session_key, 'row:0')
})

test('normal exact-key coherent server snapshots retain their own denominator and actual zero kg', async () => {
  const current = { ...row(), sets: 1 }, originalPlan = { ...row(), sets: 4 }, p = { ...props([current]), weightUnit: 'kg' }
  const set = { set_number: 1, weight: 0, weight_unit: 'kg', reps: 7, completed_at: new Date().toISOString() }
  const session = { planned_exercises: [originalPlan], exercise_logs: [{ ...originalPlan, session_key: 'row:0', set_logs: [set] }],
    updated_at: new Date().toISOString() }
  const app = mount(ActivityTracker, p, new Map([['__disposableServer', JSON.stringify(session)]]))
  await app.flush()
  assert.match(content(app.tree), /1 of 4 prescribed sets recorded/)
  assert.equal(inputWeights(app.tree)[0].props.value, 0)
  assert.ok(button(app.tree, 'Save / pause'))
  button(app.tree, 'Save / pause').props.onClick(); await app.flush()
  const saved = app.calls.find(call => call.payload).payload
  assert.deepEqual(saved.exercise_logs[0].set_logs, [set])
  assert.equal(saved.planned_exercises[0].sets, 4)
  assert.equal(saved.exercise_logs[0].session_key, 'row:0')
})

test('normal exact-key edited actual zero kg without a recoverable dose is kept for review before recording', async () => {
  const exercise = { ...row(), sets: 1 }, p = { ...props([exercise]), weightUnit: 'kg' }, date = await localDate(p), key = localKey(p, date)
  const log = { ...exercise, session_key: 'row:0', set_logs: [] }; delete log.sets
  const original = JSON.stringify({ logs: [log], draft: [{ weight: 0, weightEdited: true, amount: 8 }], dirty: false }, null, 2)
  const storage = new Map([[key, original]]), app = mount(ActivityTracker, p, storage)
  await app.flush()
  assert.equal(storage.get(key), original)
  assert.equal(app.storageWrites.length, 0)
  assert.equal(app.calls.some(call => call.payload), false)
  assert.equal(inputWeights(app.tree).length, 0)
  assert.equal(button(app.tree, 'Save / pause'), undefined)
  assert.doesNotMatch(content(app.tree), /needed for workout checkoff|prescribed sets recorded/)
  assert.match(content(app.tree), /review|recover|original prescription/i)
  assert.ok(button(app.tree, 'Retry saved progress'))
})

test('normal exact-key stale incomplete local work cannot be discarded for a newer coherent server snapshot', async () => {
  const exercise = { ...row(), sets: 1 }, p = props([exercise]), date = await localDate(p), key = localKey(p, date)
  const set = { set_number: 1, weight: 0, weight_unit: 'kg', reps: 7, completed_at: '2026-11-04T12:00:00Z' }
  const log = { ...exercise, session_key: 'row:0', set_logs: [set] }; delete log.sets
  const original = JSON.stringify({ logs: [log], dirty: true, modifiedAt: '2026-11-04T12:01:00Z' }, null, 2)
  const serverPlan = { ...row(), sets: 4 }
  const server = JSON.stringify({ planned_exercises: [serverPlan], exercise_logs: [{ ...serverPlan, session_key: 'row:0', set_logs: [set] }], updated_at: '2026-11-04T13:00:00Z' })
  const storage = new Map([[key, original], ['__disposableServer', server]]), before = [...storage]
  const app = mount(ActivityTracker, p, storage)
  await app.flush()
  assert.deepEqual([...storage], before)
  assert.equal(app.storageWrites.length, 0)
  assert.equal(app.calls.some(call => call.payload), false)
  assert.equal(inputWeights(app.tree).length, 0)
  assert.equal(button(app.tree, 'Save / pause'), undefined)
  assert.doesNotMatch(content(app.tree), /needed for workout checkoff|prescribed sets recorded/)
  assert.match(content(app.tree), /review|recover|original prescription/i)
  assert.ok(button(app.tree, 'Retry saved progress'))
})

test('normal exact-key incomplete server work remains unchanged without adopting the current one-set target', async () => {
  const exercise = { ...row(), sets: 1 }, p = { ...props([exercise]), weightUnit: 'kg' }
  const set = { set_number: 1, weight: 0, weight_unit: 'kg', reps: 7, completed_at: '2026-11-04T12:00:00Z' }
  const log = { ...exercise, session_key: 'row:0', set_logs: [set] }; delete log.sets
  const server = JSON.stringify({ exercise_logs: [log], updated_at: '2026-11-04T13:00:00Z' }, null, 2)
  const storage = new Map([['__disposableServer', server]]), before = [...storage], app = mount(ActivityTracker, p, storage)
  await app.flush()
  assert.deepEqual([...storage], before)
  assert.equal(app.storageWrites.length, 0)
  assert.equal(app.calls.some(call => call.payload), false)
  assert.equal(inputWeights(app.tree).length, 0)
  assert.equal(button(app.tree, 'Save / pause'), undefined)
  assert.doesNotMatch(content(app.tree), /needed for workout checkoff|prescribed sets recorded/)
  assert.match(content(app.tree), /review|recover|original prescription/i)
  assert.ok(button(app.tree, 'Retry saved progress'))
})

test('normal exact-key malformed nonempty browser data is retained for review without replacement or save', async () => {
  const exercise = { ...row(), sets: 1 }, p = props([exercise]), date = await localDate(p), key = localKey(p, date)
  const original = '{ "logs": [', storage = new Map([[key, original]]), before = [...storage]
  const app = mount(ActivityTracker, p, storage)
  await app.flush()
  assert.deepEqual([...storage], before)
  assert.equal(app.storageWrites.length, 0)
  assert.equal(app.calls.some(call => call.payload), false)
  assert.equal(inputWeights(app.tree).length, 0)
  assert.equal(button(app.tree, 'Save / pause'), undefined)
  assert.doesNotMatch(content(app.tree), /needed for workout checkoff|prescribed sets recorded/)
  assert.match(content(app.tree), /review|recover|draft|original/i)
  assert.ok(button(app.tree, 'Retry saved progress'))
})

test('normal exact-key newer typed-only local zero kg retains its four-set plan over older server guidance', async () => {
  const current = { ...row(), sets: 1 }, originalPlan = { ...row(), sets: 4 }, p = { ...props([current]), weightUnit: 'kg' }
  const date = await localDate(p), key = localKey(p, date)
  const stored = { plannedExercises: [originalPlan], logs: [{ ...originalPlan, session_key: 'row:0', set_logs: [] }],
    draft: [{ weight: 0, weightEdited: true, amount: 8 }], dirty: true, modifiedAt: '2026-11-04T13:00:00Z' }
  const server = { planned_exercises: [current], exercise_logs: [{ ...current, session_key: 'row:0', set_logs: [{ set_number: 1, weight: 22,
    weight_unit: 'kg', reps: 7, completed_at: '2026-11-04T12:00:00Z' }] }], updated_at: '2026-11-04T12:00:00Z' }
  const storage = new Map([[key, JSON.stringify(stored)], ['__disposableServer', JSON.stringify(server)]])
  const app = mount(ActivityTracker, p, storage)
  await app.flush()
  assert.match(content(app.tree), /0 of 4 prescribed sets recorded/)
  assert.match(content(app.tree), /2 needed for workout checkoff/)
  assert.equal(inputWeights(app.tree)[0].props.value, 0)
  const retained = JSON.parse(storage.get(key))
  assert.equal(retained.plannedExercises[0].sets, 4)
  assert.equal(retained.draft[0].weight, 0); assert.equal(retained.draft[0].weightEdited, true)
  button(app.tree, 'Complete set 1').props.onClick(); app.render()
  button(app.tree, 'Save / pause').props.onClick(); await app.flush()
  const saved = app.calls.find(call => call.payload).payload
  assert.equal(saved.planned_exercises[0].sets, 4)
  assert.equal(saved.exercise_logs[0].set_logs.length, 1)
  assert.equal(saved.exercise_logs[0].set_logs[0].weight, 0)
  assert.equal(saved.exercise_logs[0].set_logs[0].weight_unit, 'kg')
  assert.equal(saved.completed, false)
})

test('normal exact-key newer skipped-only local work retains its original four-set denominator', async () => {
  const current = { ...row(), sets: 1 }, originalPlan = { ...row(), sets: 4 }, p = props([current]), date = await localDate(p), key = localKey(p, date)
  const stored = { plannedExercises: [originalPlan], logs: [{ ...originalPlan, session_key: 'row:0', set_logs: [], skipped: true }],
    dirty: true, modifiedAt: '2026-11-04T13:00:00Z' }
  const server = { planned_exercises: [current], exercise_logs: [{ ...current, session_key: 'row:0', set_logs: [{ set_number: 1, weight: 22,
    weight_unit: 'kg', reps: 7, completed_at: '2026-11-04T12:00:00Z' }] }], updated_at: '2026-11-04T12:00:00Z' }
  const app = mount(ActivityTracker, p, new Map([[key, JSON.stringify(stored)], ['__disposableServer', JSON.stringify(server)]]))
  await app.flush()
  assert.match(content(app.tree), /0 of 4 prescribed sets recorded/)
  assert.match(content(app.tree), /1 skipped/)
  button(app.tree, 'Save / pause').props.onClick(); await app.flush()
  const saved = app.calls.find(call => call.payload).payload
  assert.equal(saved.planned_exercises[0].sets, 4)
  assert.equal(saved.exercise_logs[0].skipped, true)
  assert.deepEqual(saved.exercise_logs[0].set_logs, [])
  assert.equal(saved.completed, false)
})

test('normal exact-key invalid retained log or plan shapes stay untouched without exposing inferred targets', async () => {
  const exercise = { ...row(), sets: 1 }, p = props([exercise]), date = await localDate(p), key = localKey(p, date)
  for (const retained of [{ logs: [null], dirty: true }, { logs: [{ ...exercise, session_key: 'row:0', set_logs: [{ weight: 0, reps: 7 }] }], plannedExercises: [null], dirty: true }]) {
    const original = JSON.stringify(retained), storage = new Map([[key, original]]), app = mount(ActivityTracker, p, storage)
    await app.flush()
    assert.equal(storage.get(key), original)
    assert.equal(app.storageWrites.length, 0)
    assert.equal(app.calls.some(call => call.payload), false)
    assert.equal(inputWeights(app.tree).length, 0)
    assert.equal(button(app.tree, 'Save / pause'), undefined)
    assert.doesNotMatch(content(app.tree), /needed for workout checkoff|prescribed sets recorded/)
    assert.match(content(app.tree), /review|recover|draft|original/i)
    assert.ok(button(app.tree, 'Retry saved progress'))
  }
})

test('normal exact-key coherent typed-only drafts retain their identity before discovering another reduced session', async () => {
  const current = { ...row(), sets: 1 }, originalPlan = { ...row(), sets: 4 }, p = { ...props([current]), weightUnit: 'kg' }
  const date = await localDate(p), key = localKey(p, date)
  const exactDraft = { plannedExercises: [originalPlan], logs: [{ ...originalPlan, session_key: 'row:0', set_logs: [] }],
    draft: [{ weight: 0, weightEdited: true, amount: 8 }], dirty: true, modifiedAt: new Date().toISOString() }
  const reducedExercise = { ...bodyweight, sets: 2, session_key: 'squat:0' }
  const reducedKey = localKey(p, date, 'Another reduced session', ['squat:0'])
  const reducedOriginal = JSON.stringify({ plannedExercises: [reducedExercise], logs: [{ ...reducedExercise,
    set_logs: [{ set_number: 1, weight: 0, weight_unit: 'lb', reps: 7, completed_at: new Date().toISOString() }] }],
    dirty: true, modifiedAt: new Date().toISOString() }, null, 2)
  const storage = new Map([[key, JSON.stringify(exactDraft)], [reducedKey, reducedOriginal]])
  const app = mount(ActivityTracker, p, storage)
  await app.flush()
  assert.equal(app.calls.length, 1)
  const read = new URL(app.calls[0].url, 'https://synthetic.invalid')
  assert.equal(read.searchParams.get('dayName'), p.dayName)
  assert.deepEqual(JSON.parse(read.searchParams.get('planKeys')), ['row:0'])
  assert.match(content(app.tree), /0 of 4 prescribed sets recorded/)
  assert.equal(inputWeights(app.tree)[0].props.value, 0)
  assert.equal(storage.get(reducedKey), reducedOriginal)
  button(app.tree, 'Complete set 1').props.onClick(); app.render()
  button(app.tree, 'Save / pause').props.onClick(); await app.flush()
  const saved = app.calls.find(call => call.payload).payload
  assert.equal(saved.day_name, p.dayName)
  assert.equal(saved.planned_exercises[0].id, 'row'); assert.equal(saved.planned_exercises[0].sets, 4)
  assert.equal(saved.exercise_logs[0].session_key, 'row:0')
  assert.equal(saved.exercise_logs[0].set_logs[0].weight, 0)
  assert.equal(saved.exercise_logs[0].set_logs[0].weight_unit, 'kg')
  assert.equal(storage.get(reducedKey), reducedOriginal)
  assert.ok(app.storageWrites.every(write => write.key === key))
})

test('normal exact-key coherent skipped-only server sessions retain their identity before discovering another reduced draft', async () => {
  const current = { ...row(), sets: 1 }, originalPlan = { ...row(), sets: 4 }, p = props([current]), date = await localDate(p)
  const key = localKey(p, date)
  const server = { planned_exercises: [originalPlan], exercise_logs: [{ ...originalPlan, session_key: 'row:0', skipped: true, set_logs: [] }],
    updated_at: new Date().toISOString() }
  const reducedExercise = { ...bodyweight, sets: 6, session_key: 'squat:0' }, reducedKey = localKey(p, date, 'Another reduced workout', ['squat:0'])
  const reducedOriginal = JSON.stringify({ plannedExercises: [reducedExercise], logs: [{ ...reducedExercise,
    set_logs: [{ set_number: 1, weight: 0, weight_unit: 'lb', reps: 7, completed_at: new Date().toISOString() }] }],
    dirty: true, modifiedAt: new Date().toISOString() }, null, 2)
  const storage = new Map([['__disposableServer', JSON.stringify(server)], [reducedKey, reducedOriginal]])
  const app = mount(ActivityTracker, p, storage)
  await app.flush()
  assert.equal(app.calls.length, 1)
  const read = new URL(app.calls[0].url, 'https://synthetic.invalid')
  assert.equal(read.searchParams.get('dayName'), p.dayName)
  assert.deepEqual(JSON.parse(read.searchParams.get('planKeys')), ['row:0'])
  assert.match(content(app.tree), /0 of 4 prescribed sets recorded/)
  assert.match(content(app.tree), /1 skipped/)
  assert.equal(storage.get(reducedKey), reducedOriginal)
  button(app.tree, 'Save / pause').props.onClick(); await app.flush()
  const saved = app.calls.find(call => call.payload).payload
  assert.equal(saved.day_name, p.dayName)
  assert.equal(saved.planned_exercises[0].id, 'row'); assert.equal(saved.planned_exercises[0].sets, 4)
  assert.equal(saved.exercise_logs[0].session_key, 'row:0')
  assert.equal(saved.exercise_logs[0].skipped, true); assert.deepEqual(saved.exercise_logs[0].set_logs, [])
  assert.equal(saved.completed, false)
  assert.equal(storage.get(reducedKey), reducedOriginal)
  assert.ok(app.storageWrites.every(write => write.key === key))
})
