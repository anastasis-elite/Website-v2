import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

// Executes the actual save handler, ownership policy and history/completion
// helpers. Only the shared trusted-dose resolver and database transport are
// synthetic; resolver/formula tests are maintained separately.
const require = createRequire(import.meta.url)
const owner = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'
const fixed = Date.parse('2026-11-02T16:30:00Z')
class Clock extends Date {
  constructor(...args) { super(...(args.length ? args : [fixed])) }
  static now() { return fixed }
}
const plain = value => JSON.parse(JSON.stringify(value))
const snapshot = patch => ({ version: 'founder-selected-v1', exerciseId: 'manual-dumbbell_lateral_raise', variantId: 'dumbbell_lateral_raise',
  sets: 3, reps: 10, weightLb: 25, loadType: 'per_hand', ...patch })
const set = (number = 1, patch = {}) => ({ id: `confirmed-${number}`, set_number: number, weight: 8.5, weight_unit: 'kg', reps: 7,
  set_started_at: new Clock(fixed - 60_000).toISOString(), completed_at: new Clock().toISOString(), ...patch })
const exercise = patch => ({ id: 'owner-occurrence-one', catalogExerciseId: 'manual-dumbbell_lateral_raise', selected_variant_id: 'dumbbell_lateral_raise',
  selected_variant_name: 'Synthetic row variant', selected_equipment: 'dumbbell', exercise: 'Dumbbell Lateral Raise', display_name: 'Dumbbell Lateral Raise',
  exercise_category: 'strength', load_type: 'per_hand', sets: 3, ...patch })
const log = patch => ({ ...exercise(), planned_sets: 3, planned_reps: 10, planned_weight: 25,
  prescription: snapshot(), user_intent: { desired_set_count: 2 }, set_logs: [set()], ...patch })

function fixture({ tier = 'ignite', authenticated = true } = {}) {
  const client = { client_id: 'INTEGRITY-OWNER', auth_user_id: owner, program: tier, timezone: 'Etc/UTC', access: true,
    active: true, verified_purchase: true, membership_expires_at: '2035-01-01T00:00:00Z' }
  const foreign = { ...client, client_id: 'INTEGRITY-FOREIGN', auth_user_id: other }
  const state = { authenticated, resolverCalls: [], writes: [], rows: [], sessions: new Map(), sets: new Map(),
    outcome: { httpStatus: 200, response: { status: 'available', prescription: snapshot() } }, resolverError: null }
  const db = {
    auth: { getUser: async () => ({ data: { user: state.authenticated ? { id: owner, email: 'owner@synthetic.invalid' } : null }, error: null }) },
    from(table) {
      const filters = [];let mutation
      const q = { select() { return q }, eq(key, value) { filters.push(row => row[key] === value);return q },
        gte(key, value) { filters.push(row => row[key] >= value);return q }, lt(key, value) { filters.push(row => row[key] < value);return q },
        order() { return q }, limit() { return q }, insert(value) { mutation = { mode: 'insert', value };return q },
        update(value) { mutation = { mode: 'update', value };return q }, upsert(value) { mutation = { mode: 'upsert', value };return q },
        maybeSingle: async () => execute(true), single: async () => execute(true), then(done, fail) { return Promise.resolve(execute(false)).then(done, fail) } }
      function execute(single) {
        if (table === 'clients') {
          assert.equal(mutation, undefined, 'Session equipment must never update saved client inventory.')
          return { data: [client, foreign].find(row => filters.every(filter => filter(row))) || null, error: null }
        }
        assert.ok(['workout_logs', 'workout_exercise_sessions'].includes(table), `Unexpected transport table ${table}`)
        if (mutation) {
          state.writes.push({ table, mode: mutation.mode, value: plain(mutation.value) })
          if (table === 'workout_exercise_sessions') {
            const row = { id: `exercise-session-${mutation.value.exercise_id}`, ...plain(mutation.value) }
            state.sessions.set(row.id, row)
            return { data: row, error: null }
          }
          let row = mutation.mode === 'update' ? state.rows.find(row => filters.every(filter => filter(row))) : null
          if (row) Object.assign(row, plain(mutation.value))
          else { row = { id: `manual-session-${state.rows.length + 1}`, ...plain(mutation.value) };state.rows.push(row) }
          return { data: row, error: null }
        }
        const found = state.rows.filter(row => filters.every(filter => filter(row)))
        return { data: single ? found[0] || null : found, error: null }
      }
      return q
    },
    async rpc(name, args) {
      assert.equal(name, 'replace_workout_sets')
      state.writes.push({ table: 'replace_workout_sets', value: plain(args) })
      state.sets.set(args.p_session_id, plain(args.p_sets))
      return { data: null, error: null }
    },
  }
  const cache = new Map()
  const mocks = {
    'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
    '@/lib/supabase/server': { createClient: async () => db },
    '@/lib/dashboard/invalidateDailyPlan': { invalidateDailyPlan() {} },
    '@/lib/analytics/server': { recordConversion: async () => false },
    '@/lib/workout/resolveSelectedPrescription': { resolveSelectedPrescription: async args => {
      state.resolverCalls.push(args)
      if (state.resolverError) throw state.resolverError
      if (args.exerciseId !== 'manual-dumbbell_lateral_raise' || !['dumbbell_lateral_raise', 'cable_lateral_raise', 'machine_lateral_raise'].includes(args.variantId)) {
        return { httpStatus: 400, response: { status: 'unavailable', message: 'Unknown synthetic catalog selection.' } }
      }
      return plain(state.outcome)
    } },
  }
  function load(path) {
    path = resolve(path)
    if (cache.has(path)) return cache.get(path).exports
    if (path.endsWith('.json')) return JSON.parse(readFileSync(path, 'utf8'))
    const module = { exports: {} };cache.set(path, module)
    const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
    } }).outputText
    runInNewContext(code, { module, exports: module.exports, Date: Clock, Intl, Buffer, Request, Response, URL,
      console: { error() {} }, require(name) {
        if (name in mocks) return mocks[name]
        if (name === 'server-only') return {}
        const base = name.startsWith('@/') ? resolve(name.slice(2)) : name.startsWith('.') ? resolve(dirname(path), name) : null
        if (!base) return require(name)
        return load(base.endsWith('.json') ? base : existsSync(base + '.ts') ? base + '.ts' : base + '.tsx')
      },
    }, { filename: path })
    return module.exports
  }
  const handler = load('app/api/workout-set-log/route.ts')
  const body = (patch = {}) => ({ client_id: client.client_id, auth_user_id: other, program: tier,
    day_name: 'Manual Workout', workout_date: new Clock().toISOString(), workout_source: 'manual', exercise: exercise(),
    exercise_finished_at: new Clock().toISOString(), exercise_logs: [log()], planned_exercises: [], sets: [set()], ...patch })
  const save = value => handler.POST(new Request('https://synthetic.invalid/api/workout-set-log', { method: 'POST', body: JSON.stringify(value) }))
  return { client, db, state, body, save, load }
}

const sessionContext = (equipment = 'cable') => ({ source: 'session_override', equipment, variantId: `${equipment}_lateral_raise` })
function sessionEquipmentBody(app, context = sessionContext()) {
  const loadType = context.equipment === 'cable' ? 'single_side' : context.equipment === 'machine' ? 'machine_total' : 'per_hand'
  const recommendation = snapshot({ variantId: context.variantId, loadType, equipmentContext: plain(context) })
  app.state.outcome = { httpStatus: 200, response: { status: 'available', prescription: recommendation } }
  const chosen = exercise({ selected_variant_id: context.variantId, selected_equipment: context.equipment, load_type: loadType,
    prescription: plain(recommendation) })
  return app.body({ exercise: chosen, exercise_logs: [log({ ...chosen, prescription: plain(recommendation) })] })
}

test('first guided save resolves an authenticated owned catalog selection and stores only the trusted dose with edited actuals', async () => {
  const app = fixture()
  const submitted = app.body({ exercise_logs: [log({ sets: 1, planned_sets: 1, planned_reps: 1, planned_weight: 1,
    prescription_verification: { version: 'forged', auth_user_id: other } })] })
  const response = await app.save(submitted)
  assert.equal(response.status, 200)
  assert.equal(app.state.resolverCalls.length, 1)
  const resolved = app.state.resolverCalls[0]
  assert.equal(resolved.user.id, owner);assert.equal(resolved.clientId, app.client.client_id)
  assert.equal(resolved.exerciseId, 'manual-dumbbell_lateral_raise');assert.equal(resolved.variantId, 'dumbbell_lateral_raise')
  assert.equal(resolved.supabase, app.db)
  const saved = app.state.rows[0].exercise_logs[0]
  assert.deepEqual(saved.prescription, snapshot())
  assert.equal(saved.planned_sets, 3);assert.equal(saved.sets, 3);assert.equal(saved.planned_reps, 10);assert.equal(saved.planned_weight, 25)
  assert.deepEqual(saved.prescription_verification, { version: 'owner-resolved-v1', auth_user_id: owner,
    client_id: app.client.client_id, program: 'ignite', exercise_id: 'owner-occurrence-one',
    catalog_exercise_id: 'manual-dumbbell_lateral_raise', variant_id: 'dumbbell_lateral_raise' })
  assert.equal(saved.set_logs[0].weight, 8.5);assert.equal(saved.set_logs[0].weight_unit, 'kg');assert.equal(saved.set_logs[0].reps, 7)
  assert.equal(saved.user_intent.desired_set_count, 2)
  assert.equal(app.state.rows[0].completed, false)
})

test('shape-valid altered prescribed sets, repetitions or weight reject before any save or claimed provenance', async () => {
  for (const patch of [{ sets: 1 }, { reps: 3 }, { weightLb: 1 }, { loadType: 'single_side' }]) {
    const app = fixture()
    const response = await app.save(app.body({ exercise_logs: [log({ prescription: snapshot(patch),
      prescription_verification: { version: 'owner-resolved-v1', auth_user_id: owner } })] }))
    assert.equal(response.status, 409)
    assert.equal(app.state.resolverCalls.length, 1)
    assert.equal(app.state.writes.length, 0);assert.equal(app.state.rows.length, 0)
  }
})

test('foreign owner, exercise occurrence, catalog and variant identities cannot use another selection', async () => {
  const foreign = fixture()
  assert.equal((await foreign.save(foreign.body({ client_id: 'INTEGRITY-FOREIGN' }))).status, 404)
  assert.equal(foreign.state.resolverCalls.length, 0);assert.equal(foreign.state.writes.length, 0)
  const anonymous = fixture({ authenticated: false })
  assert.equal((await anonymous.save(anonymous.body())).status, 401);assert.equal(anonymous.state.writes.length, 0)
  for (const patch of [
    { exercise: exercise({ catalogExerciseId: 'foreign-catalog' }) },
    { exercise: exercise({ selected_variant_id: 'foreign-variant' }) },
    { exercise_logs: [log({ selected_variant_id: 'foreign-variant' })] },
    { exercise_logs: [log({ id: 'other-occurrence' })] },
    { exercise: exercise({ catalogExerciseId: 'foreign-catalog' }), exercise_logs: [log({ prescription: snapshot({ exerciseId: 'foreign-catalog' }) })] },
  ]) {
    const app = fixture()
    assert.equal((await app.save(app.body(patch))).status, 409)
    assert.equal(app.state.writes.length, 0)
  }
})

test('Tracker injected guidance rejects before resolver reads but explicit unguided actuals still save without claimed provenance', async () => {
  const app = fixture({ tier: 'tracker' })
  assert.equal((await app.save(app.body())).status, 403)
  assert.equal(app.state.resolverCalls.length, 0);assert.equal(app.state.writes.length, 0)
  const manual = log({ planned_sets: 2, sets: 2, planned_reps: 0, planned_weight: 0,
    prescription_verification: { version: 'owner-resolved-v1', auth_user_id: owner } })
  delete manual.prescription
  assert.equal((await app.save(app.body({ exercise_logs: [manual] }))).status, 200)
  assert.equal(app.state.resolverCalls.length, 0)
  const saved = app.state.rows[0].exercise_logs[0]
  assert.equal(saved.prescription, undefined);assert.equal(saved.prescription_verification, undefined)
  assert.equal(saved.planned_sets, 2);assert.equal(saved.set_logs[0].weight, 8.5);assert.equal(saved.set_logs[0].weight_unit, 'kg')
})

test('readiness or equipment changes between selection and first save require reselection rather than trusting the old browser dose', async () => {
  for (const outcome of [
    { httpStatus: 200, response: { status: 'available', prescription: snapshot({ weightLb: 20, sets: 2, reps: 8 }) } },
    { httpStatus: 200, response: { status: 'blocked', message: 'Existing recovery guidance blocks this selection.' } },
    { httpStatus: 200, response: { status: 'unavailable', message: 'Current equipment no longer supports this selection.' } },
  ]) {
    const app = fixture();app.state.outcome = outcome
    assert.equal((await app.save(app.body())).status, 409)
    assert.equal(app.state.resolverCalls.length, 1);assert.equal(app.state.writes.length, 0)
  }
})

test('verified retry retains the initial dose and denominator without recomputing later readiness while actual sets and intent remain editable', async () => {
  const app = fixture()
  assert.equal((await app.save(app.body())).status, 200)
  const initialMarker = plain(app.state.rows[0].exercise_logs[0].prescription_verification)
  app.state.resolverError = new Error('Verified retry must not query newer readiness')
  const actual = [set(1, { weight: 5, reps: 6 }), set(2, { weight: 6, reps: 8 })]
  const response = await app.save(app.body({ sets: actual,
    exercise_logs: [log({ sets: 1, planned_sets: 1, planned_reps: 1, planned_weight: 1,
      prescription: snapshot({ sets: 1, reps: 1, weightLb: 1 }), user_intent: { desired_set_count: 1 },
      prescription_verification: { ...initialMarker, auth_user_id: other } })] }))
  assert.equal(response.status, 200)
  assert.equal(app.state.resolverCalls.length, 1, 'Only the first guided save computes current rules.')
  assert.equal(app.state.rows.length, 1)
  const saved = app.state.rows[0].exercise_logs[0]
  assert.deepEqual(saved.prescription, snapshot());assert.deepEqual(saved.prescription_verification, initialMarker)
  assert.equal(saved.planned_sets, 3);assert.equal(saved.sets, 3);assert.equal(saved.planned_reps, 10);assert.equal(saved.planned_weight, 25)
  assert.equal(saved.user_intent.desired_set_count, 1)
  assert.deepEqual(saved.set_logs, actual)
  assert.equal(app.state.rows[0].completed, true, 'Two actual sets reach half of the fixed three-set prescription.')
  assert.equal((await response.json()).progress.totalSets, 3)
})

test('unverified historical guided metadata and mismatched stored verification cannot become a trusted retry', async () => {
  for (const marker of [undefined, { version: 'owner-resolved-v1', auth_user_id: other },
    { version: 'owner-resolved-v1', auth_user_id: owner, client_id: 'INTEGRITY-FOREIGN', program: 'ignite',
      exercise_id: 'owner-occurrence-one', catalog_exercise_id: 'manual-dumbbell_lateral_raise', variant_id: 'dumbbell_lateral_raise' }]) {
    const app = fixture()
    app.state.rows.push({ id: 'older-unverified-row', client_id: app.client.client_id, auth_user_id: owner,
      program: 'ignite', workout_source: 'manual', day_name: 'Manual Workout', workout_date: '2026-11-02',
      workout_started_at: new Clock().toISOString(), exercise_logs: [log({ prescription_verification: marker })] })
    const before = plain(app.state.rows)
    assert.equal((await app.save(app.body())).status, 409)
    assert.equal(app.state.writes.length, 0)
    assert.deepEqual(plain(app.state.rows), before)
  }
})

test('explicit session equipment first save recomputes owner-bound context without changing saved equipment or planned denominator', async () => {
  for (const equipment of ['cable', 'machine', 'dumbbell']) {
    const app = fixture();app.client.equipment_access = ['bodyweight']
    const beforeClient = plain(app.client), context = sessionContext(equipment), submitted = sessionEquipmentBody(app, context)
    if (equipment === 'machine') {
      submitted.exercise.equipmentContext = plain(context)
      submitted.exercise_logs[0].equipment_context = plain(context)
    }
    const response = await app.save(submitted)
    assert.equal(response.status, 200)
    assert.equal(app.state.resolverCalls.length, 1)
    const resolved = app.state.resolverCalls[0]
    assert.equal(resolved.user.id, owner);assert.equal(resolved.clientId, app.client.client_id)
    assert.equal(resolved.variantId, context.variantId)
    assert.deepEqual(plain(resolved.equipmentContext), context)
    const saved = app.state.rows[0].exercise_logs[0]
    assert.deepEqual(saved.prescription.equipmentContext, context)
    assert.deepEqual(saved.equipment_context, context)
    assert.equal(saved.prescription_verification.auth_user_id, owner)
    assert.equal(saved.prescription_verification.client_id, app.client.client_id)
    assert.equal(saved.prescription_verification.variant_id, context.variantId)
    assert.equal(saved.prescription_verification.session_equipment_source, 'session_override')
    assert.equal(saved.prescription_verification.session_equipment, context.equipment)
    assert.equal(saved.prescription_verification.session_variant_id, context.variantId)
    assert.equal(saved.planned_sets, 3);assert.equal(saved.planned_reps, 10);assert.equal(saved.planned_weight, 25)
    assert.equal(saved.user_intent.desired_set_count, 2)
    assert.equal(saved.set_logs[0].weight, 8.5);assert.equal(saved.set_logs[0].weight_unit, 'kg')
    assert.deepEqual(app.client, beforeClient)
    assert.ok(app.state.writes.every(write => !['clients', 'client_current_profiles', 'program_outputs'].includes(write.table)))
  }
})

test('session equipment snapshot and restored draft retain a frozen copy rather than a mutable context reference', () => {
  const app = fixture(), { prescriptionSnapshot, readManualPrescriptionDraft } = app.load('lib/workout/manualPrescriptionDraft.ts')
  const context = sessionContext(), input = snapshot({ variantId: context.variantId, loadType: 'single_side', equipmentContext: context })
  const parsed = prescriptionSnapshot(input)
  assert.ok(parsed);assert.deepEqual(plain(parsed.equipmentContext), context)
  assert.equal(Object.isFrozen(parsed), true);assert.equal(Object.isFrozen(parsed.equipmentContext), true)
  context.equipment = 'machine'
  assert.equal(parsed.equipmentContext.equipment, 'cable')
  const restored = readManualPrescriptionDraft({ version: 3, prescription: parsed, sets: [set()],
    equipmentContext: sessionContext(), weight: '8.5', weightUnit: 'kg', reps: '7', desiredSetCount: '2', originalPlannedSets: 3 })
  assert.deepEqual(plain(restored.prescription.equipmentContext), sessionContext())
  assert.deepEqual(plain(restored.equipmentContext), sessionContext())
  assert.equal(Object.isFrozen(restored.equipmentContext), true)
  assert.equal(restored.originalPlannedSets, 3);assert.equal(restored.weight, '8.5');assert.equal(restored.reps, '7')
  assert.equal(restored.weightUnit, 'kg');assert.equal(restored.desiredSetCount, '2')
})

test('verified session equipment retry keeps original dose and provenance while actuals and desired sets remain editable', async () => {
  const app = fixture(), first = sessionEquipmentBody(app)
  assert.equal((await app.save(first)).status, 200)
  const original = plain(app.state.rows[0].exercise_logs[0]), originalClient = plain(app.client)
  app.state.resolverError = new Error('A verified session retry must not recompute later readiness or inventory.')
  const actual = [set(1, { weight: 6, reps: 5 }), set(2, { weight: 7, reps: 6 })]
  const retry = sessionEquipmentBody(app)
  delete retry.exercise.prescription.equipmentContext // A valid surviving draft copy still binds the same context.
  retry.sets = actual
  retry.exercise_logs[0].planned_sets = 1;retry.exercise_logs[0].planned_reps = 1;retry.exercise_logs[0].planned_weight = 1
  retry.exercise_logs[0].prescription.sets = 1;retry.exercise_logs[0].prescription.reps = 1;retry.exercise_logs[0].prescription.weightLb = 1
  retry.exercise_logs[0].user_intent = { desired_set_count: 1 }
  retry.exercise_logs[0].prescription_verification = { ...original.prescription_verification, auth_user_id: other }
  const response = await app.save(retry)
  assert.equal(response.status, 200);assert.equal(app.state.resolverCalls.length, 1)
  const saved = app.state.rows[0].exercise_logs[0]
  assert.deepEqual(saved.prescription, original.prescription)
  assert.deepEqual(saved.prescription_verification, original.prescription_verification)
  assert.equal(saved.planned_sets, 3);assert.equal(saved.planned_reps, 10);assert.equal(saved.planned_weight, 25)
  assert.deepEqual(saved.set_logs, actual);assert.equal(saved.user_intent.desired_set_count, 1)
  assert.equal((await response.json()).progress.totalSets, 3)
  assert.deepEqual(app.client, originalClient)
})

test('session equipment tampering or removal on a verified retry rejects before any write or resolver read', async () => {
  const changes = [
    body => { body.exercise_logs[0].prescription.equipmentContext.equipment = 'machine' },
    body => { body.exercise.prescription.equipmentContext.variantId = 'machine_lateral_raise' },
    body => { body.exercise_logs[0].prescription.equipmentContext = null },
    body => { delete body.exercise.prescription.equipmentContext;delete body.exercise_logs[0].prescription.equipmentContext },
    body => { body.exercise.selected_equipment = 'machine' },
    body => { body.exercise_logs[0].selected_equipment = 'machine' },
    body => { body.exercise.equipmentContext = sessionContext('machine') },
    body => { body.exercise_logs[0].equipment_context = sessionContext('machine') },
  ]
  for (const alter of changes) {
    const app = fixture();assert.equal((await app.save(sessionEquipmentBody(app))).status, 200)
    const before = plain(app.state.rows), writes = app.state.writes.length, retry = sessionEquipmentBody(app)
    alter(retry)
    assert.equal((await app.save(retry)).status, 409)
    assert.equal(app.state.writes.length, writes);assert.equal(app.state.resolverCalls.length, 1)
    assert.deepEqual(plain(app.state.rows), before)
  }
})

test('unsupported, wildcard, mismatched or untrusted-owner session context cannot become guided provenance', async () => {
  const contexts = [
    { ...sessionContext(), equipment: '*' }, { ...sessionContext(), equipment: 'free_weights' },
    { ...sessionContext(), equipment: 'invented' }, { ...sessionContext(), source: 'saved_profile' },
    { ...sessionContext(), variantId: 'machine_lateral_raise' }, { ...sessionContext(), auth_user_id: other },
    { ...sessionContext(), equipment_modifier: 2 },
  ]
  for (const context of contexts) {
    const app = fixture(), submitted = sessionEquipmentBody(app)
    submitted.exercise.prescription.equipmentContext = plain(context)
    submitted.exercise_logs[0].prescription.equipmentContext = plain(context)
    assert.equal((await app.save(submitted)).status, 409)
    assert.equal(app.state.writes.length, 0)
  }
  const foreign = fixture(), submitted = sessionEquipmentBody(foreign)
  submitted.client_id = 'INTEGRITY-FOREIGN'
  assert.equal((await foreign.save(submitted)).status, 404)
  assert.equal(foreign.state.writes.length, 0);assert.equal(foreign.state.resolverCalls.length, 0)
  const tracker = fixture({ tier: 'tracker' })
  assert.equal((await tracker.save(sessionEquipmentBody(tracker))).status, 403)
  assert.equal(tracker.state.writes.length, 0);assert.equal(tracker.state.resolverCalls.length, 0)
})

test('Tracker session equipment records only explicit actual context without guidance reads or saved-profile changes', async () => {
  const app = fixture({ tier: 'tracker' });app.client.equipment_access = ['bodyweight']
  const beforeClient = plain(app.client), context = sessionContext()
  const chosen = exercise({ selected_variant_id: context.variantId, selected_equipment: context.equipment,
    load_type: 'single_side', equipmentContext: context, sets: 2 })
  const actual = log({ ...chosen, equipment_context: context, planned_sets: 2, planned_reps: 0, planned_weight: 0,
    prescription_verification: { version: 'owner-resolved-v1', auth_user_id: other } })
  delete actual.prescription
  const response = await app.save(app.body({ exercise: chosen, exercise_logs: [actual] }))
  assert.equal(response.status, 200)
  assert.equal(app.state.resolverCalls.length, 0)
  const saved = app.state.rows[0].exercise_logs[0]
  assert.deepEqual(saved.equipment_context, context)
  assert.equal(saved.selected_equipment, 'cable');assert.equal(saved.selected_variant_id, 'cable_lateral_raise')
  assert.equal(saved.prescription, undefined);assert.equal(saved.prescription_verification, undefined)
  assert.equal(saved.set_logs[0].weight, 8.5);assert.equal(saved.set_logs[0].weight_unit, 'kg')
  assert.equal(saved.set_logs[0].reps, 7);assert.equal(saved.planned_sets, 2)
  assert.deepEqual(app.client, beforeClient)
  assert.ok(app.state.writes.every(write => !['clients', 'client_current_profiles', 'program_outputs'].includes(write.table)))
  const beforeRows = plain(app.state.rows), writes = app.state.writes.length
  const tampered = app.body({ exercise: { ...chosen, equipmentContext: sessionContext('machine') }, exercise_logs: [actual] })
  assert.equal((await app.save(tampered)).status, 409)
  assert.equal(app.state.writes.length, writes);assert.equal(app.state.resolverCalls.length, 0)
  assert.deepEqual(plain(app.state.rows), beforeRows)
})
