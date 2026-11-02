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
    render, button, calls, storage, focused, nativeDialog, tracker,
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

test('one accessible dialog shows equipment then all matching exercises, with optional family filter and Back', () => {
  const view = harness()
  view.open()
  assert.equal(view.nativeDialog.open, true)
  assert.equal(nodes(view.render(), node => node.type === 'dialog').length, 1)
  assert.equal(view.dialog.props['aria-labelledby'], 'manual-selection-title')
  assert.equal(view.dialog.props['aria-describedby'], 'manual-selection-description')
  assert.match(text(view.dialog), /Choose equipment/)
  assert.deepEqual(Array.from(view.focused[0]), ['left_pectoralis_major', 'right_pectoralis_major'])
  view.chooseEquipment()
  const expected = view.library.filterManualExercises({ muscles: ['chest'], equipment: ['dumbbell'] })
  assert.equal(nodes(view.render(), node => node.type === 'article').length, expected.length)
  assert.match(text(view.dialog), /All matching exercises/)
  assert.equal(nodes(view.render(), node => node.type === 'select')[0].props.value, '')
  view.filter('not-a-recorded-family')
  assert.match(text(view.dialog), /No matching exercises are available/)
  view.filter('')
  assert.equal(nodes(view.render(), node => node.type === 'article').length, expected.length)
  view.button('Back · change equipment').props.onClick();view.render()
  assert.match(text(view.dialog), /Choose equipment/)
  assert.equal(nodes(view.render(), node => node.props?.['data-testid'] === 'manual-exercise-results').length, 0)
  view.button('Close').props.onClick();view.render()
  assert.equal(view.nativeDialog.open, false);assert.equal(view.focusReturns, 1)
  view.open('right_pectoralis_major');assert.equal(view.escape(), true)
  assert.equal(view.focusReturns, 2);assert.equal(view.calls.length, 0)
})

test('equipment inventory filtering and existing no-overlap fallback are preserved without adding choices', () => {
  for (const inventory of [['dumbbells'], ['*'], ['not-present']]) {
    const view = harness({ memberEquipment: inventory });view.open()
    const derived = view.library.getAvailableEquipmentForMuscles(['chest']), member = view.library.normalizeEquipmentList(inventory)
    const overlap = derived.filter(item => member.includes(item))
    const expected = !member.length || member.includes('*') ? derived : overlap.length ? overlap : derived
    const list = nodes(view.render(), node => node.props?.['data-testid'] === 'manual-equipment-filter')[0]
    assert.deepEqual(Array.from(nodes(list, node => node.type === 'button'), node => text(node)), Array.from(expected, value => value.replaceAll('_', ' ').replace(/\b\w/g, char => char.toUpperCase())))
  }
})

test('selection waits for a confirmed immutable snapshot and strips generic browsing dose defaults for Tracker', async () => {
  const view = harness();view.open();view.chooseEquipment();view.choose();await view.settle()
  assert.equal(view.calls.length, 1);assert.equal(view.calls[0].url, '/api/workout/prescription')
  assert.equal(view.calls[0].options.credentials, 'same-origin');assert.equal(view.calls[0].options.cache, 'no-store')
  const active = view.tracker().props.exercises[0]
  assert.equal(view.nativeDialog.open, false)
  assert.equal(active.catalogExerciseId, view.calls[0].body.exerciseId)
  assert.notEqual(active.id, active.catalogExerciseId)
  assert.equal(Object.isFrozen(active.prescription), true)
  assert.equal(active.sets, 4);assert.equal(active.reps, 8);assert.equal(active.recommended_weight, 17.5);assert.equal(active.weight_unit, 'lb')
  const unguided = harness({ trackingOnly: true });unguided.open();unguided.chooseEquipment();unguided.choose();await unguided.settle()
  const manual = unguided.tracker().props.exercises[0]
  assert.equal(unguided.calls.length, 0);assert.equal(manual.recommendationStatus, 'tracking_only')
  for (const key of ['prescription', 'sets', 'reps', 'recommended_weight', 'calculated_weight', 'baseline_weight']) assert.equal(manual[key], undefined)
})

test('Close, equipment changes and newer selection fence late responses before they can create or overwrite logging', async () => {
  const view = harness(), pending = []
  view.setSend(call => { const item = deferred();pending.push({ ...item, call });return item.promise })
  view.open();view.chooseEquipment();view.choose()
  assert.match(text(view.dialog), /Loading your selected exercise recommendation/)
  assert.equal(view.tracker(), undefined)
  view.escape();assert.equal(view.calls[0].options.signal.aborted, true)
  pending[0].resolve(json(prescription(pending[0].call)));await view.settle();assert.equal(view.tracker(), undefined)
  view.open();view.chooseEquipment();view.choose()
  view.button('Back · change equipment').props.onClick();view.render();view.chooseEquipment();view.choose(1)
  pending[1].resolve(json(prescription(pending[1].call)));await view.settle();assert.equal(view.tracker(), undefined)
  pending[2].resolve(json(prescription(pending[2].call, { weightLb: 22.5 })));await view.settle()
  const active = view.tracker().props.exercises[0]
  assert.equal(active.catalogExerciseId, pending[2].call.body.exerciseId);assert.equal(active.prescription.weightLb, 22.5)
})

test('unavailable, blocked and transport failures remain honest and a blocked selection cannot continue', async () => {
  const missing = harness();missing.setSend(async () => json({ status: 'unavailable', message: 'Recommendation unavailable: save your assessment.', setupHref: '/dashboard/assessment/start2' }))
  missing.open();missing.chooseEquipment();missing.choose();await missing.settle()
  const noDose = missing.tracker().props.exercises[0]
  assert.equal(noDose.recommendationStatus, 'unavailable');assert.equal(noDose.recommendationSetupHref, '/dashboard/assessment/start2')
  assert.equal(noDose.sets, undefined);assert.equal(noDose.recommended_weight, undefined)
  const blocked = harness();blocked.setSend(async () => json({ status: 'blocked', message: 'Review your existing safety guidance.', setupHref: '/dashboard/recovery' }, false))
  blocked.open();blocked.chooseEquipment();blocked.choose();await blocked.settle()
  assert.equal(blocked.tracker(), undefined);assert.equal(blocked.nativeDialog.open, true)
  assert.match(text(blocked.dialog), /Review your existing safety guidance/)
  assert.equal(blocked.button('Continue without recommendation'), undefined)
  assert.equal(nodes(blocked.render(), node => node.type === 'a')[0].props.href, '/dashboard/recovery')
  const failed = harness();failed.setSend(async () => { throw new Error('synthetic transport failure') })
  failed.open();failed.chooseEquipment();failed.choose();await failed.settle()
  assert.match(text(failed.dialog), /Recommendation could not be loaded/)
  assert.equal(failed.button('Retry recommendation').props.disabled, false)
  failed.button('Continue without recommendation').props.onClick();failed.render()
  assert.equal(failed.tracker().props.exercises[0].recommendationStatus, 'unavailable')
})

test('restored drafts do not fetch or lose original planned values, and account changes invalidate pending selection', async () => {
  const view = harness(), source = view.library.getManualWorkoutLibrary()[0]
  view.storage.set(view.draftKey, JSON.stringify({ version: 1, activeExercise: { ...source, id: 'saved-occurrence', sets: 6, reps: 12 }, completedExercises: [] }))
  view.setProps({ authUserId: 'restoring-owner' })
  assert.equal(view.calls.length, 0)
  assert.equal(view.tracker().props.exercises[0].sets, 6)
  assert.equal(view.tracker().props.exercises[0].recommendationStatus, 'unavailable')
  const pendingView = harness(), response = deferred()
  pendingView.setSend(() => response.promise);pendingView.open();pendingView.chooseEquipment();pendingView.choose()
  pendingView.setProps({ clientId: 'different-owned-client', authUserId: 'different-owner' })
  assert.equal(pendingView.calls[0].options.signal.aborted, true)
  response.resolve(json(prescription(pendingView.calls[0])));await pendingView.settle()
  assert.equal(pendingView.tracker(), undefined)
  assert.equal(pendingView.nativeDialog.open, false)
})

test('explicit equipment choices retain the saved default and expose only supported session catalog variants', () => {
  const view = harness({ memberEquipment: [] });view.open()
  const saved = nodes(view.render(), node => node.props?.['data-testid'] === 'manual-equipment-filter')[0]
  assert.deepEqual(Array.from(nodes(saved, node => node.type === 'button'), node => text(node)), ['Bodyweight'])
  view.button('Use other equipment today').props.onClick();view.render()
  assert.match(text(view.dialog), /this session only/)
  const session = nodes(view.render(), node => node.props?.['data-testid'] === 'manual-session-equipment')[0]
  const expected = view.library.getSessionEquipmentForMuscles(['chest'])
  assert.deepEqual(Array.from(nodes(session, node => node.type === 'button'), node => text(node)).sort(), Array.from(expected, value => value[0].toUpperCase() + value.slice(1)).sort())
  assert.equal(view.button('Free weights'), undefined, 'Free weights is a heading, never a synthetic equipment choice.')
  assert.ok(nodes(session, node => node.type === 'h3' && text(node) === 'Free weights').length)
  assert.equal(view.button('Kettlebell'), undefined)
  assert.equal(view.button('Bodyweight'), undefined, 'No reference-backed bodyweight override is invented.')
  view.button('Use saved equipment').props.onClick();view.render()
  const again = nodes(view.render(), node => node.props?.['data-testid'] === 'manual-equipment-filter')[0]
  assert.deepEqual(Array.from(nodes(again, node => node.type === 'button'), node => text(node)), ['Bodyweight'])
  assert.deepEqual(view.props.memberEquipment, [])
})

test('session equipment context is sent once and retained in frozen prescription and restored active draft', async () => {
  const view = harness({ memberEquipment: [] });view.open();view.button('Use other equipment today').props.onClick();view.render()
  view.chooseEquipment('Dumbbell');view.choose();await view.settle()
  const call = view.calls[0], active = view.tracker().props.exercises[0]
  assert.deepEqual(call.body.equipmentContext, { source: 'session_override', equipment: 'dumbbell', variantId: call.body.variantId })
  assert.equal(active.selected_equipment, 'dumbbell');assert.equal(active.equipmentContext.equipment, 'dumbbell')
  assert.equal(Object.isFrozen(active.equipmentContext), true)
  assert.equal(Object.isFrozen(active.prescription.equipmentContext), true)
  assert.equal(active.prescription.equipmentContext.variantId, active.selected_variant_id)
  const restored = harness({ memberEquipment: [] }, view.storage), restoredActive = restored.tracker().props.exercises[0]
  assert.equal(restored.calls.length, 0);assert.equal(restoredActive.id, active.id)
  assert.equal(restoredActive.equipmentContext.equipment, 'dumbbell')
  assert.equal(Object.isFrozen(restoredActive.prescription.equipmentContext), true)
  assert.deepEqual(restored.props.memberEquipment, [])
})

test('session equipment context remains factual for Tracker and unavailable manual logging without creating guidance', async () => {
  for (const tracker of [true, false]) {
    const view = harness({ trackingOnly: tracker, memberEquipment: [] })
    view.setSend(async () => json({ status: 'unavailable', message: 'Recommendation unavailable for this variant.' }))
    view.open();view.button('Use other equipment today').props.onClick();view.render();view.chooseEquipment('Dumbbell');view.choose();await view.settle()
    const active = view.tracker().props.exercises[0]
    assert.equal(view.calls.length, tracker ? 0 : 1)
    assert.equal(active.equipmentContext.source, 'session_override');assert.equal(active.equipmentContext.equipment, 'dumbbell')
    assert.equal(active.prescription, undefined);assert.equal(active.sets, undefined);assert.equal(active.recommended_weight, undefined)
    assert.equal(active.recommendationStatus, tracker ? 'tracking_only' : 'unavailable')
    assert.deepEqual(view.props.memberEquipment, [])
  }
})

test('equipment mode changes fence stale requests and reject mismatched contexts while retaining blocked safety state', async () => {
  const view = harness({ memberEquipment: [] }), pending = []
  view.setSend(call => { const result = deferred();pending.push({ ...result, call });return result.promise })
  view.open();view.chooseEquipment('Bodyweight');view.choose()
  view.button('Back · change equipment').props.onClick();view.render();view.button('Use other equipment today').props.onClick();view.render()
  view.chooseEquipment('Dumbbell');view.choose()
  pending[0].resolve(json(prescription(pending[0].call)));await view.settle()
  assert.equal(view.tracker(), undefined);assert.equal(pending[0].call.options.signal.aborted, true)
  pending[1].resolve(json(prescription(pending[1].call, { equipmentContext: { source: 'session_override', equipment: 'machine', variantId: pending[1].call.body.variantId } })))
  await view.settle();assert.equal(view.tracker(), undefined);assert.match(text(view.dialog), /could not be loaded/)
  view.setSend(async () => json({ status: 'blocked', message: 'Review existing safety guidance.', setupHref: '/dashboard/recovery' }, false))
  view.button('Retry recommendation').props.onClick();await view.settle()
  assert.equal(view.tracker(), undefined);assert.equal(view.button('Continue without recommendation'), undefined)
  assert.match(text(view.dialog), /Review existing safety guidance/)
  view.escape();view.open()
  assert.ok(nodes(view.render(), node => node.props?.['data-testid'] === 'manual-equipment-filter').length)
  assert.equal(nodes(view.render(), node => node.props?.['data-testid'] === 'manual-session-equipment').length, 0)
})

test('Add cardio works without a selected muscle and routes duration-only manual choices through the same tracker', async () => {
  const view = harness();view.openCardio()
  assert.equal(view.nativeDialog.open, true);assert.match(text(view.dialog), /Choose cardio/)
  assert.match(text(view.dialog), /duration you actually complete/)
  assert.equal(nodes(view.dialog, node => node.props?.['data-testid'] === 'manual-equipment-filter').length, 0)
  const options = nodes(view.dialog, node => node.props?.['data-testid'] === 'manual-cardio-options')[0]
  assert.deepEqual(Array.from(nodes(options, node => node.type === 'button'), node => text(node)), ['Walking', 'Running', 'Cycling', 'Treadmill'])
  view.escape();assert.equal(view.focusReturns, 1);assert.equal(view.calls.length, 0)
  view.openCardio()
  const unit = nodes(view.dialog, node => node.type === 'select')[0]
  assert.equal(unit.props.value, 'minutes')
  unit.props.onChange({ target: { value: 'seconds' } });view.render()
  view.button('Cycling').props.onClick();view.render()
  const tracker = view.tracker(), active = tracker.props.exercises[0]
  assert.equal(view.calls.length, 0);assert.equal(tracker.props.dayName, 'Manual Cardio')
  assert.equal(active.manual_activity, 'cardio-duration-v1');assert.equal(active.duration_unit, 'seconds')
  assert.equal(tracker.props.plannedExercises[0].session_key, active.session_key)
  for (const key of ['prescription', 'sets', 'reps', 'recommended_weight', 'duration_minutes', 'duration_seconds']) assert.equal(active[key], undefined)
  const restored = harness({}, view.storage)
  assert.equal(restored.tracker().props.exercises[0].session_key, active.session_key);assert.equal(restored.calls.length, 0)
  assert.equal(restored.tracker().props.exercises[0].duration_unit, 'seconds')
  tracker.props.onManualExerciseFinished(false);view.render()
  assert.ok(view.button('Add cardio'));assert.match(text(view.render()), /Partial exercise saved.*Manual cardio/s)
})
