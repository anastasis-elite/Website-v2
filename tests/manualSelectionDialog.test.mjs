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
let clock = Date.parse('2026-11-02T18:00:00Z')
class FixedDate extends Date { constructor(...args) { super(...(args.length ? args : [clock])) } static now() { return clock } }

function harness(overrides = {}, initialStorage = new Map()) {
  const states = [], mapStates = [], refs = [], effects = [], memo = [], modules = new Map(), storage = initialStorage, calls = [], summaryCalls = [], focused = [], headingFocusTexts = []
  let renderingMap = false, mapStateIndex = 0
  let stateIndex = 0, refIndex = 0, effectIndex = 0, dirty = false, queued = [], tree, dialogNode, sends = 0, mapFocusReturns = 0
  let props = { clientId: 'synthetic-client', authUserId: 'synthetic-owner', program: 'ignite', timezone: 'America/Chicago', weightUnit: 'lb',
    recommendedDayName: 'Monday', recommendedExercises: [{ id: 'original-plan' }], memberEquipment: ['dumbbells'], readiness: [],
    onExerciseFocus: ids => focused.push(ids), ...overrides }
  let send = async call => json(prescription(call))
  let summarySend = async () => json({ version: 1, clientId: props.clientId, authUserId: props.authUserId, program: props.program, date: '2026-11-02', sessions: [], completed: false })
  const activeElement = { focusReturns: 0, focus() { this.focusReturns++ } }
  const react = {
    useId: () => 'manual-selection',
    useState(initial) { const values = renderingMap ? mapStates : states, index = renderingMap ? mapStateIndex++ : stateIndex++
      if (!(index in values)) values[index] = typeof initial === 'function' ? initial() : initial
      return [values[index], value => { const next = typeof value === 'function' ? value(values[index]) : value;if (!Object.is(next, values[index])) { values[index] = next;dirty = true } }] },
    useRef(initial) { return refs[refIndex++] ||= { current: initial } },
    useMemo(callback) { return callback() },
    useEffect(callback, dependencies) { const index = effectIndex++, prior = effects[index]
      if (!prior || dependencies.some((value, i) => !Object.is(value, prior.dependencies[i]))) {
        queued.push(() => { prior?.cleanup?.();effects[index] = { dependencies, cleanup: callback() } })
      }
    },
  }
  const nativeDialog = { open: false, shows: 0, showModal() { this.shows++;this.open = true }, close() { if (!this.open) return;this.open = false;dialogNode?.props.onClose() } }
  function load(path) {
    path = resolve(path)
    if (modules.has(path)) return modules.get(path).exports
    if (path.endsWith('.json')) return JSON.parse(readFileSync(path, 'utf8'))
    const module = { exports: {} };modules.set(path, module)
    const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText
    runInNewContext(code, { module, exports: module.exports, Date: FixedDate, Error, Object, Number, Set, Map, AbortController, URLSearchParams,
      crypto: { randomUUID }, document: { activeElement }, localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
      fetch(url, options) {
        if (options.method === 'GET') { const call = { url, options };summaryCalls.push(call);return summarySend(call) }
        const call = { url, options, body: JSON.parse(options.body) };calls.push(call);sends++;return send(call, sends)
      },
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
      if (heading) heading.ref.current = { focus() { headingFocusTexts.push(text(heading)) } }
      const mapContainer = nodes(tree, node => node.props?.['data-testid'] === 'manual-readiness-map')[0]
      if (mapContainer) mapContainer.ref.current = { focus() { mapFocusReturns++ }, querySelector() { return activeElement } }
      const run = queued;queued = [];run.forEach(callback => callback())
    } while (dirty)
    return tree
  }
  const button = label => nodes(render(), node => node.type === 'button' && text(node) === label)[0]
  const map = () => nodes(render(), node => node.type === 'muscle-map')[0]
  const MapComponent = load('components/workout-dashboard/MuscleReadinessMap.tsx').default
  function mapTree() {
    const props = map().props
    renderingMap = true;mapStateIndex = 0
    try { return MapComponent(props) } finally { renderingMap = false }
  }
  function activateRegion(id, key, repeat = false) {
    const region = nodes(mapTree(), node => node.props?.['data-muscle-id'] === id)[0]
    if (!region) throw new Error(`Missing map region ${id}`)
    const target = { focusReturns: 0, focus() { this.focusReturns++;region.props.onFocus() } }
    const event = { currentTarget: target, key, repeat, preventDefault() {} }
    if (key) region.props.onKeyDown(event);else region.props.onClick(event)
    render();return target
  }
  const resultButtons = () => nodes(nodes(render(), node => node.props?.['data-testid'] === 'manual-exercise-results')[0], node => node.type === 'button')
  const tracker = () => nodes(render(), node => node.type === 'tracker')[0]
  return {
    render, button, calls, summaryCalls, storage, focused, nativeDialog, tracker, mapTree, activateRegion, headingFocusTexts,
    library: load('lib/workout/manualWorkout.ts'), anatomy: load('lib/workout/muscleReadiness.ts'),
    get props() { return props }, get focusReturns() { return activeElement.focusReturns }, get dialog() { render();return dialogNode },
    get mapFocusReturns() { return mapFocusReturns },
    get draftKey() { return `aos-manual-builder:v1:${props.clientId}:${props.program}:2026-11-02` },
    open(region = 'left_pectoralis_major') { map().props.onChooseExercises(region);render() },
    openCardio() { button('Add cardio').props.onClick({ currentTarget: activeElement });render() },
    chooseEquipment(name = 'Dumbbell') { button(name).props.onClick();render() },
    choose(index = 0) { const result = resultButtons()[index].props.onClick();render();return result },
    async settle() { await new Promise(resolve => setImmediate(resolve));render() },
    filter(value) { nodes(render(), node => node.type === 'select')[0].props.onChange({ target: { value } });render() },
    setSend(fn) { send = fn },
    setSummarySend(fn) { summarySend = fn },
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

test('actual muscle activation opens the same equipment dialog after the current heading commits, without adding or saving', () => {
  const view = harness({ readiness: [
    { muscleId: 'left_pectoralis_major', state: 'ready', readinessScore: 95, reasons: ['Left side ready.'] },
    { muscleId: 'right_pectoralis_major', state: 'rest', readinessScore: 10, reasons: ['Right side still recovering.'] },
  ] })
  view.render();const draftBefore = view.storage.get(view.draftKey)
  const target = view.activateRegion('left_pectoralis_major')
  assert.equal(view.nativeDialog.open, true);assert.equal(view.nativeDialog.shows, 1)
  assert.equal(nodes(view.render(), node => node.type === 'dialog').length, 1)
  assert.equal(view.headingFocusTexts.at(-1), 'Chest · Choose equipment')
  assert.match(text(view.dialog), /Right pectoralis major: Right side still recovering/)
  assert.deepEqual(Array.from(view.focused.at(-1)), ['left_pectoralis_major', 'right_pectoralis_major'])
  for (const id of ['left_pectoralis_major', 'right_pectoralis_major']) assert.equal(nodes(view.mapTree(), node => node.props?.['data-muscle-id'] === id)[0].props['data-exercise-selected'], 'true')
  view.chooseEquipment()
  assert.match(text(view.dialog), /Dumbbell\s+exercises/)
  assert.equal(nodes(view.render(), node => node.type === 'article').length, view.library.filterManualExercises({ muscles: ['chest'], equipment: ['dumbbell'] }).length)
  view.button('Back · change equipment').props.onClick();view.render()
  assert.match(text(view.dialog), /Chest.*Choose equipment/)
  view.button('Close').props.onClick();view.render()
  assert.equal(view.nativeDialog.open, false);assert.equal(target.focusReturns, 1)
  assert.equal(view.nativeDialog.shows, 1, 'Returning focus to the muscle must not reopen the dialog')
  assert.equal(view.calls.length, 0);assert.equal(view.tracker(), undefined)
  assert.equal(view.storage.get(view.draftKey), draftBefore)
})

test('keyboard and repeated real-map selections reopen current muscle data once, while focus and held keys do not open', () => {
  const view = harness()
  const region = nodes(view.mapTree(), node => node.props?.['data-muscle-id'] === 'left_biceps')[0]
  region.props.onFocus();view.render()
  assert.equal(view.nativeDialog.open, false);assert.equal(view.calls.length, 0)
  view.activateRegion('left_biceps', 'Enter', true)
  assert.equal(view.nativeDialog.open, false)
  const first = view.activateRegion('left_biceps', 'Enter')
  assert.equal(view.nativeDialog.shows, 1);assert.equal(view.headingFocusTexts.at(-1), 'Biceps · Choose equipment')
  assert.equal(view.escape(), true);assert.equal(first.focusReturns, 1);assert.equal(view.nativeDialog.open, false)
  view.activateRegion('left_biceps', ' ')
  assert.equal(view.nativeDialog.shows, 2);assert.equal(view.headingFocusTexts.at(-1), 'Biceps · Choose equipment')
  view.chooseEquipment()
  const replacement = view.activateRegion('right_pectoralis_major')
  assert.equal(view.nativeDialog.shows, 2, 'A queued newer muscle activation reuses the open dialog')
  assert.match(text(view.dialog), /Chest.*Choose equipment/)
  assert.equal(nodes(view.render(), node => node.props?.['data-testid'] === 'manual-exercise-results').length, 0)
  view.escape();assert.equal(replacement.focusReturns, 1);assert.equal(view.nativeDialog.open, false)
  assert.equal(view.nativeDialog.shows, 2);assert.equal(view.calls.length, 0)
})

test('real-map activation inspects an active draft without replacing it, and picker dismissal preserves saved completed exercises', () => {
  const seed = harness(), source = seed.library.getManualWorkoutLibrary()[0]
  const active = { ...source, id: 'saved-occurrence', sets: 6, reps: 12 }
  const completed = [{ ...source, id: 'saved-completed', completion_status: 'Complete' }]
  const view = harness({}, new Map([[seed.draftKey, JSON.stringify({ version: 1, activeExercise: active, completedExercises: completed })]]))
  view.render();const activeBefore = JSON.stringify(view.tracker().props.exercises[0]), draftBefore = view.storage.get(view.draftKey)
  view.activateRegion('right_pectoralis_major', 'Enter')
  assert.equal(view.nativeDialog.open, false);assert.equal(view.nativeDialog.shows, 0)
  assert.equal(JSON.stringify(view.tracker().props.exercises[0]), activeBefore)
  assert.match(text(view.mapTree()), /Your active exercise stays open/)
  assert.equal(view.storage.get(view.draftKey), draftBefore);assert.equal(view.calls.length, 0)
  const finished = harness({}, new Map([[seed.draftKey, JSON.stringify({ version: 1, activeExercise: null, completedExercises: completed })]]))
  finished.render();const completedBefore = finished.storage.get(finished.draftKey)
  finished.activateRegion('left_biceps');assert.equal(finished.nativeDialog.open, true)
  finished.escape();assert.equal(finished.nativeDialog.open, false)
  assert.equal(finished.storage.get(finished.draftKey), completedBefore)
  assert.equal(nodes(finished.render(), node => node.type === 'li').length, 1)
  assert.equal(finished.calls.length, 0)
})

// Finish uses the real Builder with synthetic authenticated read responses. The
// server/API and tracker tests separately verify the evidence behind this data.
function savedFinishSummary(view, exercise, { completed = true, signature = 'saved-actuals', cardio = false } = {}) {
  return { version: 1, clientId: view.props.clientId, authUserId: view.props.authUserId, program: view.props.program, date: '2026-11-02', completed,
    sessions: [{ id: 'saved-row', dayName: cardio ? 'Manual Cardio' : 'Manual Workout', updatedAt: '2026-11-02T17:59:00Z', completed,
      progress: { completedSets: completed ? 2 : 1, totalSets: 4, requiredSets: 2 },
      exercises: [{ id: exercise.id, name: exercise.exercise, signature, kind: cardio ? 'cardio' : 'strength', completed,
        plannedSets: cardio ? 0 : 4, setLogs: cardio ? [] : [{ setNumber: 1, reps: 8, weight: 17.5, unit: 'lb', completedAt: '2026-11-02T17:58:00Z' }],
        duration: cardio ? 12 : null, durationUnit: cardio ? 'minutes' : null }] }] }
}
async function finishableView() {
  const view = harness();view.open();view.chooseEquipment();view.choose();await view.settle()
  const exercise = view.tracker().props.exercises[0]
  const evidence = { workoutLogId: 'saved-row', exerciseId: exercise.id, dayName: 'Manual Workout', signature: 'saved-actuals' }
  view.tracker().props.onManualExerciseFinished(false, evidence);view.render()
  return { view, exercise, evidence }
}

test('Finish reads confirmed actuals and opens a distinct saved state without another workout write', async () => {
  const { view, exercise } = await finishableView(), before = view.calls.length
  view.setSummarySend(async () => json(savedFinishSummary(view, exercise)))
  view.button('Finish workout').props.onClick();await view.settle()
  assert.equal(nodes(view.render(), node => node.props?.['data-testid'] === 'manual-workout-finished').length, 1)
  assert.match(text(view.render()), /Workout saved/);assert.match(text(view.render()), /8\s+reps ·\s+17.5\s+lb/)
  assert.match(text(view.render()), /2\s+of\s+4\s+original prescribed sets recorded ·\s+2\s+needed/)
  assert.equal(view.button('Finish workout'), undefined);assert.equal(view.calls.length, before)
  const read = view.summaryCalls.at(-1)
  assert.match(read.url, /manualSummary=1/);assert.equal(read.options.credentials, 'same-origin');assert.equal(read.options.cache, 'no-store')
  assert.equal(nodes(view.render(), node => node.type === 'a' && node.props.href === '/dashboard').length, 1)
})

test('Finish below the original 50 percent threshold stays a partial saved session', async () => {
  const { view, exercise } = await finishableView()
  view.setSummarySend(async () => json(savedFinishSummary(view, exercise, { completed: false })))
  view.button('Finish workout').props.onClick();await view.settle()
  assert.match(text(view.render()), /Partial workout saved/)
  assert.match(text(view.render()), /Finishing does not add completed credit/)
  assert.match(text(view.render()), /1\s+of\s+4\s+original prescribed sets/)
  assert.doesNotMatch(text(view.render()), /Checkoff threshold met/)
})

test('Finish pending reads deduplicate clicks and cancellation fences late confirmation while retaining the draft', async () => {
  const { view, exercise } = await finishableView(), pending = deferred(), before = view.summaryCalls.length
  view.setSummarySend(() => pending.promise)
  const click = view.button('Finish workout').props.onClick
  click();click();view.render()
  assert.equal(view.summaryCalls.length, before + 1)
  assert.equal(view.button('Checking saved workout…').props.disabled, true)
  assert.equal(nodes(view.render(), node => node.props?.['data-testid'] === 'manual-workout-finished').length, 0)
  view.button('Cancel check').props.onClick();view.render()
  assert.equal(view.summaryCalls.at(-1).options.signal.aborted, true)
  pending.resolve(json(savedFinishSummary(view, exercise)));await view.settle()
  assert.equal(nodes(view.render(), node => node.props?.['data-testid'] === 'manual-workout-finished').length, 0)
  assert.ok(JSON.parse(view.storage.get(view.draftKey)).completedExercises.some(item => item.id === exercise.id))
  view.setSummarySend(async () => json(savedFinishSummary(view, exercise)))
  view.button('Finish workout').props.onClick();await view.settle();assert.match(text(view.render()), /Workout saved/)
})

test('Finish save-read failures and mismatched receipts retain local work and permit an explicit successful retry', async () => {
  const { view, exercise } = await finishableView()
  view.setSummarySend(async () => { throw new Error('private transport detail') })
  view.button('Finish workout').props.onClick();await view.settle()
  assert.match(text(view.render()), /could not be confirmed/);assert.doesNotMatch(text(view.render()), /private transport/)
  view.setSummarySend(async () => json(savedFinishSummary(view, exercise, { signature: 'older-actuals' })))
  view.button('Retry saved workout').props.onClick();await view.settle()
  assert.equal(nodes(view.render(), node => node.props?.['data-testid'] === 'manual-workout-finished').length, 0)
  view.setSummarySend(async () => json(savedFinishSummary(view, exercise)))
  view.button('Retry saved workout').props.onClick();await view.settle()
  assert.match(text(view.render()), /Workout saved/)
})

test('Finish reload restores the saved server actuals and classification without a browser finished flag', async () => {
  const view = harness(), exercise = { id: 'existing-occurrence', exercise: 'Saved exercise' }
  view.setSummarySend(async () => json(savedFinishSummary(view, exercise, { completed: false })))
  view.render();await view.settle()
  assert.match(text(view.render()), /Partial workout saved/);assert.match(text(view.render()), /8\s+reps ·\s+17.5\s+lb/)
  assert.equal(view.calls.length, 0)
  assert.equal(JSON.parse(view.storage.get(view.draftKey)).completedExercises.length, 0)
  view.button('Add another exercise').props.onClick();view.render();assert.ok(view.button('Add cardio'))
})

test('Finish stale account responses cannot restore another account summary or accept its old child callback', async () => {
  const { view, exercise } = await finishableView(), pending = deferred()
  view.setSummarySend(() => pending.promise);view.button('Finish workout').props.onClick();view.render()
  const oldSummary = savedFinishSummary(view, exercise)
  view.setSummarySend(async () => json({ ...savedFinishSummary(view, exercise), sessions: [], completed: false, authUserId: 'next-owner', clientId: 'next-client' }))
  view.setProps({ authUserId: 'next-owner', clientId: 'next-client' })
  pending.resolve(json(oldSummary));await view.settle()
  assert.equal(nodes(view.render(), node => node.props?.['data-testid'] === 'manual-workout-finished').length, 0)
  assert.doesNotMatch(text(view.render()), /Saved exercise|8 reps/)
  const active = harness();active.open();active.chooseEquipment();active.choose();await active.settle()
  const staleCallback = active.tracker().props.onManualExerciseFinished
  active.setProps({ authUserId: 'another-owner', clientId: 'another-client' })
  staleCallback(true, { workoutLogId: 'old-row', exerciseId: 'old-occurrence', dayName: 'Manual Workout', signature: 'old' });await active.settle()
  assert.equal(JSON.parse(active.storage.get(active.draftKey)).completedExercises.length, 0)
})

test('Finish day rollover refuses late confirmation and asks to reopen the saved day', async () => {
  const { view, exercise } = await finishableView(), pending = deferred()
  view.setSummarySend(() => pending.promise);view.button('Finish workout').props.onClick();view.render()
  try {
    clock = Date.parse('2026-11-03T18:00:00Z')
    pending.resolve(json(savedFinishSummary(view, exercise)));await view.settle()
    assert.equal(nodes(view.render(), node => node.props?.['data-testid'] === 'manual-workout-finished').length, 0)
    await view.settle()
    assert.doesNotMatch(text(view.render()), /Checkoff threshold met/)
    assert.ok(view.storage.has('aos-manual-builder:v1:synthetic-client:ignite:2026-11-02'))
  } finally { clock = Date.parse('2026-11-02T18:00:00Z') }
})

test('Finish restoration does not interrupt an active draft or a picker opened during the saved-record read', async () => {
  const view = harness(), pending = deferred(), exercise = { id: 'older', exercise: 'Older saved work' }
  view.setSummarySend(() => pending.promise);view.render();view.open();view.chooseEquipment();view.choose();await view.settle()
  const activeId = view.tracker().props.exercises[0].id
  pending.resolve(json(savedFinishSummary(view, exercise)));await view.settle()
  assert.equal(view.tracker().props.exercises[0].id, activeId)
  assert.equal(nodes(view.render(), node => node.props?.['data-testid'] === 'manual-workout-finished').length, 0)
  const restored = harness({}, view.storage)
  restored.setSummarySend(async () => json(savedFinishSummary(restored, exercise)));restored.render();await restored.settle()
  assert.equal(restored.tracker().props.exercises[0].id, activeId)
})

test('Finish remains reachable after reopening and dismissing the muscle picker without adding an exercise', async () => {
  const { view, exercise } = await finishableView()
  view.open();view.escape()
  assert.ok(view.button('Finish workout'));assert.equal(view.tracker(), undefined)
  view.setSummarySend(async () => json(savedFinishSummary(view, exercise)))
  view.button('Finish workout').props.onClick();await view.settle();assert.match(text(view.render()), /Workout saved/)
})

test('Finish cannot turn empty or unconfirmed saved evidence into a finished state', async () => {
  const { view } = await finishableView()
  for (const result of [{ success: true }, { version: 1, clientId: view.props.clientId, authUserId: view.props.authUserId, program: view.props.program, date: '2026-11-02', sessions: [], completed: false }]) {
    view.setSummarySend(async () => json(result));view.button('Finish workout').props.onClick();await view.settle()
    assert.equal(nodes(view.render(), node => node.props?.['data-testid'] === 'manual-workout-finished').length, 0)
    assert.match(text(view.render()), /could not be confirmed/)
  }
})

test('Finish cardio restoration shows actual duration without strength sets or invented credit', async () => {
  const view = harness(), exercise = { id: 'manual-cardio:walking:synthetic', exercise: 'Walking' }
  view.setSummarySend(async () => json(savedFinishSummary(view, exercise, { cardio: true, completed: false })))
  view.render();await view.settle()
  assert.match(text(view.render()), /Partial workout saved/);assert.match(text(view.render()), /Recorded duration:\s+12\s+minutes/)
  assert.doesNotMatch(text(view.render()), /prescribed sets|reps ·|original prescribed units/)
})

test('Change exercise durably abandons an untouched occurrence without credit, preserves other entries and requests a fresh recommendation', async () => {
  const seed = harness(), source = seed.library.getManualWorkoutLibrary()[0]
  const completed = [{ ...source, id: 'earlier-saved-occurrence', completion_status: 'Partial exercise saved' }]
  const view = harness({}, new Map([[seed.draftKey, JSON.stringify({ version: 1, activeExercise: null, completedExercises: completed })]]))
  view.open();view.chooseEquipment();view.choose();await view.settle()
  const original = view.tracker().props.exercises[0], plan = view.tracker().props.plannedExercises
  const change = view.tracker().props.onManualExerciseChange, beforeCalls = view.calls.length
  assert.equal(change(), true)
  const handoff = JSON.parse(view.storage.get(view.draftKey))
  assert.equal(handoff.activeExercise, null, 'The handoff is durable before React renders or the logger cleans its draft')
  assert.deepEqual(handoff.completedExercises, JSON.parse(JSON.stringify(completed)), 'An abandoned choice grants no completion and preserves earlier exercises')
  assert.equal(change(), false, 'Repeated activation cannot duplicate work')
  view.render()
  assert.equal(view.tracker(), undefined);assert.equal(view.calls.length, beforeCalls)
  assert.equal(view.nativeDialog.open, true)
  assert.equal(view.headingFocusTexts.at(-1), 'Chest · Choose exercise')
  assert.ok(view.button('Change muscle'));assert.ok(view.button('Back · change equipment'))
  view.setSend(async call => json(prescription(call, { sets: 6, reps: 11, weightLb: 25 })))
  view.choose(1);await view.settle()
  const replacement = view.tracker().props.exercises[0]
  assert.notEqual(replacement.id, original.id);assert.notEqual(replacement.catalogExerciseId, original.catalogExerciseId)
  assert.equal(view.calls.length, beforeCalls + 1)
  assert.equal(replacement.prescription.exerciseId, replacement.catalogExerciseId)
  assert.equal(replacement.prescription.variantId, replacement.selected_variant_id)
  assert.equal(replacement.prescription.weightLb, 25);assert.equal(replacement.reps, 11);assert.equal(replacement.sets, 6)
  assert.equal(replacement.equipmentContext, undefined);assert.equal(replacement.set_logs, undefined)
  assert.equal(view.tracker().props.plannedExercises, plan)
  assert.deepEqual(JSON.parse(view.storage.get(view.draftKey)).completedExercises, JSON.parse(JSON.stringify(completed)))
})

test('Change exercise preserves verified partial work under the original occurrence before opening the next picker', async () => {
  const view = harness();view.open();view.chooseEquipment();view.choose();await view.settle()
  const original = view.tracker().props.exercises[0]
  const evidence = { exerciseId: original.id, workoutLogId: 'synthetic-saved-row', dayName: 'Manual Workout', signature: 'verified-synthetic-actuals' }
  const change = view.tracker().props.onManualExerciseChange
  assert.equal(change(false, evidence), true)
  const persisted = JSON.parse(view.storage.get(view.draftKey)), saved = persisted.completedExercises[0]
  assert.equal(persisted.activeExercise, null);assert.equal(saved.id, original.id)
  assert.equal(saved.catalogExerciseId, original.catalogExerciseId);assert.equal(saved.selected_variant_id, original.selected_variant_id)
  assert.equal(saved.completion_status, 'Partial exercise saved');assert.deepEqual(saved.saveEvidence, evidence)
  assert.equal(saved.sets, 4, 'Changing exercises does not lower the original target')
  assert.equal(change(false, evidence), false)
  const reopened = harness({}, new Map(view.storage));reopened.render()
  assert.equal(reopened.tracker(), undefined)
  assert.equal(nodes(reopened.render(), node => node.type === 'li').length, 1)
  assert.match(text(reopened.render()), /Partial exercise saved/)
  assert.equal(JSON.parse(reopened.storage.get(reopened.draftKey)).completedExercises[0].id, original.id)
})

test('restored Change exercise falls back to focused muscle selection and live picker still supports changing muscle or equipment', async () => {
  const seed = harness(), source = seed.library.getManualWorkoutLibrary()[0]
  const restored = harness({}, new Map([[seed.draftKey, JSON.stringify({ version: 1, activeExercise: { ...source, id: 'restored-occurrence' }, completedExercises: [] })]]))
  const change = restored.tracker().props.onManualExerciseChange
  assert.equal(change(), true);restored.render()
  assert.equal(restored.nativeDialog.open, false);assert.equal(restored.tracker(), undefined)
  assert.equal(restored.mapFocusReturns, 1)
  const mapContainer = nodes(restored.render(), node => node.props?.['data-testid'] === 'manual-readiness-map')[0]
  assert.equal(mapContainer.props.tabIndex, -1);assert.equal(mapContainer.props['aria-label'], 'Readiness and exercise selection')
  restored.open('left_biceps');restored.chooseEquipment();restored.choose();await restored.settle()
  restored.tracker().props.onManualExerciseChange();restored.render()
  assert.match(text(restored.dialog), /Biceps · Choose exercise/)
  restored.button('Back · change equipment').props.onClick();restored.render()
  assert.match(text(restored.dialog), /Choose equipment/)
  restored.button('Change muscle').props.onClick();restored.render()
  assert.equal(restored.nativeDialog.open, false);assert.equal(restored.mapFocusReturns, 2)
  restored.open('left_pectoralis_major');assert.match(text(restored.dialog), /Chest · Choose equipment/)
})

test('Change exercise rejects unavailable durable storage, mismatched evidence and stale owner/day/unmount callbacks', async () => {
  class DraftStorage extends Map { failed = false; set(key, value) { if (this.failed) throw new Error('synthetic quota');return super.set(key, value) } }
  const storage = new DraftStorage(), view = harness({}, storage)
  view.open();view.chooseEquipment();view.choose();await view.settle()
  const original = view.tracker().props.exercises[0], before = storage.get(view.draftKey), change = view.tracker().props.onManualExerciseChange
  assert.equal(change(false), false, 'Saved work requires verified evidence')
  assert.equal(change(false, { exerciseId: 'another-occurrence', workoutLogId: 'row', dayName: 'Manual Workout', signature: 'actuals' }), false)
  storage.failed = true
  assert.equal(change(), false);view.render()
  assert.equal(storage.get(view.draftKey), before);assert.equal(view.tracker().props.exercises[0].id, original.id)
  assert.match(text(view.render()), /could not retain the exercise change/)
  storage.failed = false
  try {
    clock = Date.parse('2026-11-03T18:00:00Z')
    assert.equal(change(), false, 'A prior-day callback cannot abandon its occurrence')
  } finally { clock = Date.parse('2026-11-02T18:00:00Z') }
  view.setProps({ clientId: 'another-client', authUserId: 'another-owner' })
  assert.equal(change(), false)
  const unmounted = harness();unmounted.open();unmounted.chooseEquipment();unmounted.choose();await unmounted.settle()
  const afterUnmount = unmounted.tracker().props.onManualExerciseChange
  unmounted.unmount();assert.equal(afterUnmount(), false)
})
