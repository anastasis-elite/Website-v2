import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const owner = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'
const oldId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const foreignId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const clone = value => JSON.parse(JSON.stringify(value))

// Actual source/JSON modules run against synthetic data and disposable mocks.
// No environment credentials, account, hosted database, browser or provider runs.
function loader(mocks = {}, globals = {}) {
  const cache = new Map()
  function load(path) {
    path = resolve(path)
    if (cache.has(path)) return cache.get(path).exports
    if (path.endsWith('.json')) return JSON.parse(readFileSync(path, 'utf8'))
    const module = { exports: {} };cache.set(path, module)
    const compiled = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText
    runInNewContext(compiled, { module, exports: module.exports, Date, Request, Response, URL, Buffer,
      process: { env: { NODE_ENV: 'test' } }, console: { error() {} }, ...globals,
      require(name) {
        if (Object.hasOwn(mocks, name)) return mocks[name]
        if (name === 'server-only') return {}
        const base = name.startsWith('@/') ? resolve(name.slice(2)) : name.startsWith('.') ? resolve(dirname(path), name) : null
        if (!base) return require(name)
        const source = ['.json', '.ts', '.tsx'].some(extension => base.endsWith(extension)) ? base : existsSync(base + '.ts') ? base + '.ts' : base + '.tsx'
        return load(source)
      },
    }, { filename: path })
    return module.exports
  }
  return load
}

const loadActual = loader()
const generate = loadActual('lib/program/generateProgram.ts').generateProgram
const strength = { weight: '150', height_in: '66', bench_press_weight: '45', bench_press_reps: '8', squat_weight: '45', squat_reps: '8' }
const args = equipment => ({ client: { program: 'ember', equipment_access: equipment }, initialAssessment: { equipmentAccess: 'full gym' }, strengthAssessment: strength })
const generated = () => generate(args([]))
const incomplete = () => ({ ...generated(), days: generated().days.map(day => day.day_name === 'Monday' ? { ...day, exercises: [] } : day) })

function fixture() {
  const state = {
    user: { id: owner }, client: { client_id: 'OWNED', auth_user_id: owner, program: 'ember', access: true, active: true, verified_purchase: true, membership_expires_at: '2035-01-01T12:00:00Z' },
    profile: { client_id: 'OWNED', user_id: owner, equipment_access: [], injuries: [], limitations: [] },
    assessments: [{ id: 'initial-synthetic', client_id: 'OWNED', auth_user_id: owner, assessment_type: 'initial', submitted_at: '2026-10-01T12:00:00Z', data: { equipmentAccess: 'full gym' } },
      { id: 'strength-synthetic', client_id: 'OWNED', auth_user_id: owner, assessment_type: 'strength', submitted_at: '2026-10-02T12:00:00Z', data: strength }],
    outputs: [{ id: oldId, client_id: 'OWNED', auth_user_id: owner, program: 'ember', status: 'generated', generated_at: '2026-10-18T12:00:00Z', program_json: incomplete() }],
    workoutLogs: [{ id: 'preserved-workout', client_id: 'OWNED', exercise_logs: [{ exercise: 'Squat', completed: true }] }],
    queries: [], insertAttempts: [], failSave: false, readError: null, invalidations: 0, audits: [],
  }
  const tables = () => ({ clients: [state.client], client_current_profiles: [state.profile], assessments: state.assessments, program_outputs: state.outputs })
  const database = {
    auth: { getUser: async () => ({ data: { user: state.user }, error: null }) },
    from(table) {
      const conditions = [], order = [], disjunctions = [];let limit = null, insert = null
      const query = {
        select() { return query }, eq(key, value) { conditions.push([key, value]);return query },
        or(expression) {
          assert.match(expression, /^auth_user_id\.eq\.[0-9a-f-]+,auth_user_id\.is\.null$/i)
          disjunctions.push(expression);return query
        },
        order(key, options) { order.push([key, options?.ascending !== false]);return query }, limit(value) { limit = value;return query },
        insert(value) { insert = clone(value);return query },
        update() { assert.fail('Repair must not overwrite existing rows.') }, delete() { assert.fail('Repair must not delete saved history.') },
        async maybeSingle() { const result = await execute();return { data: result.data?.[0] || null, error: result.error } },
        async single() { const result = await execute();return { data: result.data?.[0] || null, error: result.error } },
        then(yes, no) { return execute().then(yes, no) },
      }
      async function execute() {
        state.queries.push({ table, conditions: clone(conditions), disjunctions: clone(disjunctions), insert: Boolean(insert) })
        if (state.readError === table && !insert) return { data: null, error: { message: 'synthetic load failure' } }
        if (insert) {
          assert.equal(table, 'program_outputs');state.insertAttempts.push(clone(insert))
          if (state.failSave) return { data: null, error: { code: 'synthetic', message: 'synthetic save failure' } }
          if (Object.hasOwn(state, 'duplicateWinnerOwner')) {
            const auth_user_id = state.duplicateWinnerOwner;delete state.duplicateWinnerOwner
            state.outputs.push({ ...clone(insert), auth_user_id })
            return { data: null, error: { code: '23505', message: 'synthetic concurrent winner' } }
          }
          if (state.outputs.some(row => row.id === insert.id)) return { data: null, error: { code: '23505', message: 'synthetic duplicate' } }
          const row = { ...insert, id: insert.id || `saved-${state.outputs.length}` }
          state.outputs.push(row);return { data: [clone(row)], error: null }
        }
        let rows = (tables()[table] || []).filter(row => conditions.every(([key, value]) => row[key] === value) &&
          disjunctions.every(expression => row.auth_user_id === expression.split(',')[0].slice('auth_user_id.eq.'.length) || row.auth_user_id === null))
        for (const [key, ascending] of order) rows = rows.slice().sort((a, b) => String(a[key]).localeCompare(String(b[key])) * (ascending ? 1 : -1))
        return { data: clone(limit === null ? rows : rows.slice(0, limit)), error: null }
      }
      return query
    },
  }
  const mocks = {
    'next/server': { NextResponse: { json: (body, options) => Response.json(body, options) } },
    '@/lib/supabase/server': { createClient: async () => database },
    '@/lib/dashboard/invalidateDailyPlan': { invalidateDailyPlan: () => state.invalidations++ },
    '@/lib/legal/logRecommendationAudit': { logRecommendationAudit: async input => state.audits.push(input.recommendationType) },
  }
  const load = loader(mocks)
  const request = body => load('app/api/program/generate/route.ts').POST(new Request('https://synthetic.invalid/api/program/generate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }))
  const savedHistory = () => clone({ oldOutput: state.outputs.find(row => row.id === oldId), assessments: state.assessments, workoutLogs: state.workoutLogs, client: state.client, profile: state.profile })
  return { state, database, request, savedHistory, load }
}

test('empty and absent equipment use saved full gym without overriding explicit bodyweight or home equipment restrictions', () => {
  const full = generated()
  assert.equal(full.days.find(day => day.day_name === 'Monday').exercises.length, 8)
  assert.deepEqual(clone(generate(args(undefined)).days), clone(full.days))
  for (const equipment of [['bodyweight'], ['home gym']]) {
    const restricted = generate(args(equipment)), monday = restricted.days.find(day => day.day_name === 'Monday')
    assert.equal(monday.day_intent, 'training')
    assert.ok(monday.exercises.length < 8)
    assert.ok(restricted.excluded_exercises.length > 0)
    assert.ok(restricted.days.flatMap(day => day.exercises).every(exercise => !exercise.selected_equipment || exercise.selected_equipment === 'bodyweight'))
  }
})

test('saved plan completeness preserves rest intent and distinguishes missing, filtered empty and usable plans', () => {
  const { getSavedPlanState } = loadActual('lib/program/getSavedPlanState.ts')
  assert.equal(getSavedPlanState(null).status, 'missing')
  const bad = getSavedPlanState({ program: 'ember', program_json: incomplete() })
  assert.equal(bad.status, 'incomplete');assert.ok(bad.incompleteDays.includes('Monday'))
  const ready = getSavedPlanState({ program: 'ember', program_json: generated() })
  assert.equal(ready.status, 'ready')
  assert.deepEqual(clone(ready.incompleteDays), [])
  const unknown = getSavedPlanState({ program: 'unknown', program_json: { days: [{ day_name: 'Monday', exercises: [] }] } })
  assert.equal(unknown.status, 'incomplete')
})

test('repair authenticates and owner-binds inputs before writing and denies unavailable coaching access', async () => {
  const app = fixture(), before = app.savedHistory()
  app.state.user = null
  assert.equal((await app.request({ client_id: 'OWNED', repair_output_id: oldId })).status, 401)
  app.state.user = { id: other }
  assert.equal((await app.request({ client_id: 'OWNED', repair_output_id: oldId })).status, 404)
  app.state.user = { id: owner }
  assert.equal((await app.request({ client_id: 'OTHER', repair_output_id: oldId })).status, 404)
  assert.equal((await app.request({ client_id: 'OWNED', repair_output_id: foreignId })).status, 404)
  app.state.client.access = false
  assert.equal((await app.request({ client_id: 'OWNED', repair_output_id: oldId })).status, 403)
  app.state.client.access = true
  assert.equal(app.state.insertAttempts.length, 0)
  assert.deepEqual(app.savedHistory(), before)
})

test('owned incomplete plan repair appends one usable plan and retry returns the saved result without replacing history', async () => {
  const app = fixture(), before = app.savedHistory()
  const body = { client_id: 'OWNED', repair_output_id: oldId }
  const response = await app.request(body), result = await response.json()
  assert.equal(response.status, 200);assert.equal(result.success, true)
  assert.equal(app.state.outputs.length, 2);assert.equal(app.state.insertAttempts.length, 1)
  const saved = app.state.outputs[1]
  assert.equal(saved.auth_user_id, owner);assert.equal(saved.client_id, 'OWNED')
  assert.equal(saved.program_json.days.find(day => day.day_name === 'Monday').exercises.length, 8)
  assert.deepEqual(app.savedHistory(), before)
  const replay = await app.request(body), replayed = await replay.json()
  assert.equal(replay.status, 200);assert.equal(replayed.success, true);assert.equal(replayed.replayed, true)
  assert.equal(replayed.savedProgram.id, result.savedProgram.id)
  assert.equal(app.state.outputs.length, 2);assert.equal(app.state.insertAttempts.length, 1)
  assert.deepEqual(app.savedHistory(), before)
})

test('failed save, incomplete regeneration and stale repair cannot overwrite prior plans or claim success', async () => {
  const failed = fixture(), before = failed.savedHistory()
  failed.state.failSave = true
  assert.equal((await failed.request({ client_id: 'OWNED', repair_output_id: oldId })).status, 500)
  assert.equal(failed.state.outputs.length, 1);assert.equal(failed.state.invalidations, 0)
  assert.deepEqual(failed.savedHistory(), before)
  failed.state.failSave = false
  assert.equal((await failed.request({ client_id: 'OWNED', repair_output_id: oldId })).status, 200)
  assert.equal(failed.state.outputs.length, 2)
  assert.deepEqual(failed.savedHistory(), before)
  const restricted = fixture();restricted.state.profile.equipment_access = ['bodyweight']
  const restrictedBefore = restricted.savedHistory()
  const incompleteResponse = await restricted.request({ client_id: 'OWNED', repair_output_id: oldId })
  assert.equal(incompleteResponse.status, 409)
  assert.equal((await incompleteResponse.json()).success, undefined)
  assert.equal(restricted.state.outputs.length, 1);assert.equal(restricted.state.insertAttempts.length, 0)
  assert.deepEqual(restricted.savedHistory(), restrictedBefore)
  const stale = fixture()
  stale.state.outputs.push({ ...clone(stale.state.outputs[0]), id: foreignId, generated_at: '2026-10-19T12:00:00Z' })
  assert.equal((await stale.request({ client_id: 'OWNED', repair_output_id: oldId })).status, 409)
  assert.equal(stale.state.outputs.length, 2);assert.equal(stale.state.insertAttempts.length, 0)
  const unsafe = fixture();unsafe.state.profile.injuries = ['chest pain']
  const safetyResponse = await unsafe.request({ client_id: 'OWNED', repair_output_id: oldId })
  assert.equal(safetyResponse.status, 409)
  assert.ok((await safetyResponse.json()).safetyFlags.length > 0)
  assert.equal(unsafe.state.outputs.length, 1);assert.equal(unsafe.state.insertAttempts.length, 0)
})

test('concurrent repair requests converge on one deterministic owned output and preserve original logs', async () => {
  const app = fixture(), before = app.savedHistory(), body = { client_id: 'OWNED', repair_output_id: oldId }
  const results = await Promise.all([app.request(body), app.request(body)])
  assert.deepEqual(results.map(result => result.status), [200, 200])
  const payloads = await Promise.all(results.map(result => result.json()))
  assert.equal(payloads[0].savedProgram.id, payloads[1].savedProgram.id)
  assert.equal(app.state.outputs.length, 2)
  assert.deepEqual(app.savedHistory(), before)
})

function nodes(node, predicate) {
  const found = []
  const visit = value => {
    if (Array.isArray(value)) return value.forEach(visit)
    if (!value || typeof value !== 'object') return
    if (predicate(value)) found.push(value)
    visit(value.props?.children)
  }
  visit(node);return found
}
const content = node => Array.isArray(node) ? node.map(content).join('') : node && typeof node === 'object' ? content(node.props?.children) : node == null ? '' : String(node)

test('repair control is explicit, locks rapid clicks and exposes save failure before navigation or a safe retry', async () => {
  const slots = [], calls = [], navigations = [];let cursor = 0, resolveRequest
  const hook = {
    useState(initial) { const index = cursor++;if (!(index in slots)) slots[index] = initial;return [slots[index], value => { slots[index] = value }] },
    useRef(initial) { const index = cursor++;return slots[index] ||= { current: initial } },
  }
  const fetch = async (url, options) => { calls.push({ url, body: JSON.parse(options.body) });return new Promise(resolve => { resolveRequest = resolve }) }
  const load = loader({ react: hook, 'next/navigation': { useRouter: () => ({ push: path => navigations.push(path), refresh() {} }) }, '@/app/styles/globalstyles': {} }, { fetch })
  const Component = load('components/GenerateSavedPlan.tsx').default
  const render = () => { cursor = 0;return Component({ clientId: 'OWNED', program: 'ember', repairOutputId: oldId }) }
  let tree = render();assert.equal(calls.length, 0)
  const click = nodes(tree, node => node.type === 'button')[0].props.onClick
  const pending = click();click();tree = render()
  assert.equal(calls.length, 1);assert.equal(calls[0].body.repair_output_id, oldId)
  assert.equal(nodes(tree, node => node.type === 'button')[0].props.disabled, true)
  assert.match(content(tree), /repair|creat|sav|updat/i)
  resolveRequest(Response.json({ error: 'Synthetic save failure; your previous plan is preserved.' }, { status: 500 }))
  await pending;tree = render()
  assert.equal(navigations.length, 0);assert.ok(nodes(tree, node => node.props?.role === 'alert').length)
  assert.match(content(tree), /Synthetic save failure/)
  const retry = nodes(tree, node => node.type === 'button')[0].props.onClick()
  resolveRequest(Response.json({ success: true, savedProgram: { id: 'saved-synthetic' } }))
  await retry;tree = render()
  assert.deepEqual(navigations, ['/dashboard/program/ember'])
  assert.equal(calls.length, 2)
})

test('saved-plan setup keeps repair reachable for incomplete output, redirects a usable plan and preserves load errors', async () => {
  const app = fixture(), redirects = []
  const load = loader({
    'next/navigation': { redirect: path => { redirects.push(path);throw new Error('synthetic redirect') } },
    'next/link': { __esModule: true, default: 'a' },
    '@/lib/dashboard/getDashboardContext': { getDashboardContext: async () => ({ supabase: app.database, client: app.state.client, user: app.state.user }) },
    '@/components/GenerateSavedPlan': { __esModule: true, default: 'repair-control' },
    '@/app/styles/globalstyles': {},
  })
  const Page = load('app/dashboard/onboarding/plan/page.tsx').default
  const page = await Page()
  assert.equal(redirects.length, 0)
  const control = nodes(page, node => node.type === 'repair-control')[0]
  assert.equal(control.props.repairOutputId, oldId)
  app.state.outputs[0].program_json = generated()
  await assert.rejects(Page(), /synthetic redirect/)
  assert.equal(redirects.at(-1), '/dashboard/program/ember')
  app.state.readError = 'program_outputs'
  await assert.rejects(Page(), /saved|load|try again/i)
})

function setupPage(app) {
  const redirects = []
  const load = loader({
    'next/navigation': { redirect: path => { redirects.push(path);throw new Error('synthetic redirect') } },
    'next/link': { __esModule: true, default: 'a' },
    '@/lib/dashboard/getDashboardContext': { getDashboardContext: async () => ({ supabase: app.database, client: app.state.client, user: app.state.user }) },
    '@/components/GenerateSavedPlan': { __esModule: true, default: 'repair-control' },
    '@/app/styles/globalstyles': {},
  })
  return { Page: load('app/dashboard/onboarding/plan/page.tsx').default, redirects }
}

test('legacy NULL output ownership admits an authenticated client repair and current ready result without rewriting legacy history', async () => {
  const legacy = fixture();legacy.state.outputs[0].auth_user_id = null
  const before = legacy.savedHistory(), setup = setupPage(legacy)
  const page = await setup.Page()
  assert.equal(setup.redirects.length, 0)
  assert.equal(nodes(page, node => node.type === 'repair-control')[0].props.repairOutputId, oldId)
  const response = await legacy.request({ client_id: 'OWNED', repair_output_id: oldId }), result = await response.json()
  assert.equal(response.status, 200);assert.equal(result.success, true)
  assert.equal(legacy.state.outputs[1].auth_user_id, owner)
  assert.deepEqual(legacy.savedHistory(), before)
  const latestLegacy = fixture();latestLegacy.state.outputs[0].auth_user_id = null
  latestLegacy.state.outputs.push({ ...clone(latestLegacy.state.outputs[0]), id: foreignId,
    generated_at: '2026-10-19T12:00:00Z', program_json: generated() })
  const replay = await latestLegacy.request({ client_id: 'OWNED', repair_output_id: oldId }), replayed = await replay.json()
  assert.equal(replay.status, 200);assert.equal(replayed.replayed, true)
  assert.equal(replayed.savedProgram.id, foreignId);assert.equal(latestLegacy.state.insertAttempts.length, 0)
  const readySetup = setupPage(latestLegacy)
  await assert.rejects(readySetup.Page(), /synthetic redirect/)
  assert.equal(readySetup.redirects[0], '/dashboard/program/ember')
  const explicitOwner = fixture()
  assert.equal((await explicitOwner.request({ client_id: 'OWNED', repair_output_id: oldId })).status, 200)
  assert.equal(explicitOwner.state.outputs[1].auth_user_id, owner)
})

test('legacy NULL output ownership stays bounded by client and program and excludes conflicting explicit owners', async () => {
  const variants = [
    { auth_user_id: other },
    { auth_user_id: null, client_id: 'FOREIGN' },
    { auth_user_id: null, program: 'ignite' },
  ]
  for (const patch of variants) {
    const app = fixture();Object.assign(app.state.outputs[0], patch)
    assert.equal((await app.request({ client_id: 'OWNED', repair_output_id: oldId })).status, 404)
    assert.equal(app.state.insertAttempts.length, 0)
    const setup = setupPage(app), page = await setup.Page()
    assert.equal(setup.redirects.length, 0)
    assert.equal(nodes(page, node => node.type === 'repair-control')[0].props.repairOutputId, undefined)
  }
  const mixed = fixture();mixed.state.outputs[0].auth_user_id = null
  for (const [index, patch] of variants.entries()) mixed.state.outputs.push({ ...clone(mixed.state.outputs[0]), ...patch,
    id: `cccccccc-cccc-4ccc-8ccc-ccccccccccc${index}`, generated_at: '2026-10-19T12:00:00Z', program_json: generated() })
  const setup = setupPage(mixed), page = await setup.Page()
  assert.equal(setup.redirects.length, 0)
  assert.equal(nodes(page, node => node.type === 'repair-control')[0].props.repairOutputId, oldId)
  const response = await mixed.request({ client_id: 'OWNED', repair_output_id: oldId }), result = await response.json()
  assert.equal(response.status, 200)
  assert.notEqual(result.savedProgram.id, mixed.state.outputs[1].id)
  assert.equal(mixed.state.outputs.at(-1).auth_user_id, owner)
})

test('legacy NULL repair eligibility never broadens new writes or duplicate-winner ownership', async () => {
  for (const winningOwner of [owner, null, other]) {
    const app = fixture();app.state.outputs[0].auth_user_id = null
    app.state.duplicateWinnerOwner = winningOwner
    const response = await app.request({ client_id: 'OWNED', repair_output_id: oldId }), result = await response.json()
    assert.equal(app.state.insertAttempts.length, 1)
    assert.equal(app.state.insertAttempts[0].auth_user_id, owner)
    assert.equal(response.status, winningOwner === owner ? 200 : 500)
    assert.equal(result.success, winningOwner === owner ? true : undefined)
    const winnerRead = app.state.queries.find(query => query.table === 'program_outputs' && !query.insert &&
      query.conditions.some(([key, value]) => key === 'id' && value === app.state.insertAttempts[0].id))
    assert.ok(winnerRead)
    assert.ok(winnerRead.conditions.some(([key, value]) => key === 'auth_user_id' && value === owner))
    assert.ok(winnerRead.conditions.some(([key, value]) => key === 'client_id' && value === 'OWNED'))
    assert.ok(winnerRead.conditions.some(([key, value]) => key === 'program' && value === 'ember'))
    assert.deepEqual(winnerRead.disjunctions, [])
    assert.equal(app.state.outputs[0].auth_user_id, null)
  }
})

test('malformed saved plan content shares the neutral workout availability gate and cannot masquerade as training or rest', () => {
  const { getSavedPlanState } = loadActual('lib/program/getSavedPlanState.ts')
  const { getWorkoutForToday, hasUsableTrainingExercises } = loadActual('lib/workout/getWorkoutForToday.ts')
  const neutral = (day, exercises) => getWorkoutForToday({ inputs: { client: { timezone: 'Etc/UTC' } },
    recoveryStatus: 'normal_training_day', fuelReadiness: { status: 'well_fueled' }, capacityStatus: 'high_capacity',
    plannedWorkout: day, assignedExercises: Array.isArray(exercises) ? exercises : [],
  })
  const malformed = [null, undefined, [], [null], [{}], [1], ['Squat'], [{ exercise: 123 }], [{ name: '  ' }],
    [{ exercise: '90/90 breathing', exercise_category: 'recovery' }],
    [{}, { exercise: 'Easy walk', movement_type: 'recovery' }], [{ display_name: 'Gentle mobility flow' }]]
  for (const exercises of malformed) {
    const day = { day_name: 'Monday', day_intent: 'training', exercises }
    assert.equal(hasUsableTrainingExercises(exercises), false)
    assert.equal(getSavedPlanState({ program: 'ember', program_json: { days: [day] } }).status, 'incomplete')
    assert.equal(neutral(day, exercises).type, 'unavailable')
  }
  for (const exercise of [{ exercise: 'Squat' }, { name: 'Row' }, { display_name: 'Lunge' }]) {
    const day = { day_name: 'Monday', day_intent: 'training', exercises: [exercise] }
    const rest = { day_name: 'Wednesday', day_intent: 'rest', exercises: [] }
    assert.equal(hasUsableTrainingExercises(day.exercises), true)
    assert.equal(getSavedPlanState({ program: 'ember', program_json: { days: [day, rest] } }).status, 'ready')
    assert.equal(neutral(day, day.exercises).type, 'planned')
    assert.equal(neutral(rest, []).type, 'rest')
  }
  for (const exercises of [null, [null], [{}], [{ exercise: 'Squat' }], [{ exercise: 'Easy walk', exercise_category: 'recovery' }]]) {
    const rest = { day_name: 'Wednesday', day_intent: 'rest', exercises }
    assert.equal(getSavedPlanState({ program: 'ember', program_json: { days: [rest] } }).status, 'incomplete')
    assert.equal(neutral(rest, exercises).type, 'unavailable')
  }
  assert.equal(getSavedPlanState({ program: 'ember', program_json: { days: [{ day_name: 'Wednesday', day_intent: 'rest', exercises: [] }] } }).status, 'incomplete')
})
