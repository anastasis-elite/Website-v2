import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'

const mocks = {
  'next/server': 'export const NextResponse = { json: (body, init) => Response.json(body, init) }',
  '@/lib/mobile/auth': 'export const createMobileRequestContext = async () => ({ error: \"Unauthorized\", status: 401 })',
  '@/lib/supabase/server': 'export const createClient = async () => globalThis.membershipGateDb',
  '@/lib/supabase/admin': 'export const createAdminClient = () => { globalThis.membershipAdminCalls++; return {} }',
  '@/lib/dashboard/invalidateDailyPlan': 'export const invalidateDailyPlan = () => {}',
  '@/lib/analytics/server': 'export const recordConversion = async (_db, value) => { globalThis.membershipConversions.push(value); return true }',
  '@/lib/program/getProgramWorkout': 'export const projectWeekdayProgram = () => { throw new Error("Denied members must not reach weekday projection") }',
  '@/lib/nutrition/targetService': 'export const calculateClientNutritionTargets = async () => { throw new Error("Tracker must not calculate personalized targets") }; export const normalizeCyclePhase = value => value; export const nutritionLogAuditFields = () => ({})',
}
const tracker = await importTs('app/api/tracker/nutrition/route.ts', mocks)
const workout = await importTs('app/api/workout-log/route.ts', mocks)
const recovery = await importTs('app/api/recovery/activity/route.ts', mocks)
const generated = await importTs('app/api/program/workout/route.ts', mocks)
const water = await importTs('app/api/nutrition/add-water/route.ts', mocks)
const targets = await importTs('app/api/nutrition/route.ts', mocks)
const { calendarContext } = await importTs('lib/calendar/server-context.ts', mocks)
const { communityIdentity } = await importTs('lib/community/server.ts', mocks)
const { getMealLoggingAccess } = await importTs('lib/nutrition/mealLoggingAccess.ts', mocks)
const { createMobileRequestContext } = await importTs('lib/mobile/auth.ts', { '@supabase/supabase-js': 'export const createClient = () => globalThis.membershipGateDb' })
const { getClientLocalDate } = await importTs('lib/timezone.ts')
const requestId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const owner = 'synthetic-owner'

function database({ tier = 'tracker', expired = false, signedIn = true, verified = true, lookupError = false } = {}) {
  const client = { client_id: 'owned-client', auth_user_id: owner, program: tier, access: true, active: true, timezone: 'Etc/UTC', subscription_ends_at: expired ? '2020-01-01T00:00:00Z' : null }
  const user = signedIn ? { id: owner, email_confirmed_at: verified ? '2026-01-01T00:00:00Z' : null } : null
  const calls = [], writes = [], rpcCalls = [], log = { id: 'owned-log', client_id: client.client_id, auth_user_id: owner, log_date: getClientLocalDate(client), calories: 0, protein: 0, carbs: 0, fats: 0, water_consumed_oz: 16, tracking_only: true }
  const db = { client, user, calls, writes, rpcCalls, rpcError: null,
    auth: { getUser: async () => ({ data: { user }, error: null }) },
    from(table) {
      calls.push(table)
      const filters = []; let mutation
      const query = { select() { return query }, eq(key, value) { filters.push(row => row[key] === value); return query },
        gte() { return query }, lt() { return query }, order() { return query }, limit() { return query },
        insert(value) { mutation = value; return query },
        maybeSingle: async () => resolve(true), single: async () => resolve(true), then(done) { return Promise.resolve(resolve()).then(done) } }
      function resolve(single = false) {
        if (mutation) { writes.push({ table, value: mutation }); return { data: mutation, error: null } }
        if (lookupError && table === 'clients') return { data: null, error: { message: 'Synthetic lookup failure' } }
        const rows = table === 'clients' ? [client] : table === 'nutrition_logs' ? [log] : table === 'macro_entries' ? [{ id: 'owned-entry', nutrition_log_id: log.id, auth_user_id: owner, calories: 100 }] : table === 'program_outputs' ? [{ output: { program: tier, days: [{ day_name: 'Assigned', exercises: [] }] } }] : []
        const matching = rows.filter(row => filters.every(filter => filter(row)))
        return { data: single ? matching[0] || null : matching, error: null }
      }
      return query
    },
    async rpc(name, args) { rpcCalls.push({ name, args }); return { data: name === 'record_tracker_nutrition' ? log : { id: 'saved-session' }, error: db.rpcError } },
  }
  globalThis.membershipGateDb = db; globalThis.membershipConversions = []; globalThis.membershipAdminCalls = 0
  return db
}
const post = body => new Request('https://synthetic.test/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

test('direct mutations deny Free, unknown and expired memberships despite caller-supplied paid tiers', async () => {
  for (const fixture of [{ tier: 'free' }, { tier: 'mystery' }, { tier: 'phoenix', expired: true }]) {
    const db = database(fixture)
    const workoutResult = await workout.POST(post({ client_id: db.client.client_id, program: 'phoenix', workout_source: 'manual' }))
    assert.equal(workoutResult.status, 403)
    assert.equal((await recovery.POST(post({ clientId: db.client.client_id, activityType: 'Mobility', minutes: 5, program: 'phoenix' }))).status, 403)
    assert.equal((await generated.POST(post({ client_id: db.client.client_id, program: 'phoenix' }))).status, 403)
    assert.equal(db.writes.length, 0); assert.equal(db.rpcCalls.length, 0); assert.equal(db.calls.includes('program_outputs'), false)
  }
})

test('Tracker accepts manual work and recovery while denying generated workouts and target engines', async () => {
  const db = database()
  assert.equal((await workout.POST(post({ client_id: db.client.client_id, program: 'tracker', workout_source: 'recommended' }))).status, 403)
  const exercise = { id: 'squat', exercise: 'Squat', sets: 1, reps: 8, exercise_category: 'strength', completed: true, set_logs: [{ set_number: 1, reps: 8, weight: 0, completed_at: new Date().toISOString() }] }
  assert.equal((await workout.POST(post({ client_id: db.client.client_id, program: 'tracker', workout_source: 'manual', planned_exercises: [exercise], exercise_logs: [exercise] }))).status, 200)
  assert.equal(db.rpcCalls.at(-1).name, 'save_daily_workout')
  assert.equal((await recovery.POST(post({ clientId: db.client.client_id, activityType: 'Gentle walk', minutes: 7 }))).status, 200)
  assert.equal((await generated.POST(post({ client_id: db.client.client_id }))).status, 403)
  assert.equal((await targets.GET(new Request(`https://synthetic.test/api/nutrition?client_id=${db.client.client_id}`))).status, 403)
})

test('Tracker actuals require verified ownership, strict values and stable save identity; hydration shares the neutral RPC', async () => {
  const body = { clientId: 'owned-client', requestId, calories: 100, protein: 0 }
  database({ signedIn: false }); assert.equal((await tracker.POST(post(body))).status, 401)
  database({ verified: false }); assert.equal((await tracker.POST(post(body))).status, 403)
  const db = database()
  assert.equal((await tracker.POST(post({ ...body, clientId: 'foreign-client' }))).status, 404)
  for (const invalid of [{ ...body, program: 'phoenix' }, { ...body, calories: '100' }, { ...body, calories: -1 }, { ...body, waterOz: 0 }, { clientId: body.clientId, requestId, protein: 0 }]) {
    assert.equal((await tracker.POST(post(invalid))).status, 400)
  }
  assert.equal((await tracker.POST(post(body))).status, 200)
  assert.equal((await tracker.POST(post(body))).status, 200)
  assert.deepEqual(db.rpcCalls[1], db.rpcCalls[0])
  assert.deepEqual(db.rpcCalls[0].args.p_values, { calories: 100, protein: 0 })
  assert.equal(globalThis.membershipConversions[0].event, 'first_nutrition_completed')
  const before = globalThis.membershipConversions.length
  const logDate = getClientLocalDate(db.client)
  assert.equal((await water.POST(post({ clientId: body.clientId, ounces: 8, submissionId: requestId, logDate }))).status, 200)
  assert.equal(db.rpcCalls.at(-1).name, 'record_tracker_nutrition')
  assert.deepEqual(db.rpcCalls.at(-1).args.p_values, { waterOz: 8 })
  assert.equal(globalThis.membershipConversions.length, before)
  const conversionCount = globalThis.membershipConversions.length
  const originalRpc = db.rpc
  db.rpc = async () => ({ data: null, error: null })
  assert.equal((await tracker.POST(post(body))).status, 503)
  assert.equal(globalThis.membershipConversions.length, conversionCount)
  db.rpc = originalRpc
  db.rpcError = { code: '23505', message: 'conflicting synthetic receipt' }
  assert.equal((await tracker.POST(post(body))).status, 409)
})

test('mobile verified contexts deny Free without removing Tracker health/logging access', async () => {
  const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL, oldKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://synthetic.example.test'; process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'synthetic-public-key'
  try {
    const request = new Request('https://synthetic.test/api/mobile/health/sync', { headers: { Authorization: 'Bearer synthetic-token' } })
    database({ tier: 'free' }); assert.equal((await createMobileRequestContext(request)).status, 403)
    database(); assert.equal((await createMobileRequestContext(request)).client.program, 'tracker')
    const privateDashboard = new Request('https://synthetic.test/api/mobile/dashboard', { headers: { Authorization: 'Bearer synthetic-token' } })
    assert.equal((await createMobileRequestContext(privateDashboard)).status, 403, 'Tracker cannot enter the generated mobile coaching pipeline')
    const legacyWater = new Request('https://synthetic.test/api/mobile/actions/water', { method: 'POST', headers: { Authorization: 'Bearer synthetic-token' } })
    assert.equal((await createMobileRequestContext(legacyWater)).status, 403, 'Legacy target-generating water path stays paid; neutral Tracker endpoint remains separate')
    database({ tier: 'ignite' }); assert.equal((await createMobileRequestContext(privateDashboard)).client.program, 'ignite')
  } finally {
    if (oldUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl
    if (oldKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY; else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = oldKey
  }
})

test('owned historical actuals remain readable after expiry without allowing foreign-client access', async () => {
  const db = database({ expired: true })
  const saved = await tracker.GET(new Request('https://synthetic.test/api/tracker/nutrition?clientId=owned-client'))
  assert.equal(saved.status, 200)
  assert.equal((await saved.json()).entries[0].calories, 100)
  assert.equal((await tracker.GET(new Request('https://synthetic.test/api/tracker/nutrition?clientId=foreign-client'))).status, 404)
  assert.equal((await workout.GET(new Request('https://synthetic.test/api/workout-log?clientId=owned-client'))).status, 200)
  assert.equal(db.rpcCalls.length, 0)
})

test('normalized Tracker tiers cannot bypass coaching restrictions through stored casing', async () => {
  const db = database({ tier: 'Tracker' })
  assert.equal((await workout.POST(post({ client_id: db.client.client_id, program: 'Tracker', workout_source: 'recommended' }))).status, 403)
  assert.equal((await water.POST(post({ clientId: db.client.client_id, ounces: 8, submissionId: requestId, logDate: getClientLocalDate(db.client) }))).status, 200)
  assert.equal(db.rpcCalls.at(-1).name, 'record_tracker_nutrition')
})

test('normalized Free tiers still require verified Community identity', async () => {
  database({ tier: 'Free', verified: false })
  await assert.rejects(communityIdentity(), error => error.status === 403)
})

test('shared contexts gate Community, calendars and meal logging against canonical capabilities', async () => {
  database({ tier: 'free' }); assert.equal((await communityIdentity()).client.program, 'free')
  database({ tier: 'free', verified: false }); await assert.rejects(communityIdentity(), error => error.status === 403)
  database(); await assert.rejects(calendarContext(new Request('https://synthetic.test/api/calendars')), error => error.status === 403)
  assert.equal(globalThis.membershipAdminCalls, 0)
  const paid = database({ tier: 'ignite' })
  assert.equal((await calendarContext(new Request('https://synthetic.test/api/calendars'))).client.program, 'ignite')
  assert.equal((await getMealLoggingAccess(paid, owner)).allowed, true)
  const free = database({ tier: 'free' }); assert.equal((await getMealLoggingAccess(free, owner)).allowed, false)
  const expired = database({ tier: 'ignite', expired: true }); assert.equal((await getMealLoggingAccess(expired, owner)).allowed, false)
  assert.equal((await communityIdentity(true)).client.program, 'ignite', 'An expired owner retains cleanup identity.')
})
