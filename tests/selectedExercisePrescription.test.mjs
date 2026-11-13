import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const owner = '11111111-1111-4111-8111-111111111111'
const clone = value => JSON.parse(JSON.stringify(value))
const fixed = Date.parse('2026-11-02T15:00:00Z')
class Clock extends Date { constructor(...args) { super(...(args.length ? args : [fixed])) } static now() { return fixed } }

function loader(mocks = {}) {
  const cache = new Map()
  function load(path) {
    path = resolve(path)
    if (cache.has(path)) return cache.get(path).exports
    if (path.endsWith('.json')) return JSON.parse(readFileSync(path, 'utf8'))
    const module = { exports: {} };cache.set(path, module)
    const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
    } }).outputText
    runInNewContext(code, { module, exports: module.exports, Date: Clock, Intl, Request, Response, URL, Buffer,
      console: { error() {} }, require(name) {
        if (Object.hasOwn(mocks, name)) return mocks[name]
        if (name === 'server-only') return {}
        const base = name.startsWith('@/') ? resolve(name.slice(2)) : name.startsWith('.') ? resolve(dirname(path), name) : null
        if (!base) return require(name)
        return load(/\.(?:json|tsx?)$/.test(base) ? base : existsSync(base + '.ts') ? base + '.ts' : base + '.tsx')
      },
    }, { filename: path })
    return module.exports
  }
  return load
}

const actual = loader()
const { generateProgram, getFounderSelectedExercise } = actual('lib/program/generateProgram.ts')
const { buildSelectedPrescription } = actual('lib/workout/selectedPrescription.ts')
const { getManualWorkoutLibrary, getSessionEquipmentForMuscles, filterSessionManualExercises, isReferenceSessionVariant } = actual('lib/workout/manualWorkout.ts')
const { capabilityForPath, isProtectedApiPath, membershipCan } = actual('lib/membership/policy.ts')
const catalog = name => getManualWorkoutLibrary().find(exercise => exercise.exercise === name)
const client = () => ({ client_id: 'OWNED', auth_user_id: owner, program: 'ember', current_weight: 180, access: true, active: true,
  verified_purchase: true, membership_expires_at: '2035-01-01T00:00:00Z', equipment_access: ['full gym'],
  timezone: 'America/Chicago', capacity_state: 'high', injuries: [], limitations: [], primary_goal: 'strength' })
const strength = { shoulder_press_weight: '45', shoulder_press_reps: '8', lateral_raise_weight: '10', lateral_raise_reps: '10',
  squat_weight: '90', squat_reps: '8', bench_press_weight: '75', bench_press_reps: '8', romanian_deadlift_weight: '95', romanian_deadlift_reps: '8',
  seated_row_weight: '70', seated_row_reps: '8', bicep_curl_weight: '15', bicep_curl_reps: '10', close_grip_press_weight: '50', close_grip_press_reps: '8' }
const founder = (name = 'Dumbbell Lateral Raise', variantId = 'dumbbell_lateral_raise', extra = {}) => getFounderSelectedExercise({
  client: client(), initialAssessment: { equipmentAccess: 'full gym' }, strengthAssessment: strength,
  catalogExercise: catalog(name), variantId, now: new Clock(), ...extra,
})
const inputs = patch => ({ date: '2026-11-02', userId: owner, client: client(), program: 'ember',
  dailyPlan: { calories: 2000, dailyTargets: { protein: 100, carbs: 200, fats: 60, water: 90 }, dailyRemaining: { calories: 2000, protein: 100, carbs: 200, fats: 60, water: 90 } },
  todayRecovery: { check_in_completed_at: new Clock().toISOString(), energy_level: 8, sleep_hours: 8, sleep_quality: 8, stress_level: 2, soreness_level: 1 },
  recentRecovery: [], todaySymptoms: [], recentSymptoms: [], nutritionLogs: [], nutritionTotals: [], macroEntries: [], mealEntries: [],
  recentFuelingHistory: [], workoutHistory: [], strengthAssessments: [{ data: strength }], initialAssessment: { data: {} },
  photoRecord: null, todayWorkoutFeedback: null, executionHistory: [], missedDayCount: 0, monthlyAssessmentsDueCount: 0,
  todayRecoveryActivities: [], phoenixTaskIds: [], healthMetrics: { today: {}, recent: [] }, ...patch })

test('selected assessment load honors the existing strength field bounds and rejects nonnumeric value types', () => {
  for (const value of [3001, '3001', true, false, [10], {}, 'Infinity', 'NaN']) {
    assert.equal(founder('Dumbbell Lateral Raise', 'dumbbell_lateral_raise', { strengthAssessment: { ...strength, lateral_raise_weight: value } }), null)
  }
})

test('selected founder base matches existing generated load and template dose without changing inputs or generating a plan on selection', () => {
  const before = clone(strength), selected = founder()
  assert.ok(selected)
  const generated = generateProgram({ client: client(), initialAssessment: { equipmentAccess: 'full gym' }, strengthAssessment: strength })
  const saved = generated.days.flatMap(day => day.exercises).find(exercise => exercise.exercise === 'Dumbbell Lateral Raise')
  assert.equal(selected.exercise.calculated_weight, saved.calculated_weight)
  assert.equal(selected.exercise.sets, saved.sets);assert.equal(selected.exercise.reps, saved.reps)
  assert.equal(selected.exercise.load_type, 'per_hand')
  assert.deepEqual(strength, before)
})

test('one existing variant conversion is applied and each original load semantic is retained', () => {
  for (const [variantId, loadType] of [['dumbbell_lateral_raise', 'per_hand'], ['cable_lateral_raise', 'single_side'], ['machine_lateral_raise', 'machine_total']]) {
    const base = founder('Dumbbell Lateral Raise', variantId)
    assert.ok(base)
    const response = buildSelectedPrescription({ inputs: inputs(), exercise: base.exercise, variantId })
    assert.equal(response.status, 'available')
    assert.equal(response.prescription.loadType, loadType)
    assert.equal(response.prescription.weightLb, actual('lib/workout/weightRounding.ts').roundSuggestedWeightLb(base.exercise, actual('lib/cycle/getCycleTrainingAdjustment.ts').roundRecommendedWeight(base.exercise.calculated_weight)))
    assert.equal(response.prescription.exerciseId, catalog('Dumbbell Lateral Raise').id)
    assert.equal(response.prescription.version, 'founder-selected-v1')
    assert.ok(response.prescription.sets > 0 && response.prescription.reps > 0)
  }
})

test('approved paid tiers use their exact tier or Phoenix track template and no-IF load formula', () => {
  for (const [program, phoenix_track] of [['ember', undefined], ['ignite', undefined], ['phoenix', 'phoenixStrength']]) {
    const selected = founder('Dumbbell Lateral Raise', 'dumbbell_lateral_raise', { client: { ...client(), program }, phoenixTrack: phoenix_track })
    assert.ok(selected)
    assert.equal(selected.template.program, phoenix_track || program)
    assert.equal(selected.exercise.intensity_factor, undefined)
    assert.equal(selected.exercise.prescription_calculation.version, 'founder-load-v3')
    assert.ok(selected.exercise.sets > 0 && selected.exercise.reps > 0)
  }
  assert.equal(founder('Dumbbell Lateral Raise', 'dumbbell_lateral_raise', { client: { ...client(), program: 'phoenix' } }), null)
})

test('a real unloaded template exercise retains zero added load, while external zero or missing inputs cannot become guidance', () => {
  const exercise = catalog('Sumo Squat'), variant = exercise.available_variants.find(item => item.equipment === 'bodyweight')
  const base = founder('Sumo Squat', variant.id)
  assert.ok(base);assert.equal(base.exercise.calculated_weight, 0)
  const response = buildSelectedPrescription({ inputs: inputs(), exercise: base.exercise, variantId: variant.id })
  assert.equal(response.status, 'available');assert.equal(response.prescription.weightLb, 0)
  assert.equal(response.prescription.loadType, 'bodyweight')
  assert.equal(founder('Sumo Squat', variant.id, { strengthAssessment: { ...strength, squat_weight: undefined } }), null)
  assert.ok(founder('Sumo Squat', variant.id, { strengthAssessment: { ...strength, squat_weight: '0' } }))
  for (const value of [undefined, '', 'NaN', '0', '-2']) {
    assert.equal(founder('Dumbbell Lateral Raise', 'dumbbell_lateral_raise', { strengthAssessment: { ...strength, lateral_raise_weight: value } }), null)
  }
  assert.equal(founder('Dumbbell Lateral Raise', 'missing_variant'), null)
  assert.equal(founder('Dumbbell Lateral Raise', 'dumbbell_lateral_raise', { client: { ...client(), equipment_access: ['bodyweight'] } }), null)
})

test('a catalog exercise absent from its tier template cannot borrow dose from a shared group or unknown Phoenix track', () => {
  const library = getManualWorkoutLibrary(), templates = actual('data/template/emberGym.json')
  const names = new Set(templates.days.flatMap(day => day.exercises.map(exercise => exercise.exercise)))
  const absent = library.find(exercise => !names.has(exercise.exercise) && exercise.available_variants.some(variant => variant.id === 'dumbbell_lateral_raise'))
  assert.ok(absent, 'Fixture must share the established lateral-raise variant but lack an exact template dose.')
  assert.equal(founder(absent.exercise, 'dumbbell_lateral_raise'), null)
  assert.equal(founder('Dumbbell Lateral Raise', 'dumbbell_lateral_raise', { client: { ...client(), program: 'phoenix', phoenix_track: 'invented_track' } }), null)
})

test('missing master key, BWF, rep chart or established dose is unavailable without coefficient or template defaults', () => {
  const keyRows = actual('data/reference/masterKey.json')
  const template = actual('data/template/emberGym.json')
  for (const mocks of [
    { '@/data/reference/masterKey.json': [] },
    { '@/data/reference/masterKey.json': keyRows.map(row => ({ ...row, bodyweight_factor: undefined })) },
    { '@/data/reference/hypertrophyChart_normalized.json': [] },
    { '@/data/template/emberGym.json': { ...template, days: template.days.map(day => ({ ...day, exercises: day.exercises.map(exercise => ({ ...exercise, sets: 0 })) })) } },
    { '@/data/template/emberGym.json': { ...template, days: template.days.map(day => ({ ...day, exercises: day.exercises.map(exercise => ({ ...exercise, reps: null })) })) } },
  ]) {
    const resolve = loader(mocks)('lib/program/generateProgram.ts').getFounderSelectedExercise
    assert.equal(resolve({ client: client(), initialAssessment: { equipmentAccess: 'full gym' }, strengthAssessment: strength,
      catalogExercise: catalog('Dumbbell Lateral Raise'), variantId: 'dumbbell_lateral_raise', now: new Clock() }), null)
  }
})

test('cycle, capacity, symptoms and individual restrictions retain the existing safety rules and no raw input is returned', () => {
  const base = founder()
  const regular = buildSelectedPrescription({ inputs: inputs(), exercise: base.exercise, variantId: 'dumbbell_lateral_raise' })
  const cycle = buildSelectedPrescription({ inputs: inputs({ client: { ...client(), cycle_tracking_enabled: true, last_period_start: '2026-11-01', average_cycle_length: 28 } }), exercise: base.exercise, variantId: 'dumbbell_lateral_raise' })
  assert.equal(regular.status, 'available');assert.equal(cycle.status, 'available')
  assert.ok(cycle.prescription.weightLb <= regular.prescription.weightLb)
  const unrelated = buildSelectedPrescription({ inputs: inputs({ client: { ...client(), injuries: ['unrelated recorded ankle restriction'] } }), exercise: base.exercise, variantId: 'dumbbell_lateral_raise' })
  assert.equal(unrelated.status, 'available', 'A generic note must not introduce a blanket block absent from the existing decision path.')
  const relevant = buildSelectedPrescription({ inputs: inputs({ photoRecord: { posture_flags: { shoulder: true } } }),
    exercise: { ...base.exercise, movement_tags: ['fixed_overhead'], regression_options: ['Supported alternative'] }, variantId: 'dumbbell_lateral_raise' })
  assert.equal(relevant.status, 'blocked', 'An existing structural substitution cannot masquerade as the selected catalog exercise.')
  assert.equal(buildSelectedPrescription({ inputs: inputs({ todaySymptoms: [{ severity: 9, symptom_types: { name: 'chest pain', category: 'pain' } }] }), exercise: base.exercise, variantId: 'dumbbell_lateral_raise' }).status, 'blocked')
  assert.deepEqual(Object.keys(regular.prescription).sort(), ['exerciseId', 'loadType', 'reps', 'sets', 'variantId', 'version', 'weightLb'])
})

function routeFixture() {
  const state = { user: { id: owner }, client: client(), profile: { client_id: 'OWNED', user_id: owner, equipment_access: ['full gym'] },
    initial: { client_id: 'OWNED', data: { equipmentAccess: 'full gym' } }, strength: { client_id: 'OWNED', data: strength },
    outputs: [], queries: [], writes: 0, failTable: null, rejectTable: null, attemptMutation: false }
  const database = { auth: { getUser: async () => ({ data: { user: state.user }, error: null }) }, from(table) {
    const filters = [], disjunctions = [], ordering = [];let type, rowLimit
    const query = { select() { return query }, eq(key, value) { filters.push([key, value]);if(key==='assessment_type')type=value;return query },
      order(key, options) { ordering.push([key, options?.ascending !== false]);return query }, limit(value) { rowLimit=value;return query },
      or(expression) { assert.equal(expression, `auth_user_id.eq.${owner},auth_user_id.is.null`);disjunctions.push(expression);return query },
      insert() { state.writes++;return query }, update() { state.writes++;return query }, upsert() { state.writes++;return query },
      maybeSingle: async () => execute(), then: (yes, no) => Promise.resolve(execute()).then(yes, no) }
    function execute() {
      state.queries.push({ table, filters: clone(filters), disjunctions: clone(disjunctions), ordering: clone(ordering), rowLimit })
      if (state.rejectTable === table) throw new Error('synthetic transport failure')
      if (state.failTable === table) return { data: null, error: { message: 'synthetic private failure' } }
      const records = table === 'program_outputs' ? state.outputs : [table === 'clients' ? state.client : table === 'client_current_profiles' ? state.profile : type === 'initial' ? state.initial : state.strength]
      let rows = records.filter(row => row && filters.every(([key, value]) => key==='assessment_type' || row[key] === value) &&
        disjunctions.every(() => row.auth_user_id === owner || row.auth_user_id === null))
      for (const [key, ascending] of ordering) rows = rows.sort((a,b) => String(a[key] || '').localeCompare(String(b[key] || '')) * (ascending ? 1 : -1))
      if (rowLimit !== undefined) rows=rows.slice(0,rowLimit)
      return { data: rows[0] || null, error: null }
    }
    return query
  } }
  const load = loader({
    'next/server': { NextResponse: { json: (body, options) => Response.json(body, options) } },
    '@/lib/supabase/server': { createClient: async () => database },
    '@/lib/safety/getRecentSafetyFlags': { getRecentSafetyFlags: async () => [] },
    '@/lib/safety/evaluateSafetyEscalation': { evaluateSafetyEscalation: () => [] },
    '@/lib/day/getDailyExecutionPlan': { getDailyExecutionPlan: async ({ supabase }) => {
      if (state.attemptMutation) { try { await supabase.from('program_outputs').insert({ forbidden: true }) } catch {} }
      if (state.rejectTable) { try { await supabase.from(state.rejectTable).select('*') } catch {} }
      return {}
    } },
    '@/lib/dashboard/logic/loadProgramLogicInputs': { loadProgramLogicInputs: async ({ client }) => inputs({ client, program: client.program }) },
  })
  const POST = load('app/api/workout/prescription/route.ts').POST
  const resolveShared = load('lib/workout/resolveSelectedPrescription.ts').resolveSelectedPrescription
  return { state, request: body => POST(new Request('https://synthetic.invalid/api/workout/prescription', { method: 'POST', body: JSON.stringify(body) })),
    resolve: options => resolveShared({ supabase: database, user: state.user, ...selection(), ...options }) }
}
const selection = () => ({ exerciseId: catalog('Dumbbell Lateral Raise').id, variantId: 'dumbbell_lateral_raise' })

test('route verifies authenticated owner/tier, blocks untrusted account input and keeps Tracker away from health reads', async () => {
  for (const [program, status] of [['tracker', 200], ['free', 403], ['unknown', 403]]) {
    const app = routeFixture();app.state.client.program = program
    const result = await app.request(selection());assert.equal(result.status, status)
    if(program==='tracker')assert.equal((await result.json()).status, 'tracking_only')
    assert.equal(app.state.queries.filter(query => query.table !== 'clients').length, 0)
  }
  const anonymous = routeFixture();anonymous.state.user=null;assert.equal((await anonymous.request(selection())).status,401)
  const foreign = routeFixture();foreign.state.client.auth_user_id='another-owner';assert.equal((await foreign.request(selection())).status,404)
  const expired = routeFixture();expired.state.client.membership_expires_at='2020-01-01T00:00:00Z';assert.equal((await expired.request(selection())).status,403)
  const injected = routeFixture();assert.equal((await injected.request({...selection(),clientId:'FOREIGN',program:'phoenix'})).status,400)
  assert.equal(injected.state.queries.length,0)
  assert.equal(isProtectedApiPath('/api/workout/prescription'),true)
  assert.equal(capabilityForPath('/api/workout/prescription','POST'),'generatedCoaching')
  assert.equal(membershipCan(client(),'generatedCoaching'),true)
  assert.equal(membershipCan({...client(),program:'tracker'},'generatedCoaching'),false)
})

test('paid route reads only owned saved inputs, returns a minimal snapshot and never writes plans or exposes answers', async () => {
  const app = routeFixture(), result = await app.request(selection())
  assert.equal(result.status,200);const payload=await result.json();assert.equal(payload.status,'available')
  assert.equal(payload.prescription.exerciseId,selection().exerciseId)
  assert.equal(app.state.writes,0)
  for(const query of app.state.queries.filter(query=>query.table!=='clients'))assert.ok(query.filters.some(([key,value])=>key==='client_id'&&value==='OWNED'))
  const profile=app.state.queries.find(query=>query.table==='client_current_profiles');assert.ok(profile.filters.some(([key,value])=>key==='user_id'&&value===owner))
  assert.doesNotMatch(JSON.stringify(payload),/shoulder_press|lateral_raise_weight|birthdate|injuries|auth_user_id|profile/)
  const missing=routeFixture();missing.state.strength=null
  const unavailable=await (await missing.request(selection())).json();assert.equal(unavailable.status,'unavailable');assert.equal(unavailable.setupHref,'/dashboard/assessment/start2')
  const failed=routeFixture();failed.state.failTable='client_current_profiles';assert.equal((await failed.request(selection())).status,503)
  const mutation=routeFixture();mutation.state.attemptMutation=true;assert.equal((await mutation.request(selection())).status,503);assert.equal(mutation.state.writes,0)
  const rejected=routeFixture();rejected.state.rejectTable='nutrition_logs';assert.equal((await rejected.request(selection())).status,503);assert.equal(rejected.state.writes,0)
})

const phoenixOutput = patch => ({ id: 'output-owned', client_id: 'OWNED', auth_user_id: owner, program: 'phoenix',
  generated_at: '2026-11-02T14:00:00Z', program_json: { phoenix_track: 'phoenixStrength' }, ...patch })

test('production-shaped Phoenix uses the saved output track and shared resolution matches the endpoint without phantom fields', async () => {
  const app = routeFixture();app.state.client.program='phoenix';app.state.outputs=[phoenixOutput()]
  assert.equal('phoenix_track' in app.state.client,false);assert.equal('phoenix_track' in app.state.profile,false)
  const endpoint=await app.request(selection());assert.equal(endpoint.status,200)
  const body=await endpoint.json();assert.equal(body.status,'available')
  const shared=await app.resolve({ clientId:'OWNED' });assert.equal(shared.httpStatus,200)
  assert.deepEqual(clone(shared.response),body)
  const base=founder('Dumbbell Lateral Raise','dumbbell_lateral_raise',{client:app.state.client,phoenixTrack:'phoenixStrength'})
  const expected=buildSelectedPrescription({inputs:inputs({client:app.state.client,program:'phoenix'}),exercise:base.exercise,variantId:'dumbbell_lateral_raise'})
  assert.deepEqual(clone(shared.response),clone(expected))
  assert.equal(base.template.program,'phoenixStrength')
  assert.doesNotMatch(JSON.stringify(body),/phoenix_track|phoenixStrength|shoulder_press_weight|initial|profile/)
  assert.equal(app.state.writes,0)
})

test('Phoenix newest matching-program output remains bounded by client and owner-or-legacy-NULL together', async () => {
  for (const auth_user_id of [owner,null]) {
    const app=routeFixture();app.state.client.program='phoenix'
    app.state.outputs=[
      phoenixOutput({id:'old-owned',generated_at:'2026-10-01T00:00:00Z',program_json:{phoenix_track:'phoenixHypertrophy'}}),
      phoenixOutput({id:'newest-eligible',auth_user_id}),
      phoenixOutput({id:'foreign-owner',auth_user_id:'other-owner',generated_at:'2026-11-03T00:00:00Z',program_json:{phoenix_track:'unknown'}}),
      phoenixOutput({id:'foreign-client-null',client_id:'FOREIGN',auth_user_id:null,generated_at:'2026-11-04T00:00:00Z',program_json:{phoenix_track:'unknown'}}),
      phoenixOutput({id:'wrong-program-null',program:'ignite',auth_user_id:null,generated_at:'2026-11-05T00:00:00Z',program_json:{phoenix_track:'unknown'}}),
    ]
    const result=await app.resolve({clientId:'OWNED'});assert.equal(result.httpStatus,200);assert.equal(result.response.status,'available')
    const query=app.state.queries.find(row=>row.table==='program_outputs')
    assert.deepEqual(query.filters,[['client_id','OWNED'],['program','phoenix']])
    assert.deepEqual(query.disjunctions,[`auth_user_id.eq.${owner},auth_user_id.is.null`])
    assert.deepEqual(query.ordering,[['generated_at',false]]);assert.equal(query.rowLimit,1)
    assert.equal(app.state.writes,0)
  }
})

test('missing or unknown newest Phoenix track never falls back to client, profile or an older saved output', async () => {
  for (const outputs of [[],[phoenixOutput({program_json:{}})],
    [phoenixOutput({program_json:{phoenix_track:'invented_track'}})],
    [phoenixOutput({id:'old-valid',generated_at:'2026-10-01T00:00:00Z'}),phoenixOutput({id:'new-missing',program_json:{}})]]) {
    const app=routeFixture();app.state.client.program='phoenix';app.state.client.phoenix_track='phoenixStrength';app.state.profile.phoenix_track='phoenixStrength'
    app.state.outputs=outputs
    const result=await app.resolve({clientId:'OWNED'});assert.equal(result.httpStatus,200);assert.equal(result.response.status,'unavailable')
    assert.equal(result.response.setupHref,'/dashboard/onboarding/plan')
    assert.equal(app.state.queries.some(query=>['assessments','client_current_profiles'].includes(query.table)),false)
    assert.equal(app.state.writes,0)
  }
  const failed=routeFixture();failed.state.client.program='phoenix';failed.state.failTable='program_outputs'
  assert.equal((await failed.resolve({clientId:'OWNED'})).httpStatus,503)
})

test('Phoenix rejects caller track injection and foreign ownership; selected helper requires an explicit validated track', async () => {
  const app=routeFixture();app.state.client.program='phoenix'
  app.state.outputs=[phoenixOutput({client_id:'FOREIGN',auth_user_id:null}),phoenixOutput({auth_user_id:'other-owner'})]
  assert.equal((await app.request({...selection(),phoenix_track:'phoenixStrength'})).status,400)
  assert.equal(app.state.queries.length,0)
  const foreign=await app.resolve({clientId:'FOREIGN'});assert.equal(foreign.httpStatus,404)
  assert.equal(app.state.queries.some(query=>query.table==='program_outputs'),false)
  const unavailable=await app.resolve({clientId:'OWNED'});assert.equal(unavailable.response.status,'unavailable')
  const phantomClient={...client(),program:'phoenix',phoenix_track:'phoenixStrength'}
  assert.equal(founder('Dumbbell Lateral Raise','dumbbell_lateral_raise',{client:phantomClient}),null)
  assert.equal(founder('Dumbbell Lateral Raise','dumbbell_lateral_raise',{client:phantomClient,phoenixTrack:'invented_track'}),null)
  assert.equal(app.state.writes,0)
})

const explicitEquipment = (equipment, variantId) => ({ source: 'session_override', equipment, variantId })

test('explicit session equipment uses only real variants and the unchanged founder coefficients despite saved bodyweight inventory', () => {
  for (const [name, variantId, equipment, loadType] of [
    ['Dumbbell Lateral Raise', 'dumbbell_lateral_raise', 'dumbbell', 'per_hand'],
    ['Dumbbell Lateral Raise', 'cable_lateral_raise', 'cable', 'single_side'],
    ['Dumbbell Lateral Raise', 'machine_lateral_raise', 'machine', 'machine_total'],
    ['Shoulder Press', 'barbell_shoulder_press', 'barbell', 'total_load'],
  ]) {
    const saved = { ...client(), equipment_access: ['bodyweight'] }, before = clone(saved)
    const selected = founder(name, variantId, { client: saved, equipmentContext: explicitEquipment(equipment, variantId) })
    const original = founder(name, variantId)
    assert.ok(selected, `${equipment} must use an established real variant and template dose`);assert.ok(original)
    assert.equal(selected.exercise.calculated_weight, original.exercise.calculated_weight)
    assert.equal(selected.exercise.sets, original.exercise.sets);assert.equal(selected.exercise.reps, original.exercise.reps)
    assert.equal(selected.exercise.load_type, loadType)
    assert.equal(selected.exercise.intensity_factor, original.exercise.intensity_factor)
    assert.equal(selected.exercise.rep_multiplier, original.exercise.rep_multiplier)
    assert.deepEqual(saved, before)
  }
  assert.equal(founder('Dumbbell Lateral Raise', 'cable_lateral_raise', { client: { ...client(), equipment_access: ['bodyweight'] } }), null)
  assert.equal(founder('Dumbbell Lateral Raise', 'kettlebell_lateral_raise', { equipmentContext: explicitEquipment('kettlebell', 'kettlebell_lateral_raise') }), null)
  const bodyweight=catalog('Sumo Squat').available_variants.find(item=>item.equipment==='bodyweight')
  assert.equal(founder('Sumo Squat',bodyweight.id,{equipmentContext:explicitEquipment('bodyweight',bodyweight.id)}),null,'An inferred catalog fallback is not a reference-backed override.')
  assert.equal(founder('Sumo Squat',bodyweight.id).exercise.calculated_weight,0,'The existing saved-default bodyweight path keeps genuine zero added load.')
})

test('session equipment helpers exclude inferred combinations while saved-default catalog availability remains unchanged', () => {
  const equipment=clone(getSessionEquipmentForMuscles([]))
  assert.deepEqual(equipment,['barbell','cable','dumbbell','machine'])
  assert.ok(getManualWorkoutLibrary().some(exercise=>exercise.available_variants.some(variant=>variant.equipment==='bodyweight')))
  for(const choice of equipment) {
    const results=filterSessionManualExercises({muscles:[],equipment:[choice]})
    assert.ok(results.length>0)
    for(const exercise of results)for(const variant of exercise.available_variants) {
      assert.equal(variant.equipment,choice);assert.equal(isReferenceSessionVariant(exercise,variant.id,choice),true)
    }
  }
  for(const unsupported of ['bodyweight','kettlebell','free_weights','*']) {
    assert.equal(filterSessionManualExercises({muscles:[],equipment:[unsupported]}).length,0)
  }
})

test('session preview carries a minimal canonical override through safety calculation without changing saved profile or assessments', async () => {
  for (const equipment of ['dumbbell', 'cable', 'machine']) {
    const app = routeFixture();app.state.client.equipment_access=['bodyweight'];app.state.profile.equipment_access=['bodyweight']
    const before=clone({ client:app.state.client, profile:app.state.profile, initial:app.state.initial, strength:app.state.strength })
    const variantId=`${equipment}_lateral_raise`, equipmentContext=explicitEquipment(equipment,variantId)
    const response=await app.request({ ...selection(),variantId,equipmentContext })
    assert.equal(response.status,200);const payload=await response.json();assert.equal(payload.status,'available')
    assert.deepEqual(payload.prescription.equipmentContext,equipmentContext)
    assert.equal(payload.prescription.variantId,variantId)
    assert.deepEqual(clone({ client:app.state.client, profile:app.state.profile, initial:app.state.initial, strength:app.state.strength }),before)
    assert.equal(app.state.writes,0)
    assert.doesNotMatch(JSON.stringify(payload),/auth_user_id|equipment_modifier|lateral_raise_weight|injuries/)
    const noOverride=await (await app.request({ ...selection(),variantId })).json()
    assert.equal(noOverride.status,'unavailable','Saved inventory still controls requests without an explicit session override.')
  }
})

test('session preview rejects malformed, wildcard, mismatched and fabricated context without inventing equipment or guidance', async () => {
  for (const equipmentContext of [null,[], 'cable',
    explicitEquipment('*','cable_lateral_raise'),explicitEquipment('free_weights','cable_lateral_raise'),
    explicitEquipment('machine','cable_lateral_raise'),explicitEquipment('cable','machine_lateral_raise'),
    { ...explicitEquipment('cable','cable_lateral_raise'), source:'saved_profile' },
    { ...explicitEquipment('cable','cable_lateral_raise'), auth_user_id:'other-owner' },
    { ...explicitEquipment('cable','cable_lateral_raise'), equipment_modifier:2 },
  ]) {
    const app=routeFixture(), response=await app.request({ ...selection(),variantId:'cable_lateral_raise',equipmentContext })
    assert.equal(response.status,400);assert.equal(app.state.writes,0)
    assert.equal(app.state.queries.some(query=>query.table!=='clients'),false)
  }
  const absent=routeFixture()
  assert.equal((await absent.request({ ...selection(),variantId:'kettlebell_lateral_raise',equipmentContext:explicitEquipment('kettlebell','kettlebell_lateral_raise') })).status,400)
  assert.equal(absent.state.writes,0)
})

test('session override cannot bypass ownership, tier, safety or Phoenix saved-track requirements', async () => {
  const equipmentContext=explicitEquipment('cable','cable_lateral_raise'), selected={...selection(),variantId:'cable_lateral_raise',equipmentContext}
  const foreign=routeFixture();foreign.state.client.auth_user_id='other-owner';assert.equal((await foreign.request(selected)).status,404)
  for(const program of ['free','unknown']) {
    const app=routeFixture();app.state.client.program=program;assert.equal((await app.request(selected)).status,403)
    assert.equal(app.state.queries.some(query=>query.table!=='clients'),false)
  }
  const tracker=routeFixture();tracker.state.client.program='tracker'
  const tracking=await tracker.request(selected);assert.equal(tracking.status,200);assert.equal((await tracking.json()).status,'tracking_only')
  assert.equal(tracker.state.queries.some(query=>query.table!=='clients'),false)
  assert.equal((await tracker.request({...selected,equipmentContext:{...equipmentContext,load:1}})).status,400)
  const phoenix=routeFixture();phoenix.state.client.program='phoenix';phoenix.state.client.phoenix_track='phoenixStrength'
  assert.equal((await (await phoenix.request(selected)).json()).status,'unavailable')
  assert.equal(phoenix.state.queries.some(query=>['assessments','client_current_profiles'].includes(query.table)),false)
  const base=founder('Dumbbell Lateral Raise','cable_lateral_raise',{client:{...client(),equipment_access:['bodyweight']},equipmentContext})
  assert.equal(buildSelectedPrescription({inputs:inputs({todaySymptoms:[{severity:9,symptom_types:{name:'chest pain',category:'pain'}}]}),exercise:base.exercise,variantId:'cable_lateral_raise'}).status,'blocked')
})
