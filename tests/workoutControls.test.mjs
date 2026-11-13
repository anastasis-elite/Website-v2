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
const Tracker = (await import(moduleUrl('components/WorkoutTracker.tsx'))).default
const SetEditor = (await import(moduleUrl('components/workout-dashboard/WorkoutSetEditor.tsx'))).default
const Builder = (await import(moduleUrl('components/workout-dashboard/ManualWorkoutBuilder.tsx'))).default
const Dashboard = (await import(moduleUrl('components/workout-dashboard/WorkoutDashboard.tsx'))).default
const MuscleMap = (await import(moduleUrl('components/workout-dashboard/MuscleReadinessMap.tsx'))).default
const logging = await import(moduleUrl('lib/workout/logging.ts'))
const preferences = await import(moduleUrl('lib/workout/viewPreferences.ts'))
const manualLibrary = await import(moduleUrl('lib/workout/manualWorkout.ts'))

function mount(Component, props, initialStorage = new Map()) {
  const slots = []; let cursor = 0, effects = [], tree, previousChildKey
  const calls = []; let serverSession = JSON.parse(initialStorage.get('__disposableServer') || 'null')
  const localStorage = { getItem: key => initialStorage.get(key) || null, setItem: (key, value) => initialStorage.set(key, value), removeItem: key => initialStorage.delete(key) }
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
const progress = tree => nodes(tree, node => node.props?.role === 'progressbar')[0]?.props['aria-valuenow']
const chooseExercise = (tree, index) => nodes(tree, node => node.props?.['aria-label'] === 'Exercise cards')[0].props.onScroll({ currentTarget: { clientWidth: 100, scrollLeft: index * 100 } })
const button = (tree, label) => nodes(tree, n => n.type === 'button' && content(n) === label)[0]
const props = exercises => ({ clientId: 'DISPOSABLE-TEST', authUserId: 'disposable-user', program: 'ignite', dayName: 'Control regression', exercises, timezone: 'America/Chicago' })
const bodyweight = { id: 'squat', exercise: 'Squat', exercise_category: 'strength', sets: 1, reps: 8, load_type: 'bodyweight' }

test('session summary and completion mark require a successful save and retain honest telemetry gaps', async () => {
  const app = mount(ActivityTracker, props([bodyweight]))
  await app.flush()
  button(app.tree, 'Complete set 1').props.onClick(); app.render()
  globalThis.fetch = async () => Response.json({ error: 'Synthetic save failure' }, { status: 503 })
  button(app.tree, 'Finish and review').props.onClick(); await app.flush()
  assert.equal(nodes(app.tree, node => node.props?.['aria-label'] === 'Session summary').length, 0)
  assert.match(content(app.tree), /Synthetic save failure/)
  globalThis.fetch = async () => Response.json({ success: true, completed: true, session: { updated_at: new Date().toISOString() } })
  button(app.tree, 'Finish and review').props.onClick(); await app.flush()
  const summary = nodes(app.tree, node => node.props?.['aria-label'] === 'Session summary')[0]
  assert.ok(summary)
  assert.match(content(summary), /You made time for strength/)
  assert.match(content(summary), /Set 1: 8 reps/)
  assert.match(content(summary), /Heart-rate readings and continuous set\/rest intervals are unavailable/)
  assert.equal(nodes(summary, node => node.type === 'a')[0].props.href, '/dashboard/program/ignite')
})

test('zero added load remains a valid prescription and logged set', async () => {
  const app = mount(ActivityTracker, props([{ ...bodyweight, load_type: 'total_load', recommended_weight: 0 }]))
  await app.flush()
  const weight = nodes(app.tree, n => n.type === 'input' && n.props.inputMode === 'decimal')[0]
  assert.equal(weight.props.min, '0'); assert.equal(weight.props.value, 0)
  button(app.tree, 'Complete set 1').props.onClick(); app.render()
  button(app.tree, 'Finish and review').props.onClick(); await app.flush()
  assert.equal(app.calls.at(-1).payload.exercise_logs[0].set_logs[0].weight, 0)
})

test('missing variation selection has an honest placeholder instead of showing an incompatible first choice', async () => {
  const app = mount(ActivityTracker, props([{ ...bodyweight, load_type: 'total_load', selected_variant_id: null, available_variants: [{ id: 'bw', name: 'Bodyweight squat', equipment: 'bodyweight', load_type: 'bodyweight', equipment_modifier: 1 }, { id: 'db', name: 'Dumbbell squat', equipment: 'dumbbell', load_type: 'per_hand', equipment_modifier: 1 }] }]))
  await app.flush()
  const select = nodes(app.tree, n => n.type === 'select' && n.props['aria-label'] !== 'Choose exercise')[0]
  assert.equal(select.props.value, '')
  assert.equal(nodes(select, n => n.type === 'option' && n.props.value === '').length, 1)
})

test('repeated exercises have distinct visible occurrence labels and independent progress', async () => {
  const app = mount(ActivityTracker, props([bodyweight, { ...bodyweight, reps: 10 }]))
  await app.flush()
  const headings = nodes(app.tree, n => n.type === 'h3').map(content)
  assert.equal(new Set(headings).size, 2)
  button(app.tree, 'Complete set 1').props.onClick(); app.render()
  assert.equal(progress(app.tree), 50)
})

test('reopening a completed exercise keeps confirmed sets for correction', async () => {
  const app = mount(ActivityTracker, props([bodyweight])); await app.flush()
  button(app.tree, 'Complete set 1').props.onClick(); app.render()
  button(app.tree, 'Edit activity').props.onClick(); app.render()
  assert.match(content(app.tree), /Recorded sets/)
  assert.match(content(app.tree), /Set 1/)
})

test('editing a recorded set after skipping restores completion without conflicting skipped state', async () => {
  const app = mount(ActivityTracker, props([bodyweight])); await app.flush()
  button(app.tree, 'Complete set 1').props.onClick(); app.render()
  button(app.tree, 'Edit activity').props.onClick(); app.render()
  button(app.tree, 'Skip exercise').props.onClick(); app.render()
  nodes(app.tree, n => typeof n.props?.onSave === 'function')[0].props.onSave({ weight: 0, reps: 10 }); app.render()
  button(app.tree, 'Finish and review').props.onClick(); await app.flush()
  const log = app.calls.at(-1).payload.exercise_logs[0]
  assert.equal(log.completed, true); assert.equal(log.skipped, false)
})

test('removing a recorded set from a skipped exercise keeps it partial without conflicting flags', async () => {
  const app = mount(ActivityTracker, props([bodyweight])); await app.flush()
  button(app.tree, 'Complete set 1').props.onClick(); app.render()
  button(app.tree, 'Edit activity').props.onClick(); app.render()
  button(app.tree, 'Skip exercise').props.onClick(); app.render()
  button(app.tree, 'Remove set 1').props.onClick(); app.render()
  button(app.tree, 'Save / pause').props.onClick(); await app.flush()
  const log = app.calls.at(-1).payload.exercise_logs[0]
  assert.equal(log.completed, false); assert.equal(log.skipped, false)
})

test('manual finish explains why completion is unavailable before the first set', () => {
  const app = mount(Tracker, { ...props([bodyweight]), workoutSource: 'manual' })
  assert.equal(button(app.tree, 'Finish Exercise').props.disabled, true)
  assert.match(content(app.tree), /Record at least one set/)
})

test('manual occurrences of the same exercise do not inherit another occurrence draft', async () => {
  const storage = new Map()
  const first = mount(Tracker, { ...props([{ ...bodyweight, id: 'squat-first' }]), workoutSource: 'manual' }, storage)
  button(first.tree, 'Set Done').props.onClick(); await first.flush()
  const second = mount(Tracker, { ...props([{ ...bodyweight, id: 'squat-second' }]), workoutSource: 'manual' }, storage)
  assert.equal(nodes(second.tree, n => n.props?.['data-testid'] === 'manual-set-history').length, 0)
})

test('bodyweight selected variation overrides stale loaded metadata and hides weight controls', async () => {
  const app = mount(ActivityTracker, props([{ ...bodyweight, load_type: 'per_hand', recommended_weight: 20, selected_variant_id: 'bw', available_variants: [{ id: 'bw', name: 'Squat', equipment: 'bodyweight', load_type: 'bodyweight', equipment_modifier: 1 }] }]))
  await app.flush()
  assert.equal(nodes(app.tree, n => n.type === 'input').length, 1)
  assert.match(content(app.tree), /Bodyweight · no added load/)
})

test('recorded-set editing accepts decimal weight, validates whole reps, and only updates on explicit confirmation', () => {
  const updates = []
  const app = mount(SetEditor, { set: { set_number: 1, weight: 0, reps: 8, weight_unit: 'kg' }, increment: 0.5, loadLabel: 'per hand', disabled: false, onSave: values => updates.push(values) })
  let inputs = nodes(app.tree, n => n.type === 'input')
  inputs[0].props.onChange({ target: { value: '2.5' } }); inputs[1].props.onChange({ target: { value: '1.5' } }); app.render()
  assert.deepEqual(updates, [])
  button(app.tree, 'Update set 1').props.onClick(); app.render()
  assert.deepEqual(updates, []); assert.match(content(app.tree), /whole number of reps/)
  inputs = nodes(app.tree, n => n.type === 'input'); inputs[1].props.onChange({ target: { value: '10' } }); app.render()
  button(app.tree, 'Update set 1').props.onClick()
  assert.deepEqual(updates, [{ weight: 2.5, reps: 10 }])
})

test('manual set inputs reject blank weight and fractional reps without writing', async () => {
  const app = mount(Tracker, { ...props([{ ...bodyweight, load_type: 'per_hand' }]), workoutSource: 'manual' })
  const inputs = nodes(app.tree, n => n.type === 'input')
  inputs[0].props.onChange({ target: { value: '' } }); inputs[1].props.onChange({ target: { value: '3.5' } }); app.render()
  button(app.tree, 'Set Done').props.onClick(); await app.flush()
  assert.equal(app.calls.length, 0); assert.match(content(app.tree), /positive whole number/)
})

test('a saved manual set reports success when browser draft storage is unavailable', async () => {
  const app = mount(Tracker, { ...props([bodyweight]), workoutSource: 'manual' })
  window.localStorage.setItem = () => { throw new Error('Storage disabled for disposable test') }
  button(app.tree, 'Set Done').props.onClick(); await app.flush()
  assert.equal(app.calls.length, 1)
  assert.match(content(app.tree), /Set 1 saved/)
  assert.match(content(app.tree), /browser.*draft/i)
})

test('recommended repeated occurrences survive save, reload and revisit with separate sets', async () => {
  const storage = new Map(), exercises = [bodyweight, { ...bodyweight, reps: 10 }]
  const first = mount(ActivityTracker, props(exercises), storage); await first.flush()
  button(first.tree, 'Complete set 1').props.onClick(); first.render()
  button(first.tree, 'Save / pause').props.onClick(); await first.flush()
  const reloaded = mount(ActivityTracker, props(exercises), storage); await reloaded.flush()
  assert.equal(progress(reloaded.tree), 50)
  button(reloaded.tree, 'Complete set 1').props.onClick(); reloaded.render()
  button(reloaded.tree, 'Finish and review').props.onClick(); await reloaded.flush()
  assert.deepEqual(reloaded.calls.at(-1).payload.exercise_logs.map(log => log.set_logs[0].reps), [8, 10])
  const revisited = mount(ActivityTracker, props(exercises), storage); await revisited.flush()
  assert.equal(progress(revisited.tree), 100)
})

test('set threshold shows whole-plan progress, stays open at half, and reopens the fixed prescription', async () => {
  const storage = new Map(), exercises = [0, 1, 2].map(index => ({ ...bodyweight, id: `threshold-${index}`, exercise: `Threshold ${index}`, sets: 3 }))
  const app = mount(ActivityTracker, props(exercises), storage); await app.flush()
  const card = index => nodes(app.tree, node => node.type === 'article' && node.props.className === 'activity-exercise')[index]
  for (let count = 0; count < 3; count++) { button(card(0), `Complete set ${count + 1}`).props.onClick(); app.render() }
  button(card(1), 'Complete set 1').props.onClick(); app.render()
  assert.equal(progress(app.tree), 44)
  button(app.tree, 'Save / pause').props.onClick(); await app.flush()
  assert.equal(app.calls.at(-1).payload.completed, false)
  button(card(1), 'Complete set 2').props.onClick(); app.render()
  assert.equal(progress(app.tree), 55)
  assert.match(content(app.tree), /meet the workout checkoff threshold/)
  assert.equal(nodes(app.tree, node => node.props?.['aria-label'] === 'Session summary').length, 0, 'crossing half never finishes automatically')
  assert.ok(button(card(1), 'Complete set 3'))
  button(app.tree, 'Save / pause').props.onClick(); await app.flush()
  const saved = app.calls.at(-1).payload
  assert.equal(saved.completed, true)
  assert.equal(saved.exercise_logs[1].completed, false, 'two of three sets never pretends the third was performed')
  assert.equal(saved.exercise_logs[2].set_logs.length, 0)
  storage.set('__disposableServer', JSON.stringify({ ...saved, updated_at: new Date().toISOString() }))
  const reopened = mount(ActivityTracker, props(exercises.map(exercise => ({ ...exercise, sets: 1 }))), storage); await reopened.flush()
  assert.equal(progress(reopened.tree), 55)
  assert.equal(nodes(reopened.tree, node => node.props?.['aria-label'] === 'Session summary').length, 0)
})

test('carousel keeps exercise drafts, completed sets and saved progress through navigation and reload', async () => {
  const storage = new Map(), exercises = [
    { ...bodyweight, sets: 2, load_type: 'per_hand', recommended_weight: 10 },
    { ...bodyweight, id: 'row', exercise: 'Row', load_type: 'per_hand', recommended_weight: 15 },
  ]
  const app = mount(ActivityTracker, props(exercises), storage); await app.flush()
  const slides = tree => nodes(tree, n => n.props?.['aria-roledescription'] === 'slide')
  const active = tree => slides(tree).find(n => n.props['aria-hidden'] === false)
  assert.match(content(app.tree), /Exercise 1 of 2/)
  assert.equal(nodes(app.tree, n => n.type === 'button' && ['Previous exercise', 'Next exercise'].includes(n.props['aria-label'])).length, 0)
  let inputs = nodes(active(app.tree), n => n.type === 'input')
  inputs[0].props.onChange({ target: { value: '12.5' } }); inputs[1].props.onChange({ target: { value: '9' } }); app.render()
  button(active(app.tree), 'Complete set 1').props.onClick(); app.render()
  inputs = nodes(active(app.tree), n => n.type === 'input')
  inputs[1].props.onChange({ target: { value: '11' } }); app.render()
  chooseExercise(app.tree, 1); app.render()
  assert.match(content(app.tree), /Exercise 2 of 2/)
  const mounted = slides(app.tree)
  assert.equal(mounted.length, 2, 'Navigating keeps both keyed cards mounted, including recorded-set editors')
  const inactiveElement = { inert: false }; mounted[0].ref(inactiveElement)
  assert.equal(inactiveElement.inert, true)
  inputs = nodes(active(app.tree), n => n.type === 'input')
  inputs[0].props.onChange({ target: { value: '17.5' } }); inputs[1].props.onChange({ target: { value: '10' } }); app.render()
  button(active(app.tree), 'Complete set 1').props.onClick(); app.render()
  chooseExercise(app.tree, 0); app.render()
  inputs = nodes(active(app.tree), n => n.type === 'input')
  assert.deepEqual(inputs.map(n => n.props.value), [12.5, 11])
  assert.match(content(active(app.tree)), /Set 1: 9 reps · 12.5 lb/)
  button(active(app.tree), 'Complete set 2').props.onClick(); app.render()
  chooseExercise(app.tree, 1); app.render()
  button(app.tree, 'Save / pause').props.onClick(); await app.flush()
  assert.deepEqual(app.calls.at(-1).payload.exercise_logs.map(log => log.set_logs.map(set => [set.weight, set.reps])), [[[12.5, 9], [12.5, 11]], [[17.5, 10]]])
  const reloaded = mount(ActivityTracker, props(exercises), storage); await reloaded.flush()
  assert.match(content(reloaded.tree), /Exercise 2 of 2/)
  assert.equal(progress(reloaded.tree), 100)
  chooseExercise(reloaded.tree, 0); reloaded.render()
  assert.match(content(active(reloaded.tree)), /Set 2: 11 reps · 12.5 lb/)
})

test('carousel follows native horizontal scrolling and reserves keyboard navigation for its viewport', async () => {
  const app = mount(ActivityTracker, props([bodyweight, { ...bodyweight, id: 'second' }, { ...bodyweight, id: 'third' }])); await app.flush()
  const viewport = () => nodes(app.tree, n => n.props?.['aria-label'] === 'Exercise cards')[0]
  viewport().props.onScroll({ currentTarget: { clientWidth: 320, scrollLeft: 320 } }); app.render()
  assert.match(content(app.tree), /Exercise 2 of 3/)
  const target = {}, prevented = []
  viewport().props.onKeyDown({ key: 'ArrowRight', target: {}, currentTarget: target, preventDefault: () => prevented.push('input') }); app.render()
  assert.match(content(app.tree), /Exercise 2 of 3/)
  assert.deepEqual(prevented, [])
  for (const [key, expected] of [['ArrowRight', 3], ['Home', 1], ['End', 3], ['ArrowLeft', 2]]) {
    viewport().props.onKeyDown({ key, target, currentTarget: target, preventDefault: () => prevented.push(key) }); app.render()
    assert.match(content(app.tree), new RegExp(`Exercise ${expected} of 3`))
  }
  assert.deepEqual(prevented, ['ArrowRight', 'Home', 'End', 'ArrowLeft'])
  const css = readFileSync('app/globals.css', 'utf8')
  assert.match(css, /\.activity-exercise-track\{[^}]*overflow-x:auto[^}]*scroll-snap-type:x mandatory[^}]*touch-action:pan-x pan-y pinch-zoom/)
  assert.match(css, /\.activity-exercise-track>\.activity-exercise\{[^}]*flex:0 0 100%[^}]*scroll-snap-align:start/)
})

test('manual builder resumes the same exercise occurrence after reload and picks the selected equipment', async () => {
  const storage = new Map(), builderProps = { ...props([]), recommendedDayName: 'Recommendation', recommendedExercises: [], memberEquipment: ['dumbbell'], readiness: [] }
  const app = mount(Builder, builderProps, storage); await app.flush()
  nodes(app.tree, n => typeof n.props?.onChooseExercises === 'function')[0].props.onChooseExercises('left_quadriceps'); app.render()
  const dumbbell = button(app.tree, 'Dumbbell')
  assert.ok(dumbbell, content(app.tree))
  dumbbell.props.onClick(); app.render()
  const movement = nodes(app.tree, n => n.type === 'button' && content(n) !== 'Back')[0]
  movement.props.onClick(); app.render()
  const choose = nodes(app.tree, n => n.type === 'button' && content(n) === 'Open')[0]
  assert.ok(choose, 'At least one compatible exercise should be selectable')
  choose.props.onClick(); app.render()
  const tracker = nodes(app.tree, n => n.props?.workoutSource === 'manual')[0]
  assert.equal(tracker.props.exercises[0].selected_equipment, 'dumbbell')
  const occurrenceId = tracker.props.exercises[0].id
  const reload = mount(Builder, builderProps, storage); await reload.flush()
  assert.equal(nodes(reload.tree, n => n.props?.workoutSource === 'manual')[0].props.exercises[0].id, occurrenceId)
})

test('manual builder clears another client or tier session instead of copying it into a new draft key', async () => {
  const storage = new Map(), initialProps = { ...props([]), recommendedDayName: 'Recommendation', recommendedExercises: [], memberEquipment: ['bodyweight'], readiness: [] }
  const app = mount(Builder, initialProps, storage); await app.flush()
  nodes(app.tree, n => typeof n.props?.onChooseExercises === 'function')[0].props.onChooseExercises('left_quadriceps'); app.render()
  button(app.tree, 'Bodyweight').props.onClick(); app.render()
  nodes(app.tree, n => n.type === 'button' && content(n) !== 'Back')[0].props.onClick(); app.render()
  button(app.tree, 'Open').props.onClick(); app.render()
  assert.equal(nodes(app.tree, n => n.props?.workoutSource === 'manual').length, 1)
  app.render({ ...initialProps, clientId: 'SECOND-DISPOSABLE-CLIENT', program: 'ember' }); await app.flush()
  assert.equal(nodes(app.tree, n => n.props?.workoutSource === 'manual').length, 0)
  assert.ok([...storage.entries()].filter(([key]) => key.includes('SECOND-DISPOSABLE-CLIENT')).every(([, value]) => JSON.parse(value).activeExercise === null))
})

test('manual builder resets its active exercise and completed list at member-local midnight', async t => {
  const NativeDate = Date; let now = Date.parse('2026-10-13T04:59:00Z')
  globalThis.Date = class extends NativeDate { constructor(...args) { super(...(args.length ? args : [now])) } static now() { return now } }
  t.after(() => { globalThis.Date = NativeDate })
  const initialProps = { ...props([]), recommendedDayName: 'Recommendation', recommendedExercises: [], memberEquipment: ['bodyweight'], readiness: [] }
  const activeExercise = { ...bodyweight, id: 'prior-day-active', display_name: 'Squat', selected_variant_id: 'bodyweight', available_variants: [{ id: 'bodyweight', name: 'Squat', equipment: 'bodyweight', load_type: 'bodyweight', equipment_modifier: 1 }] }
  const storage = new Map([['aos-manual-builder:v1:DISPOSABLE-TEST:ignite:2026-10-12', JSON.stringify({ version: 1, activeExercise, completedExercises: [{ ...activeExercise, id: 'prior-day-complete', completion_status: 'Complete' }] })]])
  const app = mount(Builder, initialProps, storage); await app.flush()
  assert.equal(nodes(app.tree, n => n.props?.workoutSource === 'manual').length, 1)
  now = NativeDate.parse('2026-10-13T05:01:00Z'); app.render(); await app.flush()
  assert.equal(nodes(app.tree, n => n.props?.workoutSource === 'manual').length, 0)
  const nextDay = JSON.parse(storage.get('aos-manual-builder:v1:DISPOSABLE-TEST:ignite:2026-10-13'))
  assert.equal(nextDay.activeExercise, null); assert.deepEqual(nextDay.completedExercises, [])
})

test('manual set logger remounts its draft on local day change rather than carrying yesterday sets', async t => {
  const NativeDate = Date; let now = Date.parse('2026-10-13T04:59:00Z')
  globalThis.Date = class extends NativeDate { constructor(...args) { super(...(args.length ? args : [now])) } static now() { return now } }
  t.after(() => { globalThis.Date = NativeDate })
  const app = mount(Tracker, { ...props([{ ...bodyweight, id: 'manual-overnight' }]), workoutSource: 'manual' })
  button(app.tree, 'Set Done').props.onClick(); await app.flush()
  assert.equal(nodes(app.tree, n => n.props?.['data-testid'] === 'manual-set-history').length, 1)
  now = NativeDate.parse('2026-10-13T05:01:00Z'); app.render()
  assert.equal(nodes(app.tree, n => n.props?.['data-testid'] === 'manual-set-history').length, 0)
  assert.equal(button(app.tree, 'Finish Exercise').props.disabled, true)
})

test('manual equipment discovery preserves wildcard inventory and reaches loaded exercises', () => {
  assert.deepEqual(manualLibrary.normalizeEquipmentList(['*']), ['*'])
  assert.ok(manualLibrary.getAvailableEquipmentForMuscles(['quads']).includes('dumbbell'))
  const selected = manualLibrary.filterManualExercises({ muscles: ['quads'], equipment: ['dumbbell'] })
  assert.ok(selected.length)
  assert.ok(selected.every(exercise => exercise.available_variants.some(variant => variant.equipment === 'dumbbell')), 'An explicit equipment selection must not include bodyweight-only exercises')
})

test('workout view preferences preserve useful choices and ignore damaged browser data', () => {
  assert.deepEqual(preferences.parseWorkoutViewPreferences(JSON.stringify({ tab: 'history', mode: 'manual' })), { tab: 'history', mode: 'manual' })
  for (const value of ['not-json', null, '{"tab":"unknown","mode":"unknown"}']) assert.deepEqual(preferences.parseWorkoutViewPreferences(value), { tab: 'progress', mode: 'recommended' })
})

test('workout dashboard restores each client and tier preference before writing that scoped key', async () => {
  const firstKey = 'aos-workout-view:v1:DISPOSABLE-TEST:ignite', secondKey = 'aos-workout-view:v1:SECOND-DISPOSABLE-CLIENT:ember'
  const storage = new Map([[firstKey, JSON.stringify({ tab: 'history', mode: 'manual' })], [secondKey, JSON.stringify({ tab: 'strength', mode: 'recommended' })]])
  const initialProps = { ...props([]), assignedExercises: [], workoutHistory: [], workoutTitle: 'Fixture workout', assignedDayName: 'Fixture', hasSafetyFlags: false, logic: { workoutDecision: { canTrain: true, adjustmentLevel: 'level_0_full_plan' }, assessments: { dailyCompleted: false, strength: {} }, symptoms: { redFlag: false } } }
  const app = mount(Dashboard, initialProps, storage); await app.flush()
  assert.equal(button(app.tree, 'Build Your Own').props['aria-selected'], true)
  assert.equal(button(app.tree, 'History'), undefined)
  app.render({ ...initialProps, clientId: 'SECOND-DISPOSABLE-CLIENT', program: 'ember' })
  assert.deepEqual(JSON.parse(storage.get(secondKey)), { tab: 'strength', mode: 'recommended' }, 'The previous view must not overwrite the new scope during restoration')
  await app.flush()
  assert.equal(button(app.tree, 'Strength'), undefined)
  assert.equal(button(app.tree, 'Your Plan').props['aria-selected'], true)
  assert.deepEqual(JSON.parse(storage.get(firstKey)), { tab: 'history', mode: 'manual' })
})

test('workout history dates preserve date-only records and use the member timezone for timestamps', () => {
  assert.equal(logging.formatWorkoutHistoryDate('2026-11-01', 'America/Chicago'), 'Nov 1')
  assert.equal(logging.formatWorkoutHistoryDate('2026-11-01T02:00:00Z', 'America/Chicago'), 'Oct 31')
  assert.equal(logging.formatWorkoutHistoryDate('2026-11-01T02:00:00Z', 'Asia/Tokyo'), 'Nov 1')
  assert.equal(logging.formatWorkoutHistoryDate('invalid', 'America/Chicago'), 'Workout')
})

test('front muscle-map quadriceps pointer target is not covered by posterior hamstrings', () => {
  const selected = [], app = mount(MuscleMap, { readiness: [], onSelectMuscle: id => selected.push(id) })
  const polygons = nodes(app.tree, n => n.type === 'polygon')
  const quadriceps = polygons.find(n => n.props['data-muscle-id'] === 'left_quadriceps')
  assert.ok(quadriceps)
  const parsePoints = polygon => polygon.props.points.split(' ').map(pair => pair.split(',').map(Number))
  const quadPoints = parsePoints(quadriceps), xs = quadPoints.map(point => point[0]), ys = quadPoints.map(point => point[1])
  const point = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]
  function contains(polygon) {
    const points = parsePoints(polygon); let inside = false
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const [x, y] = points[i], [previousX, previousY] = points[j]
      if ((y > point[1]) !== (previousY > point[1]) && point[0] < (previousX - x) * (point[1] - y) / (previousY - y) + x) inside = !inside
    }
    return inside
  }
  const pointerTarget = polygons.filter(contains).at(-1)
  pointerTarget.props.onClick()
  assert.deepEqual(selected, ['left_quadriceps'])
  assert.equal(polygons.some(n => n.props['data-muscle-id'] === 'left_hamstrings'), false)
})

test('back muscle map preserves posterior choices and keyboard Enter/Space selection', () => {
  const selected = [], app = mount(MuscleMap, { readiness: [], onSelectMuscle: id => selected.push(id) })
  button(app.tree, 'Back').props.onClick(); app.render()
  const polygons = nodes(app.tree, n => n.type === 'polygon')
  assert.equal(polygons.some(n => n.props['data-muscle-id'] === 'left_quadriceps'), false)
  const hamstrings = polygons.find(n => n.props['data-muscle-id'] === 'left_hamstrings')
  assert.ok(hamstrings)
  const prevented = []
  for (const key of ['Enter', ' ', 'Escape']) hamstrings.props.onKeyDown({ key, preventDefault: () => prevented.push(key) })
  assert.deepEqual(selected, ['left_hamstrings', 'left_hamstrings'])
  assert.deepEqual(prevented, ['Enter', ' '])
  button(app.tree, 'Front').props.onClick(); app.render()
  assert.ok(nodes(app.tree, n => n.type === 'polygon' && n.props['data-muscle-id'] === 'left_quadriceps').length)
})

test('daily percentage follows all 25 retained sets through confirmation, edits, removal, reload and full completion', async () => {
  const storage = new Map(), exercises = [4, 3, 3, 3, 3, 3, 3, 3].map((sets, index) => ({ ...bodyweight, id: `daily-${index}`, sets }))
  let app = mount(ActivityTracker, props(exercises), storage); await app.flush()
  const card = index => nodes(app.tree, node => node.props?.className === 'activity-exercise')[index]
  assert.equal(progress(app.tree), 0)
  assert.doesNotMatch(content(app.tree), /exercises complete|prescribed sets recorded|needed for workout checkoff|Prescribed values are a starting point/)
  const amount = nodes(card(0), node => node.type === 'input')[0]
  amount.props.onChange({ target: { value: '0' } }); app.render()
  button(card(0), 'Complete set 1').props.onClick(); app.render()
  assert.equal(progress(app.tree), 0, 'unconfirmed and invalid values earn no progress')
  nodes(card(0), node => node.type === 'input')[0].props.onChange({ target: { value: '8' } }); app.render()
  button(card(0), 'Complete set 1').props.onClick(); app.render()
  assert.equal(progress(app.tree), 4)
  for (const [index, count] of [4, 3, 3, 3].entries()) {
    for (let n = index === 0 ? 2 : 1; n <= count; n++) { button(card(index), `Complete set ${n}`).props.onClick(); app.render() }
  }
  assert.equal(progress(app.tree), 52)
  button(app.tree, 'Save / pause').props.onClick(); await app.flush()
  assert.equal(app.calls.at(-1).payload.completed, true, '13 of 25 still earns halfway credit')
  const saved = app.calls.at(-1).payload
  storage.set('__disposableServer', JSON.stringify({ ...saved, updated_at: new Date().toISOString() }))
  app = mount(ActivityTracker, props(exercises.map(exercise => ({ ...exercise, sets: 1 }))), storage); await app.flush()
  assert.equal(progress(app.tree), 52, 'a refreshed projection cannot replace the retained denominator')
  const editor = nodes(card(0), node => typeof node.props?.onSave === 'function')[0]
  editor.props.onSave({ weight: 0, reps: 9 }); app.render()
  assert.equal(progress(app.tree), 52, 'correcting a valid set preserves its completed slot')
  button(card(0), 'Remove set 4').props.onClick(); app.render()
  assert.equal(progress(app.tree), 48)
  button(app.tree, 'Save / pause').props.onClick(); await app.flush()
  assert.equal(app.calls.at(-1).payload.completed, false, 'removal also preserves the existing credit calculation')
  button(card(0), 'Complete set 4').props.onClick(); app.render()
  for (let index = 4; index < exercises.length; index++) for (let n = 1; n <= 3; n++) { button(card(index), `Complete set ${n}`).props.onClick(); app.render() }
  assert.equal(progress(app.tree), 100)
  button(app.tree, 'Save / pause').props.onClick(); await app.flush()
  assert.equal(app.calls.at(-1).payload.planned_exercises.reduce((sum, exercise) => sum + exercise.sets, 0), 25)
})

test('incomplete work never rounds to 100 and duplicate or invalid evidence does not inflate percentage', async () => {
  const exercises = [0, 1].map(index => ({ ...bodyweight, id: `large-${index}`, sets: 100 }))
  const logs = exercises.map((exercise, index) => ({ ...exercise, session_key: `${exercise.id}:${index}`, set_logs: Array.from({ length: index ? 99 : 100 }, (_, n) => ({ set_number: n + 1, weight: 0, reps: 8, weight_unit: 'lb', completed_at: new Date().toISOString() })) }))
  logs[1].set_logs.push({ ...logs[1].set_logs[0] }, { set_number: 100, weight: 0, reps: 0, weight_unit: 'lb', completed_at: new Date().toISOString() })
  const storage = new Map([['__disposableServer', JSON.stringify({ planned_exercises: exercises, exercise_logs: logs, updated_at: new Date().toISOString() })]])
  const app = mount(ActivityTracker, props(exercises), storage); await app.flush()
  assert.equal(progress(app.tree), 99)
})

test('empty or unknown prescribed work has no invented percentage and manual activity has no daily-plan bar', async () => {
  for (const exercises of [[], [{ ...bodyweight, sets: 0 }], [{ ...bodyweight, sets: undefined }], [bodyweight, { ...bodyweight, id: 'unknown', sets: undefined }]]) {
    const app = mount(ActivityTracker, props(exercises)); await app.flush()
    assert.equal(progress(app.tree), undefined)
    assert.match(content(app.tree), /Workout progress unavailable/)
  }
  const manual = mount(ActivityTracker, { ...props([bodyweight]), workoutSource: 'manual' }); await manual.flush()
  button(manual.tree, 'Complete set 1').props.onClick(); manual.render()
  assert.equal(progress(manual.tree), undefined)
})

test('daily progress retains confirmed activity semantics without turning duration targets into fractions', async () => {
  const walk = { id: 'walk', exercise: 'Walking', exercise_category: 'cardio', duration_minutes: 10 }
  const app = mount(ActivityTracker, props([bodyweight, walk])); await app.flush()
  const card = () => nodes(app.tree, node => node.props?.className === 'activity-exercise')[1]
  nodes(card(), node => node.type === 'input')[0].props.onChange({ target: { value: '1' } }); app.render()
  assert.equal(progress(app.tree), 0)
  button(card(), 'Confirm activity').props.onClick(); app.render()
  assert.equal(progress(app.tree), 50, 'existing positive confirmed-duration semantics remain unchanged')
  button(card(), 'Edit activity').props.onClick(); app.render()
  assert.equal(progress(app.tree), 0)
  button(card(), 'Confirm activity').props.onClick(); app.render()
  button(app.tree, 'Complete set 1').props.onClick(); app.render()
  assert.equal(progress(app.tree), 100)
})

test('carousel moves focus out of a swiped-away card before making it inactive', async () => {
  const app = mount(ActivityTracker, props([bodyweight, { ...bodyweight, id: 'second' }])); await app.flush()
  const viewport = () => nodes(app.tree, node => node.props?.['aria-label'] === 'Exercise cards')[0]
  const focused = {}, focusCalls = [], track = { scrollTo() {}, clientWidth: 320, ownerDocument: { activeElement: focused }, children: [{ contains: node => node === focused }, { contains: () => false }], focus: options => focusCalls.push(options) }
  viewport().ref.current = track
  viewport().props.onScroll({ currentTarget: { clientWidth: 320, scrollLeft: 320 } }); app.render()
  assert.deepEqual(focusCalls, [{ preventScroll: true }])
  assert.match(content(app.tree), /Exercise 2 of 2/)
  chooseExercise(app.tree, 0); app.render()
  assert.equal(focusCalls.length, 1, 'pagination focus outside the track stays on its control')
})

test('equipment selector is visible on the card; exercise navigation remains carousel-only', async () => {
  const app = mount(ActivityTracker, props([{ ...bodyweight, load_type: 'total_load', selected_variant_id: null,
    available_variants: [{ id: 'bar', name: 'Barbell Hip Thrust' }, { id: 'smith', name: 'Smith Machine Hip Thrust' }] }, bodyweight]))
  await app.flush()
  assert.equal(nodes(app.tree, n => n.type === 'select' && n.props['aria-label'] === 'Choose exercise').length, 0)
  assert.equal(nodes(app.tree, n => n.type === 'select' && n.props['aria-label'] === 'Equipment').length, 1)
  assert.equal(nodes(app.tree, n => n.type === 'details' && content(n).includes('Equipment')).length, 0)
  assert.match(content(app.tree), /Exercise 1 of 2/)
  chooseExercise(app.tree, 1); app.render()
  assert.match(content(app.tree), /Exercise 2 of 2/)
})

test('hip thrust equipment changes in place, clears unverified load, and locks after a recorded set', async () => {
  const groups = JSON.parse(readFileSync('data/reference/exerciseVariants.json', 'utf8'))
  const variants = groups.find(group => group.pattern === 'hip_thrust').variants
  const hip = { id: 'hip', exercise: 'Smith Machine Hip Thrust', sets: 3, reps: 8, recommended_reps: 8,
    selected_variant_id: 'smith_hip_thrust', selected_variant_name: 'Smith Machine Hip Thrust', selected_equipment: 'smith', load_type: 'total_load',
    baseline_weight: 100, calculated_weight: 100, cycle_adjusted_weight: 100, recommended_weight: 100,
    cycle_weight_multiplier: 1, prescription_safety_multiplier: 1, available_variants: variants,
    prescription_calculation: { version: 'founder-load-v3', reference_exercise: 'Smith Machine Hip Thrust', assessment_key: 'RDL',
      bodyweight_factor: 0, body_mass_lb: 180, estimated_1rm: 125, rep_multiplier: .8,
      base_weight: 100, equipment_weight: 100, equipment_modifier: 1, selected_variant_id: 'smith_hip_thrust' } }
  const app = mount(ActivityTracker, props([bodyweight, hip])); await app.flush()
  chooseExercise(app.tree, 1); app.render()
  const select = () => nodes(app.tree, n => n.type === 'select' && n.props['aria-label'] === 'Equipment')[0]
  assert.equal(select().props.disabled, false)
  select().props.onChange({ target: { value: 'dumbbell_hip_thrust' } }); app.render()
  assert.equal(select().props.value, 'dumbbell_hip_thrust')
  assert.match(content(app.tree), /Exercise 2 of 2/)
  assert.ok(nodes(app.tree, n => n.type === 'h3' && content(n) === 'Dumbbell Hip Thrust').length)
  const card = nodes(app.tree, n => n.type === 'article' && n.props['aria-hidden'] === false)[0]
  const weightInput = nodes(card, n => n.type === 'input' && n.props.inputMode === 'decimal')[0]
  assert.equal(weightInput.props.value, '')
  assert.match(content(app.tree), /Load recommendation unavailable/)
  assert.equal(select().props.disabled, false)
  weightInput.props.onChange({ target: { value: '25' } }); app.render()
  const updatedCard = nodes(app.tree, n => n.type === 'article' && n.props['aria-hidden'] === false)[0]
  nodes(updatedCard, n => n.type === 'button' && content(n) === 'Complete set 1')[0].props.onClick(); app.render()
  assert.equal(select().props.disabled, true)
  assert.match(content(app.tree), /Equipment is locked after recording sets/)
})
