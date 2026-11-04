import assert from 'node:assert/strict'
import test, { after, mock } from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { createRequire } from 'node:module'
import ts from 'typescript'
import { importTs } from './typescriptModule.mjs'

mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-11-03T12:00:00Z') })
after(() => mock.timers.reset())
const mocks = {
  '@/lib/program/templateDayIntent': 'export const resolveProgramDayIntent=day=>day.day_intent || null',
  // This adapter is only for the synthetic API/CAS fixtures below. It does not
  // establish support for a production saved format or bypass the real engine's
  // primary-mapping, distribution and dose-preservation validation.
  '@/lib/program/weekdayExerciseMapping': `
    export function resolveVersionedWeekdayExerciseMappings({programJson}) {
      if (programJson?.__testVerifiedWeekdaySource !== true) return {status:'unsupported',issues:[{code:'unverified_template_source',message:'Synthetic fixture is not verified'}]}
      return {status:'compatible',provenance:{templateProgram:'synthetic-only',templateVersion:'fixture-v1',mappingVersion:'test-only'},
        missingWeekdays:[],occurrences:programJson.days.flatMap(day=>day.exercises.map((exercise,index)=>({
          day:day.day_name,index,exercise,mapping:{kind:'movable',primaryMuscles:exercise.primary_muscles,basis:'Synthetic test fixture only'}
        })))}
    }
  `,
  'next/server': 'export const NextResponse={json:(body,options)=>Response.json(body,options)}',
  '@/lib/supabase/server': 'export const createClient=async()=>globalThis.weekdayFixture.db',
}
const helpers = await importTs('lib/program/saveWeekdayMusclePreferences.ts', mocks)
const route = await importTs('app/api/workout/weekday-preferences/route.ts', mocks)
const require = createRequire(import.meta.url)
// The real-adapter case loads source JSON and actual server modules. Only the
// framework response and authenticated synthetic database are substituted.
function realSourceLoader() {
  const cache = new Map()
  const load = path => {
    path = resolve(path)
    if (cache.has(path)) return cache.get(path).exports
    if (path.endsWith('.json')) return JSON.parse(readFileSync(path, 'utf8'))
    const module = { exports: {} }; cache.set(path, module)
    const compiled = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
    } }).outputText
    Function('module', 'exports', 'require', compiled)(module, module.exports, name => {
      if (name === 'server-only') return {}
      if (name === 'next/server') return { NextResponse: { json: (value, options) => Response.json(value, options) } }
      if (name === '@/lib/supabase/server') return { createClient: async () => globalThis.weekdayFixture.db }
      const base = name.startsWith('@/') ? resolve(name.slice(2)) : name.startsWith('.') ? resolve(dirname(path), name) : null
      if (!base) return require(name)
      return load(base.endsWith('.json') || base.endsWith('.ts') ? base : existsSync(base + '.ts') ? base + '.ts' : base + '.tsx')
    })
    return module.exports
  }
  return load
}
const owner = 'weekday-owner', id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', id2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const days = patch => Object.fromEntries(weekdays.map(day => [day, patch[day] || []]))
const choice = { mode: 'custom', days: days({ Monday: ['chest', 'biceps'], Friday: ['core'] }) }
const program = { __testVerifiedWeekdaySource: true, days: [
  { day_name: 'Monday', day_intent: 'training', exercises: [{ exercise: 'Press', primary_muscles: ['chest'], sets: 3, reps: 8, weight: 20, unit: 'lb' }, { exercise: 'Curl', primary_muscles: ['biceps'], sets: 2, reps: 10, weight: 8, unit: 'kg' }] },
  { day_name: 'Thursday', day_intent: 'training', exercises: [{ exercise: 'Core hold', primary_muscles: ['core'], sets: 2, duration: 30 }] },
] }
program.days = weekdays.map(day => program.days.find(source => source.day_name === day) || { day_name: day, day_intent: 'rest', exercises: [] })
const body = (patch = {}) => ({ expectedClientId: 'OWN', expectedUserId: owner, expectedDate: '2026-11-03', expectedRevision: 0, operationId: id, choice, ...patch })
const request = (value = body(), headers = {}) => new Request('https://weekday.test/api/workout/weekday-preferences', { method: 'POST', headers: { origin: 'https://weekday.test', 'content-type': 'application/json', ...headers }, body: typeof value === 'string' ? value : JSON.stringify(value) })

function fixture({ tier = 'ignite', signedIn = true, timezone = 'America/New_York', missingMapping = false, outputMissing = false, outputOwner = owner } = {}) {
  const client = { client_id: 'OWN', auth_user_id: owner, program: tier, timezone, access: true, active: true, verified_purchase: true, subscription_ends_at: '2099-01-01', onboarding_data: { history: { untouched: true }, scheduleOverrides: { slot: { status: 'skipped' } } } }
  const f = { client, signedIn, queries: [], writes: 0, readError: null, writeError: false, beforeWrite: null,
    outputs: outputMissing ? [] : [{ id: 'saved-plan', client_id: 'OWN', auth_user_id: outputOwner, program: tier, program_json: structuredClone(program), generated_at: '2026-11-01T12:00:00Z' }],
    profile: { client_id: 'OWN', user_id: owner, workout_days_available: 2 } }
  if (missingMapping) delete f.outputs[0].program_json.days[0].exercises[0].primary_muscles
  f.db = { auth: { getUser: async () => ({ data: { user: f.signedIn ? { id: owner } : null }, error: null }) }, from(table) {
    const filters = [], sorts = []; let limit, change
    f.queries.push({ table, filters })
    const q = { select() { return q }, eq(k, v) { filters.push(['eq', k, v]); return q }, is(k, v) { filters.push(['is', k, v]); return q }, or(v) { filters.push(['or', v]); return q },
      order(k, options = {}) { sorts.push([k, options.ascending !== false]); return q }, limit(v) { limit = v; return q }, update(v) { change = v; return q },
      async maybeSingle() {
        if (f.readError === table && !change) return { data: null, error: { message: 'Synthetic private read failure' } }
        if (change && f.beforeWrite) { const action = f.beforeWrite; f.beforeWrite = null; action() }
        const rows = table === 'clients' ? [f.client] : table === 'program_outputs' ? f.outputs : table === 'client_current_profiles' ? [f.profile] : []
        let matching = rows.filter(row => filters.every(([kind, k, v]) => kind === 'or' ? row.auth_user_id === owner || row.auth_user_id === null : k === 'onboarding_data' && typeof v === 'string' ? JSON.stringify(row[k]) === v : row[k] === v))
        matching.sort((a, b) => { for (const [key, asc] of sorts) { const diff = String(a[key]).localeCompare(String(b[key])); if (diff) return diff * (asc ? 1 : -1) } return 0 })
        if (limit) matching = matching.slice(0, limit)
        if (change && f.writeError) return { data: null, error: { message: 'Synthetic private write failure' } }
        if (change && matching[0]) { f.writes++; Object.assign(matching[0], structuredClone(change)) }
        return { data: matching[0] ? structuredClone(matching[0]) : null, error: null }
      },
    }; return q
  } }
  globalThis.weekdayFixture = f; return f
}
const save = (f, input = body(), clock) => helpers.saveWeekdayMusclePreferences({ supabase: f.db, user: { id: owner }, input, ...(clock ? { clock } : {}) })

test('API requires same-origin JSON, bounded body and explicit allowlist before any preference write', async () => {
  const f = fixture()
  for (const req of [request(body(), { origin: 'https://foreign.test' }), request(body(), { 'sec-fetch-site': 'cross-site' }), request(body(), { origin: '' })]) assert.equal((await route.POST(req)).status, 403)
  assert.equal((await route.POST(request(body(), { 'content-type': 'text/plain' }))).status, 415)
  assert.equal((await route.POST(request('x'.repeat(13 * 1024)))).status, 413)
  assert.equal((await route.POST(request(body({ clientId: 'OTHER' })))).status, 400)
  assert.equal((await route.POST(request(body({ choice: { mode: 'custom', days: { Monday: ['chest'] } } })))).status, 400)
  assert.equal(f.writes, 0)
})
test('canonical owner and current capabilities gate all reads; account fences cannot choose another member', async () => {
  for (const options of [{ signedIn: false }, { tier: 'tracker' }, { tier: 'free' }]) {
    const f = fixture(options), response = await route.POST(request())
    assert.equal(response.status, options.signedIn === false ? 401 : 403); assert.equal(f.writes, 0)
    assert.equal(f.queries.some(query => query.table === 'program_outputs'), false)
  }
  const f = fixture()
  for (const patch of [{ expectedClientId: 'OTHER' }, { expectedUserId: 'other-owner' }]) assert.equal((await route.POST(request(body(patch)))).status, 409)
  assert.equal(f.writes, 0)
})
test('saved plan source is newest matching owner/tier or owned legacy null, never another owner output', async () => {
  const f = fixture({ outputOwner: null })
  f.outputs.push({ ...structuredClone(f.outputs[0]), id: 'foreign-newer', auth_user_id: 'foreign', generated_at: '2090-01-01' }, { ...structuredClone(f.outputs[0]), id: 'wrong-tier', program: 'phoenix', generated_at: '2091-01-01' })
  const context = await helpers.readWeekdayMusclePreferenceContext({ supabase: f.db, user: { id: owner } })
  assert.equal(context.ok, true); assert.equal(context.sourceStatus.status, 'available'); assert.equal(context.sourceOutput.id, 'saved-plan'); assert.equal(f.writes, 0)
  const query = f.queries.find(query => query.table === 'program_outputs')
  assert.deepEqual(query.filters, [['eq', 'client_id', 'OWN'], ['eq', 'program', 'ignite'], ['or', `auth_user_id.eq.${owner},auth_user_id.is.null`]])
  const foreign = fixture({ outputOwner: 'foreign' })
  assert.equal((await helpers.readWeekdayMusclePreferenceContext({ supabase: foreign.db, user: { id: owner } })).sourceStatus.status, 'unavailable')
})
test('custom first save records next-week pending choice only and preserves unrelated history, schedule and program bytes', async () => {
  const f = fixture(), originalPlan = JSON.stringify(f.outputs), original = structuredClone(f.client.onboarding_data)
  const response = await route.POST(request()), result = await response.json()
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'private, no-store')
  assert.equal(result.success, true); assert.equal(result.view.revision, 1); assert.equal(result.view.status, 'pending')
  assert.equal(result.view.current, null); assert.equal(result.view.pending.effectiveDate, '2026-11-09')
  assert.deepEqual(result.view.pending.choice, choice); assert.equal(f.writes, 1)
  assert.equal(result.focusPlans.current.mode, 'program_default'); assert.equal(result.focusPlans.current.status, 'available')
  assert.equal(result.focusPlans.pending.mode, 'custom'); assert.equal(result.focusPlans.pending.status, 'available')
  assert.equal(result.focusPlans.pending.effectiveDate, result.view.pending.effectiveDate)
  assert.deepEqual(result.focusPlans.pending.preferredDays, [{ day: 'Monday', groups: ['Chest', 'Biceps'] }, { day: 'Friday', groups: ['Core'] }])
  assert.deepEqual(result.focusPlans.pending.workDays, ['Monday', 'Friday']); assert.deepEqual(result.focusPlans.pending.fixedExtraDays, [])
  const refreshed = await helpers.readWeekdayMusclePreferenceContext({ supabase: f.db, user: { id: owner }, now: new Date('2026-11-04T12:00:00Z') })
  assert.deepEqual(refreshed.focusPlans.pending, result.focusPlans.pending); assert.equal(f.writes, 1)
  assert.deepEqual(f.client.onboarding_data.history, original.history); assert.deepEqual(f.client.onboarding_data.scheduleOverrides, original.scheduleOverrides); assert.equal(JSON.stringify(f.outputs), originalPlan)
})
test('missing primary mapping or unsupported distribution stays explicit; program-default reset remains allowed', async () => {
  const f = fixture({ missingMapping: true })
  const context = await helpers.readWeekdayMusclePreferenceContext({ supabase: f.db, user: { id: owner } })
  assert.equal(context.sourceStatus.status, 'unsupported'); assert.match(context.sourceStatus.issues.join(' '), /no verified primary-muscle mapping/)
  const rejected = await route.POST(request()); assert.equal(rejected.status, 422); assert.equal(f.writes, 0)
  const reset = await route.POST(request(body({ choice: { mode: 'program_default' } })))
  const resetResult = await reset.json()
  assert.equal(reset.status, 200); assert.equal(resetResult.view.pending.choice.mode, 'program_default')
  assert.equal(resetResult.focusPlans.pending.mode, 'program_default'); assert.equal(resetResult.focusPlans.pending.status, 'unsupported')
  assert.equal(resetResult.focusPlans.pending.workDays, undefined)
  const missing = fixture({ outputMissing: true })
  assert.equal((await route.POST(request())).status, 503); assert.equal(missing.writes, 0)
  const missingReset = await route.POST(request(body({ choice: { mode: 'program_default' } })))
  assert.equal(missingReset.status, 200); const missingResult = await missingReset.json()
  assert.equal(missingResult.focusPlans.pending.status, 'unavailable'); assert.equal(missingResult.focusPlans.pending.workDays, undefined)
})
test('confirmed retry retains original effective date across local rollover; changed same-operation or stale requests cannot overwrite', async () => {
  const f = fixture(), first = await save(f)
  assert.equal(first.ok, true)
  const replay = await save(f, body(), () => new Date('2026-11-10T12:00:00Z'))
  assert.equal(replay.ok, true); assert.equal(replay.replayed, true); assert.equal(replay.view.current.effectiveDate, '2026-11-09'); assert.equal(f.writes, 1)
  assert.deepEqual(replay.view.current, first.view.pending)
  assert.deepEqual(replay.focusPlans.current, first.focusPlans.pending); assert.equal(replay.focusPlans.pending, null)
  assert.equal((await save(f, body({ choice: { mode: 'program_default' } }))).status, 409)
  assert.equal((await save(f, body({ operationId: id2 }))).status, 409)
  const fresh = fixture()
  assert.equal((await save(fresh, body(), () => new Date('2026-11-04T12:00:00Z'))).code, 'DAY_CHANGED'); assert.equal(fresh.writes, 0)
})
test('JSON CAS preserves unrelated concurrent preference writes and rejects newer weekday choices', async () => {
  const f = fixture()
  f.beforeWrite = () => { f.client.onboarding_data.routinePreferences = { revision: 3, kept: true } }
  const saved = await save(f)
  assert.equal(saved.ok, true); assert.equal(f.writes, 1); assert.deepEqual(f.client.onboarding_data.routinePreferences, { revision: 3, kept: true })
  const newer = fixture()
  const pure = await importTs('lib/program/weekdayMusclePreferences.ts')
  newer.beforeWrite = () => { newer.client.onboarding_data = pure.mergeWeekdayMusclePreferences(newer.client.onboarding_data, { expectedRevision: 0, operationId: id2, choice: { mode: 'program_default' }, today: '2026-11-03', savedAt: '2026-11-03T12:01:00Z' }).onboardingData }
  assert.equal((await save(newer)).status, 409); assert.equal(newer.writes, 0); assert.equal(newer.client.onboarding_data.weekdayMusclePreferences.pending.choice.mode, 'program_default')
})
test('source and write failures stay unavailable with prior saved state preserved; malformed state cannot reset', async () => {
  const f = fixture(); f.writeError = true
  const original = JSON.stringify(f.client.onboarding_data)
  assert.equal((await route.POST(request())).status, 503); assert.equal(f.writes, 0); assert.equal(JSON.stringify(f.client.onboarding_data), original)
  f.writeError = false; f.readError = 'client_current_profiles'
  assert.equal((await save(f)).status, 503); assert.equal(f.writes, 0)
  f.readError = 'clients'; assert.equal((await save(f)).status, 503)
  f.readError = null; f.client.onboarding_data.weekdayMusclePreferences = { malformed: true }
  assert.equal((await save(f, body({ choice: { mode: 'program_default' } }))).status, 409); assert.equal(f.writes, 0)
})
test('member-local date controls Monday wait and a CAS retry crossing midnight cannot activate an early date', async () => {
  const f = fixture({ timezone: 'America/Los_Angeles' })
  const monday = await save(f, body({ expectedDate: '2026-11-02' }), () => new Date('2026-11-03T07:30:00Z'))
  assert.equal(monday.ok, true); assert.equal(monday.view.pending.effectiveDate, '2026-11-09')
  const crossing = fixture(); let reads = 0
  const result = await save(crossing, body(), () => new Date(++reads < 3 ? '2026-11-03T12:00:00Z' : '2026-11-04T12:00:00Z'))
  assert.equal(result.code, 'DAY_CHANGED'); assert.equal(crossing.writes, 0)
})

test('real verified six-day generated plan saves preferred focus with named extra workdays and restores truthful pending/current summaries', async () => {
  const load = realSourceLoader()
  const actualRoute = load('app/api/workout/weekday-preferences/route.ts')
  const actualHelpers = load('lib/program/saveWeekdayMusclePreferences.ts')
  const { generateProgram } = load('lib/program/generateProgram.ts')
  const strengthAssessment = { bench_press_weight: 50, bench_press_reps: 8, shoulder_press_weight: 20, shoulder_press_reps: 8,
    squat_weight: 50, squat_reps: 8, romanian_deadlift_weight: 50, romanian_deadlift_reps: 8,
    seated_row_weight: 40, seated_row_reps: 8, bicep_curl_weight: 10, bicep_curl_reps: 8,
    lateral_raise_weight: 10, lateral_raise_reps: 8, close_grip_press_weight: 30, close_grip_press_reps: 8 }
  // Pure, synthetic generation prepares a fixture only; viewing/saving the
  // preference below must retain that saved source byte-for-byte.
  const generated = generateProgram({ client: { program: 'ember', equipment_access: ['full gym'] }, initialAssessment: {}, strengthAssessment })
  assert.equal(generated.days.length, 6)
  const f = fixture({ tier: 'ember' }); f.profile.workout_days_available = 4
  f.outputs[0].program_json = generated
  const before = JSON.stringify(f.outputs)
  const selected = { mode: 'custom', days: days({ Monday: ['chest', 'biceps'] }) }
  const submitted = body({ choice: selected })
  const response = await actualRoute.POST(request(submitted)), saved = await response.json()
  assert.equal(response.status, 200, JSON.stringify(saved))
  const summary = saved.focusPlans.pending
  assert.equal(summary.status, 'available'); assert.equal(summary.mode, 'custom'); assert.equal(summary.effectiveDate, '2026-11-09')
  assert.deepEqual(summary.preferredDays, [{ day: 'Monday', groups: ['Chest', 'Biceps'] }])
  assert.deepEqual(summary.workDays, ['Monday', 'Tuesday', 'Thursday', 'Friday'])
  assert.deepEqual(summary.unspecifiedDays, ['Sunday'])
  assert.deepEqual(summary.fixedExtraDays.map(day => day.day), ['Tuesday', 'Thursday', 'Friday'])
  assert.deepEqual(summary.fixedExtraDays[0].exercises, generated.days.find(day => day.day_name === 'Tuesday').exercises.map(exercise => exercise.exercise))
  assert.deepEqual(summary.fixedExtraDays[1].exercises, ['Seated Cable Row', 'Lat Pulldown', 'Single-Arm Dumbbell Row', 'Face Pull', 'Hammer Curl', 'Upright Cable Row', 'Side Plank', 'Side Plank'])
  assert.deepEqual(summary.fixedExtraDays[2].exercises, generated.days.find(day => day.day_name === 'Friday').exercises.map(exercise => exercise.exercise))
  assert.equal(summary.fixedExtraDays.flatMap(day => day.exercises).includes('undefined'), false)
  assert.equal(saved.focusPlans.current.mode, 'program_default'); assert.deepEqual(saved.focusPlans.current.unspecifiedDays, ['Sunday'])
  const retryResponse = await actualRoute.POST(request(submitted)), retry = await retryResponse.json()
  assert.equal(retryResponse.status, 200); assert.equal(retry.replayed, true); assert.deepEqual(retry.view, saved.view); assert.deepEqual(retry.focusPlans, saved.focusPlans)
  const refresh = await actualHelpers.readWeekdayMusclePreferenceContext({ supabase: f.db, user: { id: owner }, now: new Date('2026-11-04T12:00:00Z') })
  assert.deepEqual(refresh.focusPlans.pending, summary); assert.equal(refresh.focusPlans.current.mode, 'program_default')
  const effective = await actualHelpers.readWeekdayMusclePreferenceContext({ supabase: f.db, user: { id: owner }, now: new Date('2026-11-09T12:00:00Z') })
  assert.deepEqual(effective.focusPlans.current, summary); assert.equal(effective.focusPlans.pending, null)
  assert.equal(JSON.stringify(f.outputs), before); assert.equal(f.writes, 1)
})
