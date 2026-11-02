import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

// Actual component, draft helpers and API route; all accounts, storage and
// network responses below are disposable synthetic fixtures.
const require = createRequire(import.meta.url)
const frozen = Date.parse('2026-11-02T16:30:00Z')
class Clock extends Date {
  constructor(...args) { super(...(args.length ? args : [frozen])) }
  static now() { return frozen }
}
let hooks, browser, fetcher, database
const modules = new Map()
function load(path) {
  path = resolve(path)
  if (modules.has(path)) return modules.get(path).exports
  if (path.endsWith('.json')) return JSON.parse(readFileSync(path, 'utf8'))
  const module = { exports: {} };modules.set(path, module)
  const source = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText
  const mocks = {
    react: { useState: (...args) => hooks.useState(...args), useRef: (...args) => hooks.useRef(...args),
      useEffect: (...args) => hooks.useEffect(...args), useMemo: fn => fn() },
    'next/navigation': { useRouter: () => ({ refresh() {} }) },
    'next/link': { __esModule: true, default: 'a' },
    'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
    '@/components/ActivityWorkoutTracker': { __esModule: true, default: () => null },
    '@/lib/supabase/server': { createClient: async () => database },
    '@/lib/analytics/server': { recordConversion: async () => false },
    '@/lib/dashboard/invalidateDailyPlan': { invalidateDailyPlan() {} },
    '@/lib/workout/resolveSelectedPrescription': { resolveSelectedPrescription: async ({ user, clientId, exerciseId, variantId }) => {
      assert.equal(user.id, 'manual-owner');assert.equal(clientId, 'MANUAL-SYNTHETIC')
      assert.equal(exerciseId, 'manual-dumbbell_lateral_raise');assert.equal(variantId, 'dumbbell_lateral_raise')
      return { httpStatus: 200, response: { status: 'available', prescription: routeSnapshot() } }
    } },
    'server-only': {},
  }
  runInNewContext(source, { module, exports: module.exports, Buffer, Date: Clock, URL, Request, Response,
    crypto: globalThis.crypto, console: { error() {} },
    get window() { return browser }, fetch: (...args) => fetcher(...args),
    require(name) {
      if (name in mocks) return mocks[name]
      const base = name.startsWith('@/') ? resolve(name.slice(2)) : name.startsWith('.') ? resolve(dirname(path), name) : null
      if (!base) return require(name)
      if (base.endsWith('.json')) return load(base)
      try { readFileSync(base + '.ts');return load(base + '.ts') } catch (error) {
        if (error.code !== 'ENOENT') throw error
        return load(base + '.tsx')
      }
    },
  }, { filename: path })
  return module.exports
}

const plain = value => JSON.parse(JSON.stringify(value))
const snapshot = patch => ({ version: 'founder-selected-v1', exerciseId: 'catalog-row', variantId: 'variant-db',
  sets: 3, reps: 10, weightLb: 100, loadType: 'per_hand', ...patch })
const exercise = patch => ({ id: 'manual-occurrence-one', catalogExerciseId: 'catalog-row', exercise: 'Synthetic row', display_name: 'Synthetic row',
  exercise_category: 'strength', movement_type: 'row', sets: 3, reps: 10, recommended_reps: 10, recommended_weight: 100,
  weight_unit: 'lb', selected_variant_id: 'variant-db', selected_variant_name: 'Dumbbell row', selected_equipment: 'dumbbell',
  load_type: 'per_hand', available_variants: [{ id: 'variant-db', name: 'Dumbbell row', equipment: 'dumbbell', load_type: 'per_hand', equipment_modifier: 1 }],
  recommendationStatus: 'available', prescription: snapshot(), ...patch })
const props = (item, patch = {}) => ({ clientId: 'MANUAL-SYNTHETIC', authUserId: 'manual-owner', program: 'ignite',
  dayName: 'Manual Workout', timezone: 'Etc/UTC', weightUnit: 'lb', workoutSource: 'manual', exercises: [item], plannedExercises: [], ...patch })
function routeSnapshot(patch = {}) {
  return snapshot({ exerciseId: 'manual-dumbbell_lateral_raise', variantId: 'dumbbell_lateral_raise', ...patch })
}
function routeExercise() {
  return exercise({ catalogExerciseId: 'manual-dumbbell_lateral_raise', selected_variant_id: 'dumbbell_lateral_raise',
    exercise: 'Dumbbell Lateral Raise', display_name: 'Dumbbell Lateral Raise', prescription: routeSnapshot() })
}

function mount(item, initialStorage = new Map(), patch = {}) {
  const slots = [], effects = [];let cursor = 0, tree, currentProps = props(item, patch)
  const calls = []
  browser = { localStorage: { getItem: key => initialStorage.get(key) ?? null,
    setItem: (key, value) => initialStorage.set(key, value), removeItem: key => initialStorage.delete(key) }, confirm: () => true }
  fetcher = async (url, options) => { calls.push({ url, payload: JSON.parse(options.body) });return Response.json({ success: true }) }
  const currentHooks = {
    useState(initial) { const index = cursor++;if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value }] },
    useRef(initial) { const index = cursor++;return slots[index] ??= { current: initial } },
    useEffect(effect, dependencies) { const index = cursor++;const previous = slots[index]
      if (!previous || dependencies?.some((value, position) => value !== previous[position])) { slots[index] = dependencies;effects.push(effect) } },
  }
  const Tracker = load('components/WorkoutTracker.tsx').default
  function render(nextProps = currentProps) {
    currentProps = nextProps;hooks = currentHooks;cursor = 0;tree = Tracker(currentProps)
    while (typeof tree?.type === 'function') tree = tree.type(tree.props)
    for (const effect of effects.splice(0)) effect()
    return tree
  }
  render()
  return { render, calls, storage: initialStorage, get tree() { return tree },
    async flush() { await new Promise(setImmediate);render();await new Promise(setImmediate);render() } }
}
function nodes(tree, predicate) {
  const found = []
  function visit(node) { if (Array.isArray(node)) return node.forEach(visit);if (!node || typeof node !== 'object') return
    if (predicate(node)) found.push(node);visit(node.props?.children) }
  visit(tree);return found
}
const content = node => Array.isArray(node) ? node.map(content).join('') : node && typeof node === 'object' ? content(node.props?.children) : node == null ? '' : String(node)
const button = (tree, label) => nodes(tree, node => node.type === 'button' && content(node) === label)[0]
const input = (tree, label) => {
  const match = nodes(tree, node => node.type === 'label' && label.test(content(node)))[0]
  assert.ok(match, `Expected input label ${label}`)
  return nodes(match, node => node.type === 'input')[0]
}
const change = (app, label, value) => { input(app.tree, label).props.onChange({ target: { value } });app.render() }
const recommendation = tree => nodes(tree, node => node.props?.['data-testid'] === 'manual-recommendation')[0]

test('immutable recommendation remains above edited actuals and desired set count without lowering the original denominator', async () => {
  const original = exercise(), app = mount(original)
  const row = recommendation(app.tree);assert.ok(row)
  assert.match(content(row), /100.*lb.*3.*sets.*10.*reps/i)
  assert.equal(nodes(row, node => node.type === 'input').length, 0)
  assert.match(content(app.tree), /per hand/)
  assert.equal(String(input(app.tree, /Weight \(/).props.value), '100')
  assert.equal(String(input(app.tree, /^Reps/).props.value), '10')
  change(app, /Weight \(/, '35.5');change(app, /^Reps/, '7');change(app, /Desired sets/i, '1')
  assert.equal(content(recommendation(app.tree)), content(row))
  button(app.tree, 'Set Done').props.onClick();await app.flush()
  const log = app.calls.at(-1).payload.exercise_logs[0]
  assert.equal(log.planned_sets, 3);assert.equal(log.planned_reps, 10);assert.equal(log.planned_weight, 100)
  assert.deepEqual(plain(log.prescription), snapshot())
  assert.equal(log.set_logs[0].weight, 35.5);assert.equal(log.set_logs[0].reps, 7)
  assert.equal(log.user_intent.desired_set_count, 1)
  assert.deepEqual(original.prescription, snapshot())
  assert.match(content(app.tree), /2 original planned sets remain/)
})

test('kg and per-hand recommendations preserve load semantics and bodyweight zero is a genuine available prescription', async () => {
  const app = mount(exercise(), new Map(), { weightUnit: 'kg' })
  assert.match(content(recommendation(app.tree)), /45\.4.*kg/)
  assert.match(content(app.tree), /per hand/)
  assert.equal(String(input(app.tree, /Weight \(/).props.value), '45.4')
  change(app, /Weight \(/, '12.5');button(app.tree, 'Set Done').props.onClick();await app.flush()
  assert.equal(app.calls.at(-1).payload.sets[0].weight, 12.5)
  assert.equal(app.calls.at(-1).payload.sets[0].weight_unit, 'kg')
  assert.equal(app.calls.at(-1).payload.exercise_logs[0].planned_weight, 100)
  const body = mount(exercise({ prescription: snapshot({ weightLb: 0, loadType: 'bodyweight' }), recommended_weight: 0,
    selected_equipment: 'bodyweight', load_type: 'bodyweight', available_variants: [{ id: 'variant-db', name: 'Bodyweight squat', equipment: 'bodyweight', load_type: 'bodyweight', equipment_modifier: 1 }] }))
  assert.match(content(recommendation(body.tree)), /0.*lb/)
  assert.match(content(body.tree), /no added load/)
  assert.equal(nodes(body.tree, node => node.type === 'label' && /Weight \(/.test(content(node))).length, 0)
  button(body.tree, 'Set Done').props.onClick();await body.flush()
  assert.equal(body.calls[0].payload.sets[0].weight, 0)
})

test('unavailable and Tracker entries stay unguided until explicit manual values and first desired target are entered', async () => {
  for (const status of ['unavailable', 'tracking_only']) {
    const app = mount(exercise({ prescription: undefined, recommendationStatus: status, recommendationMessage: 'Recommendation unavailable.',
      sets: 0, reps: 0, recommended_reps: 0, recommended_weight: 0 }))
    assert.doesNotMatch(content(recommendation(app.tree)), /0.*lb.*0.*sets/)
    assert.equal(input(app.tree, /Weight \(/).props.value, '')
    assert.equal(input(app.tree, /^Reps/).props.value, '')
    assert.equal(input(app.tree, /Desired sets/i).props.value, '')
    button(app.tree, 'Set Done').props.onClick();await app.flush();assert.equal(app.calls.length, 0)
    change(app, /Weight \(/, '0');change(app, /^Reps/, '8');change(app, /Desired sets/i, '2')
    button(app.tree, 'Set Done').props.onClick();await app.flush()
    assert.equal(app.calls[0].payload.exercise_logs[0].planned_sets, 2)
    assert.equal(app.calls[0].payload.exercise_logs[0].prescription ?? null, null)
    change(app, /Desired sets/i, '1');button(app.tree, 'Set Done').props.onClick();await app.flush()
    assert.equal(app.calls.at(-1).payload.exercise_logs[0].planned_sets, 2)
    assert.equal(app.calls.at(-1).payload.exercise_logs[0].user_intent.desired_set_count, 1)
  }
})

test('rich drafts restore edits and the original snapshot while legacy set-array drafts retain saved actuals', async () => {
  const storage = new Map(), original = exercise(), first = mount(original, storage)
  change(first, /Weight \(/, '27.5');change(first, /^Reps/, '6');change(first, /Desired sets/i, '2')
  await first.flush()
  const restored = mount(exercise({ prescription: snapshot({ sets: 5, reps: 12, weightLb: 180 }), sets: 5, recommended_weight: 180 }), storage)
  assert.equal(input(restored.tree, /Weight \(/).props.value, '27.5')
  assert.equal(input(restored.tree, /^Reps/).props.value, '6')
  assert.equal(input(restored.tree, /Desired sets/i).props.value, '2')
  assert.match(content(recommendation(restored.tree)), /100.*lb.*3.*sets.*10.*reps/i)
  button(restored.tree, 'Set Done').props.onClick();await restored.flush()
  assert.equal(restored.calls.at(-1).payload.exercise_logs[0].planned_sets, 3)
  const logging = load('lib/workout/logging.ts')
  const legacyStorage = new Map([[logging.manualSetStorageKey('MANUAL-SYNTHETIC', 'ignite', original, '2026-11-02'), JSON.stringify([
    { id: 'legacy-set', set_number: 1, weight: 20, reps: 9, weight_unit: 'lb', set_started_at: new Clock().toISOString(), completed_at: new Clock().toISOString() },
  ])]])
  const legacy = mount(original, legacyStorage)
  assert.equal(nodes(legacy.tree, node => node.props?.['data-testid'] === 'manual-set-history').length, 1)
  assert.match(content(legacy.tree), /Set 1/)
})

test('an ambiguous unguided save failure freezes the first explicit target for retry instead of shrinking it with later intent', async () => {
  const app = mount(exercise({ prescription: undefined, recommendationStatus: 'unavailable', sets: 0,
    reps: 0, recommended_reps: 0, recommended_weight: 0 }))
  change(app, /Weight \(/, '20');change(app, /^Reps/, '8');change(app, /Desired sets/i, '3')
  fetcher = async (url, options) => { app.calls.push({ url, payload: JSON.parse(options.body) });throw new Error('Synthetic response lost after request') }
  button(app.tree, 'Set Done').props.onClick();await app.flush()
  assert.match(content(app.tree), /Set could not be saved/)
  assert.equal(app.calls[0].payload.exercise_logs[0].planned_sets, 3)
  const retained = [...app.storage.values()].map(value => JSON.parse(value)).find(value => value?.version === 3)
  assert.equal(retained.originalPlannedSets, 3)
  change(app, /Desired sets/i, '1')
  fetcher = async (url, options) => { app.calls.push({ url, payload: JSON.parse(options.body) });return Response.json({ success: true }) }
  button(app.tree, 'Set Done').props.onClick();await app.flush()
  assert.equal(app.calls.at(-1).payload.exercise_logs[0].planned_sets, 3)
  assert.equal(app.calls.at(-1).payload.exercise_logs[0].user_intent.desired_set_count, 1)
  assert.equal(app.calls.at(-1).payload.sets.length, 1)
})

test('changing display units on draft restoration converts edited weight once and retains the original units of recorded sets', async () => {
  const storage = new Map(), item = exercise(), first = mount(item, storage, { weightUnit: 'kg' })
  change(first, /Weight \(/, '12.5')
  button(first.tree, 'Set Done').props.onClick();await first.flush()
  change(first, /Weight \(/, '20');await first.flush()
  const retained = [...storage.values()].map(value => JSON.parse(value)).find(value => value?.version === 3)
  assert.equal(retained.weightUnit, 'kg');assert.equal(retained.weight, '20')
  const restored = mount(item, storage, { weightUnit: 'lb' })
  assert.equal(input(restored.tree, /Weight \(/).props.value, '44.1')
  assert.match(content(recommendation(restored.tree)), /100.*lb/)
  button(restored.tree, 'Set Done').props.onClick();await restored.flush()
  const performed = restored.calls.at(-1).payload.sets
  assert.equal(performed[0].weight, 12.5);assert.equal(performed[0].weight_unit, 'kg')
  assert.equal(performed[1].weight, 44.1);assert.equal(performed[1].weight_unit, 'lb')
  assert.equal(restored.calls.at(-1).payload.exercise_logs[0].planned_weight, 100)
  const reopened = mount(item, storage, { weightUnit: 'lb' })
  assert.equal(input(reopened.tree, /Weight \(/).props.value, '44.1', 'Same-unit reopen does not convert again.')
})

test('single-side and total-load labels keep one shared weight without doubling the prescription or recorded work', async () => {
  for (const [loadType, label] of [['single_side', 'single side'], ['total_load', 'total'], ['machine_total', 'machine total']]) {
    const item = exercise({ prescription: snapshot({ loadType }), load_type: loadType,
      available_variants: [{ id: 'variant-db', name: 'Synthetic variation', equipment: 'dumbbell', load_type: loadType, equipment_modifier: 1 }] })
    const app = mount(item)
    assert.ok(content(recommendation(app.tree)).includes(`100 lb (${label})`))
    assert.equal(nodes(app.tree, node => node.type === 'label' && /Weight \(/.test(content(node))).length, 1)
    assert.equal(String(input(app.tree, /Weight \(/).props.value), '100')
    button(app.tree, 'Set Done').props.onClick();await app.flush()
    const payload = app.calls[0].payload
    assert.equal(payload.sets.length, 1);assert.equal(payload.sets[0].weight, 100)
    assert.equal(payload.exercise_logs.length, 1);assert.equal(payload.exercise_logs[0].planned_sets, 3)
    assert.equal(payload.exercise_logs[0].load_type, loadType)
  }
})

test('a changed prescription response retains edited entries and offers an explicit reselect action without confirming a set', async () => {
  let resets = 0
  const app = mount(exercise(), new Map(), { onManualRecommendationReset: () => { resets++ } })
  change(app, /Weight \(/, '18.5');change(app, /^Reps/, '7');change(app, /Desired sets/i, '2')
  fetcher = async (url, options) => {
    app.calls.push({ url, payload: JSON.parse(options.body) })
    return Response.json({ error: 'Recommendation changed. Reselect the exercise to review it.', code: 'prescription_changed', reselect: true }, { status: 409 })
  }
  button(app.tree, 'Set Done').props.onClick();await app.flush()
  assert.match(content(app.tree), /Recommendation changed\. Reselect/)
  assert.equal(input(app.tree, /Weight \(/).props.value, '18.5')
  assert.equal(input(app.tree, /^Reps/).props.value, '7')
  assert.equal(input(app.tree, /Desired sets/i).props.value, '2')
  assert.equal(nodes(app.tree, node => node.props?.['data-testid'] === 'manual-set-history').length, 0)
  assert.equal(resets, 0)
  const retained = [...app.storage.values()].map(value => JSON.parse(value)).find(value => value?.version === 3)
  assert.equal(retained.weight, '18.5');assert.equal(retained.reps, '7');assert.deepEqual(retained.sets, [])
  button(app.tree, 'Reselect exercise').props.onClick()
  assert.equal(resets, 1)
})

function routeDatabase() {
  const client = { client_id: 'MANUAL-SYNTHETIC', auth_user_id: 'manual-owner', program: 'ignite', timezone: 'Etc/UTC', access: true, active: true }
  const rows = [], storedSets = new Map()
  const db = {
    auth: { getUser: async () => ({ data: { user: { id: client.auth_user_id } } }) },
    from(table) {
      const filters = [];let mutation
      const q = { select() { return q }, eq(key, value) { filters.push(row => row[key] === value);return q },
        gte(key, value) { filters.push(row => row[key] >= value);return q }, lt(key, value) { filters.push(row => row[key] < value);return q },
        order() { return q }, limit() { return q }, insert(value) { mutation = { mode: 'insert', value };return q },
        update(value) { mutation = { mode: 'update', value };return q }, upsert(value) { mutation = { mode: 'upsert', value };return q },
        maybeSingle: async () => execute(true), single: async () => execute(true), then(resolve, reject) { return Promise.resolve(execute(false)).then(resolve, reject) } }
      function execute(single) {
        if (table === 'clients') return { data: filters.every(filter => filter(client)) ? client : null, error: null }
        if (table === 'workout_exercise_sessions') return { data: { id: mutation.value.exercise_id }, error: null }
        if (mutation) {
          let row = mutation.mode === 'update' ? rows.find(row => filters.every(filter => filter(row))) : null
          if (row) Object.assign(row, plain(mutation.value))
          else { row = { id: 'manual-session', ...plain(mutation.value) };rows.push(row) }
          return { data: row, error: null }
        }
        const found = rows.filter(row => filters.every(filter => filter(row)))
        return { data: single ? found[0] || null : found, error: null }
      }
      return q
    },
    async rpc(name, args) { assert.equal(name, 'replace_workout_sets');storedSets.set(args.p_session_id, plain(args.p_sets));return { data: null, error: null } },
  }
  database = db
  return { client, rows, storedSets }
}

test('manual route retries preserve initial prescription and planned denominator while storing changed intent and performed values', async () => {
  const { client, rows, storedSets } = routeDatabase(), route = load('app/api/workout-set-log/route.ts')
  const item = routeExercise(), confirmed = { id: 'confirmed-one', set_number: 1, weight: 12.5, reps: 7, weight_unit: 'kg', completed_at: new Clock().toISOString() }
  const request = (log, sets = [confirmed]) => new Request('https://synthetic.invalid/api/workout-set-log', { method: 'POST', body: JSON.stringify({
    client_id: client.client_id, program: client.program, workout_date: new Clock().toISOString(), day_name: 'Manual Workout', exercise: item,
    exercise_finished_at: new Clock().toISOString(), planned_exercises: [], exercise_logs: [log], sets,
  }) })
  const original = { ...item, planned_sets: 3, planned_reps: 10, planned_weight: 100, prescription: routeSnapshot(),
    user_intent: { desired_set_count: 3 }, set_logs: [confirmed] }
  assert.equal((await route.POST(request(original))).status, 200)
  const changed = { ...original, planned_sets: 1, sets: 1, planned_reps: 5, planned_weight: 0,
    prescription: routeSnapshot({ sets: 1, reps: 5, weightLb: 0 }), user_intent: { desired_set_count: 1 } }
  assert.equal((await route.POST(request(changed))).status, 200)
  assert.equal(rows.length, 1)
  const saved = rows[0].exercise_logs[0]
  assert.equal(saved.planned_sets, 3);assert.equal(saved.planned_reps, 10);assert.equal(saved.planned_weight, 100)
  assert.deepEqual(saved.prescription, routeSnapshot())
  assert.equal(saved.user_intent.desired_set_count, 1)
  assert.equal(saved.set_logs[0].weight, 12.5);assert.equal(saved.set_logs[0].weight_unit, 'kg');assert.equal(saved.set_logs[0].reps, 7)
  assert.equal(rows[0].completed, false)
  assert.equal(storedSets.size, 1)
})

test('first-save owner-resolved snapshot normalizes the original plan and rejects invalid separate intent before mutation', async () => {
  const { client, rows } = routeDatabase(), route = load('app/api/workout-set-log/route.ts')
  const item = routeExercise(), confirmed = { id: 'first-save-set', set_number: 1, weight: 42, reps: 6, weight_unit: 'lb', completed_at: new Clock().toISOString() }
  const request = log => new Request('https://synthetic.invalid/api/workout-set-log', { method: 'POST', body: JSON.stringify({
    client_id: client.client_id, program: client.program, workout_date: new Clock().toISOString(), day_name: 'Manual Workout', exercise: item,
    exercise_finished_at: new Clock().toISOString(), planned_exercises: [], exercise_logs: [log], sets: [confirmed],
  }) })
  const mismatched = { ...item, sets: 1, planned_sets: 1, planned_reps: 2, planned_weight: 0,
    prescription: routeSnapshot(), user_intent: { desired_set_count: 1 }, set_logs: [confirmed] }
  assert.equal((await route.POST(request(mismatched))).status, 200)
  const saved = rows[0].exercise_logs[0]
  assert.equal(saved.sets, 3);assert.equal(saved.planned_sets, 3)
  assert.equal(saved.planned_reps, 10);assert.equal(saved.planned_weight, 100)
  assert.equal(saved.user_intent.desired_set_count, 1)
  assert.equal(saved.set_logs[0].weight, 42);assert.equal(saved.set_logs[0].reps, 6)
  const before = plain(rows)
  for (const desired of [0, 101, 1.5, '', false]) {
    assert.equal((await route.POST(request({ ...mismatched, user_intent: { desired_set_count: desired } }))).status, 400)
    assert.deepEqual(plain(rows), before)
  }
})
