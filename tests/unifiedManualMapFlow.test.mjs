import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { resolve, dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const text = node => typeof node === 'string' || typeof node === 'number' ? String(node) : Array.isArray(node) ? node.map(text).join(' ') : node && typeof node === 'object' ? text(node.props?.children) : ''
const nodes = (tree, match) => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(child => nodes(child, match)) : [...(match(tree) ? [tree] : []), ...nodes(tree.props?.children, match)]
const deferred = () => { let resolve;const promise = new Promise(done => { resolve = done });return { promise, resolve } }
const json = (value, ok = true) => ({ ok, json: async () => value })
const prescription = (call, patch = {}) => ({ status: 'available', prescription: { exerciseId: call.body.exerciseId, variantId: call.body.variantId,
  sets: 4, reps: 8, weightLb: 17.5, loadType: 'per_hand', version: 'founder-selected-v1',
  ...(call.body.equipmentContext ? { equipmentContext: call.body.equipmentContext } : {}), ...patch } })
const clock = Date.parse('2026-11-02T18:00:00Z')
class FixedDate extends Date { constructor(...args) { super(...(args.length ? args : [clock])) } static now() { return clock } }

function harness(overrides = {}, initialStorage = new Map()) {
  const states = [], refs = [], effects = [], memo = [], modules = new Map(), storage = initialStorage, calls = [], focused = []
  let stateIndex = 0, refIndex = 0, effectIndex = 0, dirty = false, queued = [], tree, dialogNode, sends = 0
  let props = { clientId: 'synthetic-client', authUserId: 'synthetic-owner', program: 'ignite', timezone: 'America/Chicago', weightUnit: 'lb',
    recommendedDayName: 'Monday', recommendedExercises: [{ id: 'original-plan' }], memberEquipment: ['dumbbells'], readiness: [],
    onExerciseFocus: ids => focused.push(ids), ...overrides }
  let send = async call => json(prescription(call))
  const activeElement = { focusReturns: 0, focus() { this.focusReturns++ } }
  const react = {
    useId: () => 'manual-selection',
    useState(initial) { const index = stateIndex++;if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial
      return [states[index], value => { const next = typeof value === 'function' ? value(states[index]) : value;if (!Object.is(next, states[index])) { states[index] = next;dirty = true } }] },
    useRef(initial) { return refs[refIndex++] ||= { current: initial } },
    useMemo(callback) { return callback() },
    useEffect(callback, dependencies) { const index = effectIndex++, prior = effects[index]
      if (!prior || dependencies.some((value, i) => !Object.is(value, prior.dependencies[i]))) {
        queued.push(() => { prior?.cleanup?.();effects[index] = { dependencies, cleanup: callback() } })
      }
    },
  }
  const nativeDialog = { open: false, showModal() { this.open = true }, close() { if (!this.open) return;this.open = false;dialogNode?.props.onClose() } }
  function load(path) {
    path = resolve(path)
    if (modules.has(path)) return modules.get(path).exports
    if (path.endsWith('.json')) return JSON.parse(readFileSync(path, 'utf8'))
    const module = { exports: {} };modules.set(path, module)
    const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText
    runInNewContext(code, { module, exports: module.exports, Date: FixedDate, Error, Object, Number, Set, Map, AbortController,
      crypto: { randomUUID }, document: { activeElement }, localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
      fetch(url, options) { const call = { url, options, body: JSON.parse(options.body) };calls.push(call);sends++;return send(call, sends) },
      require(name) {
        if (name === 'react') return react
        if (name === 'next/link') return { __esModule: true, default: 'a' }
        if (name === '@/components/WorkoutTracker') return { __esModule: true, default: 'tracker' }
        if (name === '@/components/workout-dashboard/MuscleReadinessMap') return { __esModule: true, default: 'muscle-map' }
        if (name.endsWith('.module.css')) return { dialog: 'manual-dialog', header: 'manual-dialog-header', filter: 'manual-filter' }
        if (name === 'server-only') return {}
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
  const Builder = load('components/workout-dashboard/ManualWorkoutBuilder.tsx').default
  function render() {
    let loops = 0
    do {
      if (++loops > 8) throw new Error('Synthetic render did not settle')
      dirty = false;stateIndex = refIndex = effectIndex = 0;queued = []
      tree = Builder(props)
      dialogNode = nodes(tree, node => node.type === 'dialog')[0]
      if (dialogNode) dialogNode.ref.current = nativeDialog
      const heading = nodes(tree, node => node.type === 'h2' && node.ref)[0]
      if (heading) heading.ref.current = { focus() {} }
      const run = queued;queued = [];run.forEach(callback => callback())
    } while (dirty)
    return tree
  }
  const button = label => nodes(render(), node => node.type === 'button' && text(node) === label)[0]
  const map = () => nodes(render(), node => node.type === 'muscle-map')[0]
  const resultButtons = () => nodes(nodes(render(), node => node.props?.['data-testid'] === 'manual-exercise-results')[0], node => node.type === 'button')
  const tracker = () => nodes(render(), node => node.type === 'tracker')[0]
  return {
    render, button, calls, storage, focused, nativeDialog, tracker, map,
    library: load('lib/workout/manualWorkout.ts'), anatomy: load('lib/workout/muscleReadiness.ts'),
    get props() { return props }, get focusReturns() { return activeElement.focusReturns }, get dialog() { render();return dialogNode },
    get draftKey() { return `aos-manual-builder:v1:${props.clientId}:${props.program}:2026-11-02` },
    open(region = 'left_pectoralis_major') { map().props.onChooseExercises(region);render() },
    openCardio() { button('Add cardio').props.onClick({ currentTarget: activeElement });render() },
    chooseEquipment(name = 'Dumbbell') { button(name).props.onClick();render() },
    choose(index = 0) { const result = resultButtons()[index].props.onClick();render();return result },
    async settle() { await new Promise(resolve => setImmediate(resolve));render() },
    filter(value) { nodes(render(), node => node.type === 'select')[0].props.onChange({ target: { value } });render() },
    setSend(fn) { send = fn },
    setProps(next) { props = { ...props, ...next };render() },
    escape() { let prevented = false;dialogNode.props.onCancel({ preventDefault() { prevented = true } });render();return prevented },
    unmount() { for (const effect of effects) effect?.cleanup?.() },
  }
}

const mapCount = view => nodes(view.render(), node => node.type === 'muscle-map').length
const readiness = [
  { muscleId: 'left_pectoralis_major', state: 'ready', readinessScore: 94, reasons: ['Left-side logged recovery.'] },
  { muscleId: 'right_pectoralis_major', state: 'rest', readinessScore: 24, reasons: ['Right-side logged loading.'] },
]

test('one manual map remains available through selection, active logging and completion while exercise choice stays bilateral and cautious', async () => {
  const view = harness({ readiness })
  assert.equal(mapCount(view), 1)
  assert.equal(view.map().props.readiness, readiness)
  assert.equal(view.map().props.onSelectMuscle, undefined, 'Inspection does not invoke the exercise-selection callback.')
  assert.equal(typeof view.map().props.onChooseExercises, 'function')
  assert.equal(view.map().props.exerciseSelectionDisabled, false)
  assert.equal(view.nativeDialog.open, false)
  view.open('right_pectoralis_major')
  assert.equal(mapCount(view), 1)
  assert.deepEqual(Array.from(view.focused.at(-1)).sort(), ['left_pectoralis_major', 'right_pectoralis_major'])
  const context = nodes(view.dialog, node => node.props?.['data-testid'] === 'manual-readiness-context')[0]
  assert.match(text(context), /Recovery still accumulating/)
  assert.match(text(context), /Right pectoralis major/)
  assert.match(text(context), /Right-side logged loading/)
  assert.doesNotMatch(text(context), /Left-side logged recovery/)
  view.chooseEquipment();view.choose();await view.settle()
  const active = view.tracker().props.exercises[0]
  assert.equal(mapCount(view), 1)
  assert.equal(view.map().props.exerciseSelectionDisabled, true)
  assert.equal(view.map().props.readiness, readiness)
  assert.equal(active.prescription.sets, 4)
  assert.equal(Object.isFrozen(active.prescription), true)
  view.tracker().props.onManualExerciseFinished(false);view.render()
  assert.equal(mapCount(view), 1)
  assert.equal(view.map().props.exerciseSelectionDisabled, false)
  assert.match(text(view.render()), /Partial exercise saved/)
  assert.ok(view.button('Add another exercise'))
  view.open('left_pectoralis_major')
  assert.equal(view.nativeDialog.open, true, 'The persistent map can choose the next exercise without an extra Add-another step.')
  assert.equal(mapCount(view), 1)
  assert.match(text(view.render()), /Partial exercise saved/)
})

test('restored active drafts keep one inspectable map and server readiness refreshes do not reset the tracker or write new prescriptions', async () => {
  const first = harness({ readiness })
  first.open();first.chooseEquipment();first.choose();await first.settle()
  const original = first.tracker(), snapshot = JSON.stringify(original.props.exercises[0].prescription)
  const performedDraftKey = 'synthetic-existing-set-draft'
  first.storage.set(performedDraftKey, JSON.stringify({ weight: '21.5', reps: '7', sets: [{ weight: 20, reps: 8 }] }))
  const restored = harness({ readiness }, first.storage)
  const tracker = restored.tracker(), active = tracker.props.exercises[0]
  assert.equal(mapCount(restored), 1)
  assert.equal(restored.map().props.exerciseSelectionDisabled, true)
  assert.equal(JSON.stringify(active.prescription), snapshot)
  assert.equal(restored.calls.length, 0)
  const key = tracker.key, builderDraft = restored.storage.get(restored.draftKey), performedDraft = restored.storage.get(performedDraftKey)
  const refreshed = readiness.map(item => ({ ...item, readinessScore: item.readinessScore - 1 }))
  restored.setProps({ readiness: refreshed })
  assert.equal(mapCount(restored), 1)
  assert.equal(restored.map().props.readiness, refreshed)
  assert.equal(restored.tracker().key, key)
  assert.equal(JSON.stringify(restored.tracker().props.exercises[0].prescription), snapshot)
  assert.equal(restored.storage.get(restored.draftKey), builderDraft)
  assert.equal(restored.storage.get(performedDraftKey), performedDraft)
  assert.equal(restored.calls.length, 0, 'Viewing refreshed readiness cannot create a new recommendation or save the active exercise.')
  assert.equal(restored.nativeDialog.open, false)
})

test('equipment dialog Back, cancellation and reopen retain focus and supported session overrides; cardio still uses duration-only logging with the same map', async () => {
  const view = harness({ memberEquipment: [], readiness })
  view.open();assert.equal(mapCount(view), 1)
  view.button('Use other equipment today').props.onClick();view.render()
  view.chooseEquipment('Dumbbell')
  view.button('Back · change equipment').props.onClick();view.render()
  assert.match(text(view.dialog), /Choose equipment/)
  assert.equal(view.escape(), true);assert.equal(view.focusReturns, 1)
  assert.equal(view.nativeDialog.open, false);assert.equal(mapCount(view), 1)
  view.open('right_pectoralis_major')
  view.button('Use other equipment today').props.onClick();view.render()
  view.chooseEquipment('Dumbbell');view.choose();await view.settle()
  assert.equal(view.calls.length, 1)
  const call = view.calls[0], active = view.tracker().props.exercises[0]
  assert.deepEqual(call.body.equipmentContext, { source: 'session_override', equipment: 'dumbbell', variantId: call.body.variantId })
  assert.equal(active.equipmentContext.variantId, active.selected_variant_id)
  assert.equal(Object.isFrozen(active.prescription.equipmentContext), true)
  assert.deepEqual(view.props.memberEquipment, [])
  view.tracker().props.onManualExerciseFinished(true);view.render()
  view.openCardio();assert.equal(mapCount(view), 1)
  nodes(view.dialog, node => node.type === 'select')[0].props.onChange({ target: { value: 'seconds' } });view.render()
  view.button('Cycling').props.onClick();view.render()
  const cardio = view.tracker().props.exercises[0]
  assert.equal(mapCount(view), 1);assert.equal(view.map().props.exerciseSelectionDisabled, true)
  assert.equal(view.tracker().props.dayName, 'Manual Cardio')
  assert.equal(cardio.duration_unit, 'seconds');assert.equal(cardio.manual_activity, 'cardio-duration-v1')
  for (const key of ['sets', 'reps', 'prescription', 'recommended_weight']) assert.equal(cardio[key], undefined)
  assert.equal(view.calls.length, 1, 'Cardio does not request a strength prescription.')
})

test('Workout Recovery retains the truthful unavailable HR disclosure without another readiness map', () => {
  const source = readFileSync('components/workout-dashboard/WorkoutDashboard.tsx', 'utf8')
  const recoveryTab = source.slice(source.indexOf('function RecoveryTab'), source.indexOf('function HistoryTab'))
  assert.match(recoveryTab, /Heart-rate recovery · Unavailable/)
  assert.match(recoveryTab, /No timestamped heart-rate stream or continuous exercise\/rest intervals are connected to this session/)
  assert.doesNotMatch(source, /<MuscleReadinessMap|Muscle readiness details/)
  assert.match(source, /<ManualWorkoutBuilder/)
})
