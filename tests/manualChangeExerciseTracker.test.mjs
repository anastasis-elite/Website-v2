import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

// Run the actual manual strength component with disposable hook state, local
// storage and responses. These checks never contact a member account or API.
const require = createRequire(import.meta.url)
const start = Date.parse('2026-11-03T18:00:00Z')
const plain = value => JSON.parse(JSON.stringify(value))
const content = node => Array.isArray(node) ? node.map(content).join('') : node && typeof node === 'object' ? content(node.props?.children) : node == null ? '' : String(node)
const nodes = (node, match) => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(child => nodes(child, match)) : [...(match(node) ? [node] : []), ...nodes(node.props?.children, match)]
const json = (value, ok = true) => ({ ok, json: async () => value })
const receipt = () => json({ success: true, workout_log_id: 'synthetic-workout', exercise_session_id: 'synthetic-session' })
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
const exercise = {
  id: 'manual-row:synthetic-occurrence', catalogExerciseId: 'manual-row', exercise: 'Synthetic row', display_name: 'Synthetic row',
  exercise_category: 'strength', sets: 4, reps: 8, recommended_weight: 50, selected_variant_id: 'synthetic-cable',
  selected_equipment: 'cable', load_type: 'total_load', recommendationStatus: 'available',
  prescription: { exerciseId: 'manual-row', variantId: 'synthetic-cable', sets: 4, reps: 8, weightLb: 50, loadType: 'total_load', version: 'founder-selected-v1' },
}
const draftKey = 'aos-manual-sets:v2:SYNTHETIC-CLIENT:ignite:manual-row:synthetic-occurrence:synthetic-cable:2026-11-03'
const otherKey = 'aos-manual-sets:v2:SYNTHETIC-CLIENT:ignite:other-occurrence:other-variant:2026-11-03'

function mount({ storage = new Map(), item = exercise, props: patch = {} } = {}) {
  let now = start, cursor = 0, tree, queued = [], active = true, send = async () => receipt(), confirm = () => true, acceptChange = true, failStorage = false
  const slots = [], effects = [], modules = new Map(), calls = [], changed = [], finished = [], confirmations = [], listeners = new Map(), refs = new Map()
  const localStorage = {
    getItem: key => storage.get(key) || null,
    setItem: (key, value) => { if (failStorage) throw new Error('synthetic storage unavailable'); storage.set(key, value) },
    removeItem: key => { if (failStorage) throw new Error('synthetic storage unavailable'); storage.delete(key) },
  }
  const react = {
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial; return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next }] },
    useRef(initial) { const index = cursor++; return slots[index] ||= { current: initial } },
    useMemo(fn) { cursor++; return fn() },
    useId() { const index = cursor++; return `synthetic-id-${index}` },
    useEffect(fn, deps) { const index = cursor++, prior = effects[index]; if (!prior || deps?.some((value, n) => !Object.is(value, prior.deps?.[n]))) queued.push(() => { prior?.cleanup?.(); effects[index] = { deps, cleanup: fn() } }) },
  }
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])) } static now() { return now } }
  const browser = {
    localStorage, confirm(message) { confirmations.push(message); return confirm(message) },
    addEventListener: (type, fn) => listeners.set(type, fn), removeEventListener: type => listeners.delete(type),
  }
  function load(path) {
    path = resolve(path)
    if (modules.has(path)) return modules.get(path).exports
    if (path.endsWith('.json')) return JSON.parse(readFileSync(path, 'utf8'))
    const module = { exports: {} }; modules.set(path, module)
    const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
    runInNewContext(code, { module, exports: module.exports, Date: Clock, URLSearchParams, AbortController, crypto: globalThis.crypto,
      console: { error() {} }, window: browser, localStorage,
      fetch(url, options) { const call = { url, options, body: options?.body ? JSON.parse(options.body) : null }; calls.push(call); return send(call) },
      require(name) {
        if (name === 'react') return react
        if (name === 'next/navigation') return { useRouter: () => ({ refresh() {} }) }
        if (name === 'next/link') return { __esModule: true, default: 'a' }
        if (name === '@/components/ActivityWorkoutTracker') return { __esModule: true, default: () => null }
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
  const Component = load('components/WorkoutTracker.tsx').default
  const props = { clientId: 'SYNTHETIC-CLIENT', authUserId: 'synthetic-owner', program: 'ignite', dayName: 'Manual Workout', exercises: [item], plannedExercises: [{ id: 'recommended-plan-untouched' }], workoutSource: 'manual', timezone: 'Etc/UTC', weightUnit: 'lb',
    onManualExerciseFinished: (...args) => finished.push(plain(args)), onManualExerciseChange: (...args) => { changed.push(plain(args)); return acceptChange }, ...patch }
  function render() {
    if (!active) return tree
    cursor = 0; queued = []; tree = Component(props)
    while (typeof tree?.type === 'function') tree = tree.type(tree.props)
    for (const node of nodes(tree, node => node.ref && typeof node.ref === 'object')) {
      const mock = refs.get(node.ref) || { focusCount: 0, focus() { this.focusCount++ }, querySelector() { return null } }
      refs.set(node.ref, mock); node.ref.current = mock
    }
    const pending = queued; queued = []; pending.forEach(effect => effect())
    return tree
  }
  function button(label) { return nodes(render(), node => node.type === 'button' && content(node).trim() === label)[0] }
  function input(label) { return nodes(render(), node => node.type === 'label' && label.test(content(node))).flatMap(node => nodes(node, child => child.type === 'input'))[0] }
  render()
  return { render, button, input, props, calls, storage, changed, finished, confirmations, listeners,
    get tree() { return tree }, get writes() { return calls.filter(call => call.body) },
    setSend(fn) { send = fn }, setConfirm(fn) { confirm = fn }, setAccept(value) { acceptChange = value }, setStorageFailure(value) { failStorage = value }, setTime(value) { now = Date.parse(value) },
    change(label, value) { input(label).props.onChange({ target: { value } }); render() },
    unmount() { active = false; effects.forEach(effect => effect?.cleanup?.()) },
    async flush() { await new Promise(setImmediate); render(); await new Promise(setImmediate); render() },
  }
}

test('Change exercise is a heading action before set inputs and untouched defaults abandon only this occurrence without credit or a POST', async () => {
  const storage = new Map([[otherKey, 'other exercise draft']]), app = mount({ storage })
  const heading = nodes(app.tree, node => node.props?.className === 'manual-set-heading')[0]
  assert.ok(nodes(heading, node => node.type === 'button' && content(node).trim() === 'Change exercise').length)
  const order = nodes(app.tree, node => node.type === 'button' || node.type === 'input')
  assert.equal(order[0].type, 'button'); assert.equal(content(order[0]).trim(), 'Change exercise')
  app.button('Change exercise').props.onClick(); await app.flush()
  assert.equal(app.confirmations.length, 0, 'Prefilled recommendation defaults are not unrecorded edits')
  assert.equal(app.changed.length, 1); assert.equal(app.finished.length, 0); assert.equal(app.writes.length, 0)
  assert.equal(app.storage.has(draftKey), false); assert.equal(app.storage.get(otherKey), 'other exercise draft')
})

test('meaningful edited inputs survive cancelling Change exercise; confirming discards no saved work and writes no fake set', async () => {
  const app = mount(); app.change(/Weight \(/, '37.5'); app.change(/^Reps/, '6'); app.change(/Desired sets/, '2')
  app.setConfirm(() => false); app.button('Change exercise').props.onClick(); await app.flush()
  assert.equal(app.confirmations.length, 1); assert.equal(app.changed.length, 0); assert.equal(app.writes.length, 0)
  assert.equal(app.input(/Weight \(/).props.value, '37.5'); assert.equal(app.input(/^Reps/).props.value, '6'); assert.equal(app.input(/Desired sets/).props.value, '2')
  assert.equal(JSON.parse(app.storage.get(draftKey)).weight, '37.5')
  app.setConfirm(() => true); app.button('Change exercise').props.onClick(); await app.flush()
  assert.equal(app.changed.length, 1); assert.equal(app.writes.length, 0); assert.equal(app.storage.has(draftKey), false)
})

test('restored edited inputs still warn while restored untouched recommendation defaults do not', async () => {
  const first = mount(); first.change(/Weight \(/, '42.5'); await first.flush(); first.unmount()
  const restored = mount({ storage: first.storage }); restored.setConfirm(() => false)
  restored.button('Change exercise').props.onClick(); await restored.flush()
  assert.equal(restored.confirmations.length, 1); assert.equal(restored.changed.length, 0); assert.equal(restored.input(/Weight \(/).props.value, '42.5')
  const untouched = mount(); await untouched.flush(); untouched.unmount()
  const defaults = mount({ storage: untouched.storage }); defaults.button('Change exercise').props.onClick(); await defaults.flush()
  assert.equal(defaults.confirmations.length, 0); assert.equal(defaults.changed.length, 1); assert.equal(defaults.writes.length, 0)
})

test('saved partial work can continue on cancel or transfer with its original occurrence and verified finish receipt', async () => {
  const storage = new Map([[otherKey, 'another occurrence']]), app = mount({ storage })
  app.change(/Weight \(/, '37.5'); app.change(/^Reps/, '6'); app.button('Set Done').props.onClick(); await app.flush()
  assert.equal(app.writes.length, 1)
  const original = plain(app.writes[0].body)
  app.setConfirm(() => false); app.button('Change exercise').props.onClick(); await app.flush()
  assert.equal(app.changed.length, 0); assert.equal(app.writes.length, 1); assert.equal(JSON.parse(app.storage.get(draftKey)).sets.length, 1)
  app.setConfirm(() => true); app.button('Change exercise').props.onClick(); await app.flush()
  assert.equal(app.writes.length, 2); assert.equal(app.changed.length, 1); assert.equal(app.finished.length, 0)
  const saved = app.writes.at(-1).body
  assert.equal(saved.exercise.id, exercise.id); assert.deepEqual(saved.sets, original.sets)
  assert.deepEqual(saved.planned_exercises, original.planned_exercises); assert.equal(saved.exercise_logs[0].planned_sets, 4)
  assert.equal(saved.completed, false); assert.equal(app.changed[0][0], false)
  const proof = app.changed[0][1], signature = JSON.parse(proof.signature)
  assert.equal(proof.exerciseId, exercise.id); assert.equal(proof.workoutLogId, 'synthetic-workout')
  assert.equal(signature.plannedSets, 4); assert.equal(signature.sets.length, 1); assert.equal(signature.sets[0].reps, 6)
  assert.equal(app.storage.has(draftKey), false); assert.equal(app.storage.get(otherKey), 'another occurrence')
})

test('a failed builder handoff retains the original inputs and draft', async () => {
  const app = mount(); app.change(/Weight \(/, '42.5'); app.setAccept(false)
  app.button('Change exercise').props.onClick(); await app.flush()
  assert.equal(app.changed.length, 1); assert.equal(app.writes.length, 0)
  assert.equal(app.input(/Weight \(/).props.value, '42.5'); assert.equal(JSON.parse(app.storage.get(draftKey)).weight, '42.5')
})

test('unsaved saved-set editor changes participate in the warning and cancellation leaves the editor mounted', async () => {
  const app = mount(); app.button('Set Done').props.onClick(); await app.flush()
  const editor = nodes(app.tree, node => typeof node.type === 'function' && node.props?.onSave && node.props?.set)[0]
  assert.equal(typeof editor?.props.onDirtyChange, 'function')
  editor.props.onDirtyChange(true); app.render(); app.setConfirm(() => false)
  app.button('Change exercise').props.onClick(); await app.flush()
  assert.match(app.confirmations.at(-1), /unrecorded|unsaved|edit/i)
  assert.equal(app.changed.length, 0); assert.equal(app.writes.length, 1)
  assert.equal(nodes(app.tree, node => node.type === editor.type && node.key === editor.key).length, 1)
})

test('an in-flight set save fences Change exercise and repeated stale handlers before rerender', async () => {
  const app = mount(), pending = deferred(), set = app.button('Set Done').props.onClick, change = app.button('Change exercise').props.onClick
  app.setSend(() => pending.promise)
  set(); set(); change(); change(); app.render()
  assert.equal(app.writes.length, 1); assert.equal(app.changed.length, 0); assert.equal(app.confirmations.length, 0)
  assert.equal(app.button('Change exercise').props.disabled, true)
  assert.ok(JSON.parse(app.storage.get(draftKey)).pendingSave, 'The exact attempted save must be durable before its response')
  pending.resolve(receipt()); await app.flush()
  assert.equal(app.changed.length, 0); assert.equal(JSON.parse(app.storage.get(draftKey)).sets.length, 1)
})

test('an ambiguous first save blocks discard and survives reload; Retry save sends the identical occurrence, set IDs and payload', async () => {
  const storage = new Map([[otherKey, 'other protected draft']]), app = mount({ storage })
  app.setSend(async () => { throw new Error('synthetic response lost after write') })
  app.button('Set Done').props.onClick(); await app.flush()
  const attempted = plain(app.writes[0].body)
  assert.ok(JSON.parse(app.storage.get(draftKey)).pendingSave)
  assert.equal(app.button('Change exercise').props.disabled, true)
  app.button('Change exercise').props.onClick(); await app.flush(); assert.equal(app.changed.length, 0)
  app.unmount()
  const restored = mount({ storage }); assert.equal(restored.button('Change exercise').props.disabled, true)
  assert.equal(restored.button('Finish Exercise').props.disabled, true)
  const retry = restored.button('Retry save'); assert.ok(retry)
  retry.props.onClick(); await restored.flush()
  assert.equal(restored.writes.length, 1); assert.deepEqual(restored.writes[0].body, attempted)
  assert.equal(restored.changed.length, 0, 'A recovered save never silently switches exercises')
  assert.equal(JSON.parse(restored.storage.get(draftKey)).sets.length, 1)
  assert.equal(restored.storage.get(otherKey), 'other protected draft')
  restored.button('Change exercise').props.onClick(); await restored.flush()
  assert.equal(restored.changed.length, 1); assert.equal(restored.changed[0][0], false)
})

test('an uncertain Change finish retains the original work and retry does not navigate until Change is explicitly chosen again', async () => {
  const app = mount(); app.button('Set Done').props.onClick(); await app.flush()
  app.setSend(async () => json({ success: true }))
  app.button('Change exercise').props.onClick(); await app.flush()
  assert.equal(app.changed.length, 0); assert.ok(JSON.parse(app.storage.get(draftKey)).pendingSave)
  const attempted = plain(app.writes.at(-1).body)
  app.setSend(async () => receipt()); app.button('Retry save').props.onClick(); await app.flush()
  assert.deepEqual(app.writes.at(-1).body, attempted); assert.equal(app.changed.length, 0)
  assert.equal(JSON.parse(app.storage.get(draftKey)).sets.length, 1)
  app.button('Change exercise').props.onClick(); await app.flush()
  assert.equal(app.changed.length, 1); assert.deepEqual(app.writes.at(-1).body.sets, attempted.sets)
})

test('an unmounted logger never transfers or clears its draft when a late Change finish response arrives', async () => {
  const app = mount(); app.button('Set Done').props.onClick(); await app.flush()
  const pending = deferred(); app.setSend(() => pending.promise)
  app.button('Change exercise').props.onClick(); app.render(); app.unmount()
  const retained = app.storage.get(draftKey)
  pending.resolve(receipt()); await app.flush()
  assert.equal(app.changed.length, 0); assert.equal(app.storage.get(draftKey), retained)
})

test('a Change finish response after local day rollover retains the previous day occurrence and never transfers it', async () => {
  const app = mount(); app.button('Set Done').props.onClick(); await app.flush()
  const pending = deferred(); app.setSend(() => pending.promise)
  app.button('Change exercise').props.onClick(); app.render(); app.setTime('2026-11-04T00:01:00Z')
  pending.resolve(receipt()); await app.flush()
  assert.equal(app.changed.length, 0); assert.ok(app.storage.has(draftKey))
  assert.ok([...app.storage.keys()].every(key => key.includes('2026-11-03')))
})

function legacyStorage() {
  return new Map([[draftKey, JSON.stringify({ version: 3, sets: [], weight: '50', weightUnit: 'lb', reps: '8', desiredSetCount: '4', originalPlannedSets: 4, prescription: exercise.prescription })]])
}
function legacySummary(saved = false) {
  const at = '2026-11-03T17:59:00.000Z'
  return { version: 1, clientId: 'SYNTHETIC-CLIENT', authUserId: 'synthetic-owner', program: 'ignite', date: '2026-11-03', completed: false,
    sessions: saved ? [{ id: 'synthetic-workout', dayName: 'Manual Workout', updatedAt: at, completed: false,
      progress: { completedSets: 1, totalSets: 4, requiredSets: 2 }, exercises: [{ id: exercise.id, name: exercise.exercise, kind: 'strength', completed: false,
        plannedSets: 4, setLogs: [{ setNumber: 1, reps: 7, weight: 35, unit: 'lb', completedAt: at }], duration: null, durationUnit: null,
        signature: JSON.stringify({ id: exercise.id, variant: exercise.selected_variant_id, plannedSets: 4,
          sets: [{ id: 'recovered-synthetic-set', number: 1, reps: 7, weight: 35, unit: 'lb', at }],
          duration: null, unit: null, confirmedAt: null, completed: false, skipped: false }) }] }] : [] }
}

test('legacy zero-set drafts require a confirmed saved-record check before an accidental selection can be abandoned', async () => {
  const storage = legacyStorage(), app = mount({ storage })
  app.setSend(async () => json({ success: true }))
  app.button('Change exercise').props.onClick(); await app.flush()
  assert.equal(app.changed.length, 0); assert.equal(app.writes.length, 0); assert.ok(app.storage.has(draftKey))
  assert.match(content(app.tree), /could not be checked|could not be confirmed|draft is retained/i)
  app.setSend(async () => json(legacySummary()))
  app.button('Change exercise').props.onClick(); await app.flush()
  assert.equal(app.changed.length, 1); assert.equal(app.writes.length, 0)
  assert.ok(app.calls.every(call => call.options.method === 'GET' && /manualSummary=1/.test(call.url)))
})

test('legacy zero-set drafts recover real saved work under the original occurrence before offering another exercise', async () => {
  const app = mount({ storage: legacyStorage() }); app.setSend(async () => json(legacySummary(true)))
  app.button('Change exercise').props.onClick(); await app.flush()
  assert.equal(app.changed.length, 0); assert.equal(app.writes.length, 0)
  const recovered = JSON.parse(app.storage.get(draftKey)).sets
  assert.equal(recovered.length, 1); assert.equal(recovered[0].id, 'recovered-synthetic-set'); assert.equal(recovered[0].weight, 35); assert.equal(recovered[0].reps, 7)
  assert.match(content(app.tree), /recovered|review/i)
  app.setSend(async () => receipt()); app.button('Change exercise').props.onClick(); await app.flush()
  assert.equal(app.changed.length, 1); assert.equal(app.changed[0][0], false)
  assert.equal(app.writes[0].body.exercise.id, exercise.id); assert.deepEqual(app.writes[0].body.sets, recovered)
})

test('a first prescription rejection offers the safe Change flow without invoking the old destructive reset callback', async () => {
  let resets = 0
  const app = mount({ props: { onManualRecommendationReset() { resets++ } } })
  app.setSend(async () => json({ code: 'prescription_changed', error: 'Synthetic recommendation changed.' }, false))
  app.button('Set Done').props.onClick(); await app.flush()
  assert.equal(JSON.parse(app.storage.get(draftKey)).sets.length, 0)
  assert.equal(app.button('Reselect exercise'), undefined); assert.equal(app.button('Change exercise').props.disabled, false)
  app.button('Change exercise').props.onClick(); await app.flush()
  assert.equal(app.changed.length, 1); assert.equal(app.finished.length, 0); assert.equal(resets, 0)
  assert.equal(app.writes.length, 1, 'No fake work or replacement save is needed after a definite pre-write rejection')
})

test('ambiguous update and delete retries retain the exact intended sets before Change can continue', async () => {
  for (const action of ['update', 'delete']) {
    const app = mount(); app.button('Set Done').props.onClick(); await app.flush()
    const original = plain(app.writes[0].body.sets)
    app.setSend(async () => { throw new Error('synthetic response lost after mutation') })
    if (action === 'update') {
      const editor = nodes(app.tree, node => typeof node.type === 'function' && node.props?.onSave && node.props?.set)[0]
      editor.props.onSave({ weight: 22.5, reps: 5 })
    } else app.button('Delete').props.onClick()
    await app.flush()
    const attempted = plain(app.writes.at(-1).body)
    assert.deepEqual(JSON.parse(app.storage.get(draftKey)).sets, original, 'Keep the last confirmed set view while mutation is uncertain')
    assert.equal(app.button('Change exercise').props.disabled, true)
    app.setSend(async () => receipt()); app.button('Retry save').props.onClick(); await app.flush()
    assert.deepEqual(app.writes.at(-1).body, attempted)
    assert.deepEqual(JSON.parse(app.storage.get(draftKey)).sets, attempted.sets)
    assert.equal(app.changed.length, 0)
    if (action === 'update') {
      assert.equal(attempted.sets.length, 1); assert.equal(attempted.sets[0].id, original[0].id)
      assert.equal(attempted.sets[0].weight, 22.5); assert.equal(attempted.sets[0].reps, 5)
    } else assert.equal(attempted.sets.length, 0)
  }
})

test('an ordinary 2xx response without a saved receipt remains pending instead of permitting a zero-set discard', async () => {
  const app = mount(); app.setSend(async () => json({ success: true }))
  app.button('Set Done').props.onClick(); await app.flush()
  assert.ok(JSON.parse(app.storage.get(draftKey)).pendingSave)
  assert.equal(JSON.parse(app.storage.get(draftKey)).sets.length, 0)
  assert.equal(app.button('Change exercise').props.disabled, true)
  app.button('Change exercise').props.onClick(); await app.flush()
  assert.equal(app.changed.length, 0); assert.equal(app.writes.length, 1)
})

test('a browser that cannot retain the pending mutation sends no save request and preserves edited inputs', async () => {
  const app = mount(); app.change(/Weight \(/, '32.5'); app.change(/^Reps/, '9'); app.setStorageFailure(true)
  app.button('Set Done').props.onClick(); await app.flush()
  assert.equal(app.writes.length, 0); assert.equal(app.changed.length, 0)
  assert.equal(app.input(/Weight \(/).props.value, '32.5'); assert.equal(app.input(/^Reps/).props.value, '9')
  assert.match(content(app.tree), /No request was sent|could not retain/i)
})

function legacyWithSavedSet() {
  const storage = legacyStorage(), draft = JSON.parse(storage.get(draftKey))
  draft.sets = [{ id: 'recovered-synthetic-set', set_number: 1, weight: 20, weight_unit: 'lb', reps: 6,
    set_started_at: '2026-11-03T17:58:00.000Z', completed_at: '2026-11-03T17:59:00.000Z' }]
  storage.set(draftKey, JSON.stringify(draft)); return storage
}

test('a restored legacy saved-set draft recovers newer server actuals before Change can finish the original occurrence', async () => {
  const app = mount({ storage: legacyWithSavedSet() }); app.setSend(async () => json(legacySummary(true)))
  app.button('Change exercise').props.onClick(); await app.flush()
  assert.equal(app.changed.length, 0); assert.equal(app.writes.length, 0)
  const recovered = JSON.parse(app.storage.get(draftKey)).sets
  assert.equal(recovered.length, 1); assert.equal(recovered[0].id, 'recovered-synthetic-set')
  assert.equal(recovered[0].weight, 35); assert.equal(recovered[0].reps, 7)
  app.setSend(async () => receipt()); app.button('Change exercise').props.onClick(); await app.flush()
  assert.equal(app.changed.length, 1); assert.deepEqual(app.writes[0].body.sets, recovered)
  assert.equal(app.writes[0].body.exercise.id, exercise.id)
})

test('a restored legacy saved-set draft recovers a server-confirmed last-set deletion without rewriting the deleted work', async () => {
  const summary = legacySummary(true), record = summary.sessions[0].exercises[0]
  record.setLogs = []; record.signature = JSON.stringify({ ...JSON.parse(record.signature), sets: [] })
  summary.sessions[0].progress.completedSets = 0
  const app = mount({ storage: legacyWithSavedSet() }); app.setSend(async () => json(summary))
  app.button('Change exercise').props.onClick(); await app.flush()
  assert.equal(app.changed.length, 0); assert.equal(app.writes.length, 0)
  assert.equal(JSON.parse(app.storage.get(draftKey)).sets.length, 0)
  app.button('Change exercise').props.onClick(); await app.flush()
  assert.equal(app.changed.length, 1); assert.equal(app.finished.length, 0); assert.equal(app.writes.length, 0)
  assert.equal(app.storage.has(draftKey), false)
})

test('clearing or invalidating an unsaved desired-set input cannot block keeping saved work or change its saved intent', async () => {
  for (const invalid of ['', '0']) {
    const app = mount(); app.change(/Desired sets/, '2'); app.button('Set Done').props.onClick(); await app.flush()
    const original = plain(app.writes[0].body)
    app.change(/Desired sets/, invalid); app.button('Change exercise').props.onClick(); await app.flush()
    assert.equal(app.changed.length, 1); assert.equal(app.changed[0][0], false)
    const final = app.writes.at(-1).body
    assert.equal(final.exercise_logs[0].planned_sets, 4)
    assert.equal(final.exercise_logs[0].user_intent.desired_set_count, 2)
    assert.deepEqual(final.sets, original.sets)
    assert.match(app.confirmations.at(-1), /unrecorded|unsaved|edit/i)
  }
})

test('retrying an unrelated pending new set preserves the warning for still-unsaved saved-set editor changes', async () => {
  const app = mount(); app.button('Set Done').props.onClick(); await app.flush()
  const editor = nodes(app.tree, node => typeof node.type === 'function' && node.props?.onSave && node.props?.set)[0]
  editor.props.onDirtyChange(true)
  app.setSend(async () => { throw new Error('synthetic new-set response lost') })
  app.button('Set Done').props.onClick(); await app.flush()
  app.setSend(async () => receipt()); app.button('Retry save').props.onClick(); await app.flush()
  assert.equal(JSON.parse(app.storage.get(draftKey)).sets.length, 2)
  app.setConfirm(() => false); app.button('Change exercise').props.onClick(); await app.flush()
  assert.equal(app.changed.length, 0); assert.match(app.confirmations.at(-1), /unrecorded|unsaved|edit/i)
  assert.equal(nodes(app.tree, node => node.type === editor.type && node.key === editor.key).length, 2)
})
