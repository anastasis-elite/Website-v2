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

// A 50 lb x 3 assessment gives an estimated 1RM of 55 lb. The reference
// multiplier for 8 reps is .725, which rounds to the issued 40 lb cable load.
const freshEstimated1RM = 50 * (1 + 3 / 30)
const freshRow = { id: 'row', exercise: 'Seated Cable Row', sets: 3, reps: 8, recommended_weight: 40, calculated_weight: 40,
  assessment_key: 'Row', estimated_1rm: Math.round(freshEstimated1RM), baseline_weight: 40, rep_multiplier: .725, weight_unit: 'lb',
  selected_variant_id: 'seated_cable_row', selected_equipment: 'cable', load_type: 'total_load',
  prescription_calculation: { version: 'founder-load-v3', reference_exercise: 'Seated Cable Row', assessment_key: 'Row',
    bodyweight_factor: 0, body_mass_lb: 180, estimated_1rm: freshEstimated1RM, rep_multiplier: .725, base_weight: 40,
    equipment_weight: 40, selected_variant_id: 'seated_cable_row', equipment_modifier: 1 } }
const oldRow = { ...freshRow, sets: 4, reps: 10, recommended_weight: 20, calculated_weight: 20, prescription_calculation: undefined }
async function retainedDraftStorage(draft, server = false) {
  const p = props([freshRow]), date = (await import(moduleUrl('lib/timezone.ts'))).getClientLocalDate({ timezone: p.timezone })
  const key = `anastasis-session:${p.clientId}:${p.program}:${p.dayName}:${date}:recommended:${JSON.stringify(['row:0'])}`
  const log = { ...oldRow, session_key: 'row:0', completed: false, skipped: false, set_logs: [], actual_weight: 0, actual_reps: 0 }
  return new Map(server ? [['__disposableServer', JSON.stringify({ exercise_logs: [log], planned_exercises: [oldRow] })]]
    : [[key, JSON.stringify({ logs: [log], plannedExercises: [oldRow], draft: [draft], dirty: false })]])
}
const numericInputs = tree => nodes(tree, node => node.type === 'input' && node.props.type === 'number')
for (const server of [false, true]) {
  test(`untouched ${server ? 'server' : 'browser'} draft refreshes current assessment weight and reps on reload`, async () => {
    const storage = await retainedDraftStorage({ weight: 20, amount: 10 }, server)
    const app = mount(ActivityTracker, props([freshRow]), storage); await app.flush()
    assert.deepEqual(numericInputs(app.tree).map(n => n.props.value), [40, 8])
    const reloaded = mount(ActivityTracker, props([freshRow]), storage); await reloaded.flush()
    assert.deepEqual(numericInputs(reloaded.tree).map(n => n.props.value), [40, 8])
  })
}
test('typed weight and legacy changed reps survive even when dirty was cleared', async () => {
  const storage = await retainedDraftStorage({ weight: 25, weightEdited: true, amount: 7 })
  const app = mount(ActivityTracker, props([freshRow]), storage); await app.flush()
  assert.deepEqual(numericInputs(app.tree).map(n => n.props.value), [25, 7])
})
test('legacy changed reps alone retain their original prescription', async () => {
  const storage = await retainedDraftStorage({ weight: 20, amount: 7 })
  const app = mount(ActivityTracker, props([freshRow]), storage); await app.flush()
  assert.equal(numericInputs(app.tree)[1].props.value, 7)
})
test('rep input marks a deliberate edit even when matching the original default', async () => {
  const storage = await retainedDraftStorage({ weight: 20, amount: 10 })
  const app = mount(ActivityTracker, props([freshRow]), storage); await app.flush()
  numericInputs(app.tree)[1].props.onChange({ target: { value: '8' } }); await app.flush()
  const saved = JSON.parse([...storage.values()][0]); assert.equal(saved.draft[0].amountEdited, true)
  const changed = { ...freshRow, reps: 12 }
  const reloaded = mount(ActivityTracker, props([changed]), storage); await reloaded.flush()
  assert.equal(numericInputs(reloaded.tree)[1].props.value, 8)
})

test('saved zero-set server defaults do not erase browser-only weight and rep edits', async () => {
  const storage = await retainedDraftStorage({ weight: 25, weightEdited: true, amount: 7 })
  const server = await retainedDraftStorage(null, true)
  storage.set('__disposableServer', server.get('__disposableServer'))
  const app = mount(ActivityTracker, props([freshRow]), storage); await app.flush()
  assert.deepEqual(numericInputs(app.tree).map(n => n.props.value), [25, 7])
})

test('ambiguous legacy loads stay blank while recorded sets and explicit input drafts survive pause and reopen', async () => {
  const first = { ...bodyweight, sets: 4 }
  const ambiguous = { ...freshRow, assessment_key: undefined, baseline_weight: undefined, rep_multiplier: undefined,
    prescription_calculation: { ...freshRow.prescription_calculation, estimated_1rm: 40, rep_multiplier: 1 } }
  const p = props([first, ambiguous]), date = (await import(moduleUrl('lib/timezone.ts'))).getClientLocalDate({ timezone: p.timezone })
  const keys = ['squat:0', 'row:1'], key = `anastasis-session:${p.clientId}:${p.program}:${p.dayName}:${date}:recommended:${JSON.stringify(keys)}`
  const recorded = [{ set_number: 1, weight: 0, reps: 7, weight_unit: 'kg', completed_at: new Date().toISOString() }]
  const plan = [first, ambiguous], logs = plan.map((exercise, index) => ({ ...exercise, session_key: keys[index], completed: false,
    skipped: false, set_logs: index === 0 ? recorded : [], actual_weight: 0, actual_reps: 0 }))
  const storage = new Map([[key, JSON.stringify({ logs, plannedExercises: plan, dirty: true,
    modifiedAt: new Date().toISOString(), draft: [{ weight: 0, amount: 8 }, { weight: 40, amount: 8 }] })]])
  const app = mount(ActivityTracker, p, storage); await app.flush()
  const weightInput = tree => nodes(tree, node => node.type === 'label' && content(node).startsWith('Weight ('))
    .flatMap(label => nodes(label, node => node.type === 'input'))[0]
  const repInputs = tree => nodes(tree, node => node.type === 'label' && content(node).startsWith('Repetitions completed'))
    .flatMap(label => nodes(label, node => node.type === 'input'))
  assert.equal(weightInput(app.tree).props.value, '')
  assert.match(content(app.tree), /Load recommendation unavailable/)
  assert.match(content(app.tree), /Set 1: 7 reps · 0 kg/)
  assert.equal(JSON.parse(storage.get(key)).draft[1].retainedWeight, 40, 'an unedited legacy default remains review context')
  button(app.tree, 'Save / pause').props.onClick(); await app.flush()
  const untouched = app.calls.find(call => call.payload).payload
  assert.deepEqual(untouched.exercise_logs[0].set_logs, recorded)
  assert.deepEqual(untouched.exercise_logs[1].set_logs, [])
  assert.equal(untouched.exercise_logs[1].input_draft, undefined, 'an unverifiable suggestion is never promoted to an actual input')

  weightInput(app.tree).props.onChange({ target: { value: '25' } }); await app.flush()
  repInputs(app.tree)[1].props.onChange({ target: { value: '7' } }); await app.flush()
  button(app.tree, 'Save / pause').props.onClick(); await app.flush()
  const saved = app.calls.filter(call => call.payload).at(-1).payload
  assert.deepEqual(saved.exercise_logs[0].set_logs, recorded)
  assert.deepEqual(saved.exercise_logs[1].set_logs, [])
  assert.equal(saved.exercise_logs[1].input_draft.weight, 25)
  assert.equal(saved.exercise_logs[1].input_draft.amount, 7)
  assert.equal(saved.exercise_logs[1].input_draft.session_key, 'row:1')
  assert.equal(saved.planned_exercises[1].recommended_weight, 40)
  const reloaded = mount(ActivityTracker, p, storage); await reloaded.flush()
  assert.equal(weightInput(reloaded.tree).props.value, 25)
  assert.equal(repInputs(reloaded.tree)[1].props.value, 7)
  assert.match(content(reloaded.tree), /Set 1: 7 reps · 0 kg/)
  assert.match(content(reloaded.tree), /Load recommendation unavailable/)
})
