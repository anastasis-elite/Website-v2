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
    const mock = specifier === 'react' ? 'export const useState=(...a)=>globalThis.workoutControlsHooks.useState(...a); export const useEffect=(...a)=>globalThis.workoutControlsHooks.useEffect(...a); export const useRef=(...a)=>globalThis.workoutControlsHooks.useRef(...a); export const useMemo=(...a)=>globalThis.workoutControlsHooks.useMemo(...a);' : specifier === 'next/navigation' ? 'export const useRouter=()=>({refresh(){}})' : specifier === 'next/image' ? "export default 'img'" : specifier === 'next/link' ? "export default 'a'" : ['@/components/workout-feedback/WorkoutFeedback', '@/components/legal/SafetyEscalationNotice'].includes(specifier) ? "export default 'aside'" : null
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
const button = (tree, label) => nodes(tree, n => n.type === 'button' && content(n) === label)[0]
const props = exercises => ({ clientId: 'DISPOSABLE-TEST', authUserId: 'disposable-user', program: 'ignite', dayName: 'Control regression', exercises, timezone: 'America/Chicago' })
const bodyweight = { id: 'squat', exercise: 'Squat', exercise_category: 'strength', sets: 1, reps: 8, load_type: 'bodyweight' }

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
  const select = nodes(app.tree, n => n.type === 'select')[0]
  assert.equal(select.props.value, '')
  assert.equal(nodes(select, n => n.type === 'option' && n.props.value === '').length, 1)
})

test('repeated exercises have distinct visible occurrence labels and independent progress', async () => {
  const app = mount(ActivityTracker, props([bodyweight, { ...bodyweight, reps: 10 }]))
  await app.flush()
  const headings = nodes(app.tree, n => n.type === 'h3').map(content)
  assert.equal(new Set(headings).size, 2)
  button(app.tree, 'Complete set 1').props.onClick(); app.render()
  assert.match(content(app.tree), /1 of 2 exercises complete/)
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
  assert.match(content(reloaded.tree), /1 of 2 exercises complete/)
  button(reloaded.tree, 'Complete set 1').props.onClick(); reloaded.render()
  button(reloaded.tree, 'Finish and review').props.onClick(); await reloaded.flush()
  assert.deepEqual(reloaded.calls.at(-1).payload.exercise_logs.map(log => log.set_logs[0].reps), [8, 10])
  const revisited = mount(ActivityTracker, props(exercises), storage); await revisited.flush()
  assert.match(content(revisited.tree), /2 of 2 exercises complete/)
})

test('manual builder resumes the same exercise occurrence after reload and picks the selected equipment', async () => {
  const storage = new Map(), builderProps = { ...props([]), recommendedDayName: 'Recommendation', recommendedExercises: [], memberEquipment: ['dumbbell'], readiness: [] }
  const app = mount(Builder, builderProps, storage); await app.flush()
  nodes(app.tree, n => typeof n.props?.onSelectMuscle === 'function')[0].props.onSelectMuscle('left_quadriceps'); app.render()
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
  nodes(app.tree, n => typeof n.props?.onSelectMuscle === 'function')[0].props.onSelectMuscle('left_quadriceps'); app.render()
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
  const initialProps = { ...props([]), assignedExercises: [], workoutHistory: [], workoutTitle: 'Fixture workout', assignedDayName: 'Fixture', hasSafetyFlags: false, logic: { workoutDecision: { canTrain: true, adjustmentLevel: 'level_0_full_plan' }, assessments: { dailyCompleted: false }, symptoms: { redFlag: false } } }
  const app = mount(Dashboard, initialProps, storage); await app.flush()
  assert.equal(button(app.tree, 'History').props['aria-selected'], true)
  app.render({ ...initialProps, clientId: 'SECOND-DISPOSABLE-CLIENT', program: 'ember' })
  assert.deepEqual(JSON.parse(storage.get(secondKey)), { tab: 'strength', mode: 'recommended' }, 'The previous view must not overwrite the new scope during restoration')
  await app.flush()
  assert.equal(button(app.tree, 'Strength').props['aria-selected'], true)
  assert.equal(button(app.tree, 'Recommended').props['aria-selected'], true)
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
