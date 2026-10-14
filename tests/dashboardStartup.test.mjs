import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'

const { getDashboardContext } = await importTs('lib/dashboard/getDashboardContext.ts', {
  react: 'export const cache = fn => { const requests = new Map(); return (...args) => { const scope = globalThis.dashboardIdentityScope; if (!requests.has(scope)) requests.set(scope, fn(...args)); return requests.get(scope) } }',
  'next/navigation': 'export const redirect = path => { throw new Error("REDIRECT " + path) }',
  '@/lib/supabase/server': 'export const createClient = async () => globalThis.dashboardIdentityDatabase',
})

function identityDatabase(id, access = true) {
  let authentication = 0
  const reads = []
  const client = { client_id: `client-${id}`, auth_user_id: id, program: 'ignite', access, active: access, verified_purchase: true, subscription_ends_at: '2099-01-01T00:00:00Z',
    onboarding_completed: true, birthdate: '1990-01-01', address_line_1: '1 Test', city: 'Test', state: 'IL', postal_code: '60000' }
  return { client, reads, get authentication() { return authentication },
    auth: { getUser: async () => { authentication++; return { data: { user: { id } }, error: null } } },
    from(table) {
      const filters = [], query = { select() { return query }, eq(key, value) { filters.push([key, value]); return query },
        async maybeSingle() { reads.push({ table, filters }); return { data: table === 'clients' ? client : null, error: null } } }
      return query
    },
  }
}

test('layout and page share one request identity while every caller retains its access gate', async () => {
  globalThis.dashboardIdentityScope = Symbol('canceled request')
  const db = globalThis.dashboardIdentityDatabase = identityDatabase('owner-a', false)
  const layout = await getDashboardContext({ allowIncompleteOnboarding: true, allowInactiveAccess: true })
  assert.equal(layout.client.client_id, 'client-owner-a')
  await assert.rejects(getDashboardContext(), /REDIRECT \/dashboard\/payment-issue/)
  assert.equal(db.authentication, 1)
  assert.equal(db.reads.filter(read => read.table === 'clients').length, 1)
  assert.deepEqual(db.reads[0].filters, [['auth_user_id', 'owner-a']])
})

test('a subsequent request for another account never reuses the previous member identity', async () => {
  globalThis.dashboardIdentityScope = Symbol('first account')
  globalThis.dashboardIdentityDatabase = identityDatabase('owner-b')
  const first = await getDashboardContext()
  globalThis.dashboardIdentityScope = Symbol('second account')
  const secondDb = globalThis.dashboardIdentityDatabase = identityDatabase('owner-c')
  const second = await getDashboardContext()
  assert.equal(first.user.id, 'owner-b')
  assert.equal(second.user.id, 'owner-c')
  assert.equal(second.client.client_id, 'client-owner-c')
  assert.equal(secondDb.authentication, 1)
})

const { getDailyScheduleState } = await importTs('lib/schedule/service.ts', {
  '@/lib/calendar/service': 'export const importedScheduleEvents = () => globalThis.scheduleStartupFixture.read("calendar")',
  '@/lib/day/getDailyExecutionPlan': 'export const getDailyExecutionPlan = async () => { globalThis.scheduleStartupFixture.dailyPlanReads++; return globalThis.scheduleStartupFixture.dailyPlan }',
  '@/lib/dashboard/logic/getProgramLogicForClient': 'export const getProgramLogicForClient = async ({ dailyPlan }) => { globalThis.scheduleStartupFixture.logicPlan = dailyPlan; return {} }',
  '@/lib/schedule/dailyPlanAdapter': 'export const dailyPlanToScheduleEvents = () => []; export const recurringCommitmentsToEvents = () => []',
  '@/lib/schedule/engine': 'export const buildNextAction = () => null; export const buildDailyScheduleState = args => ({...args, now: args.now.toISOString(), openWindows: [{ minutes: 60 }], adjustments: [{ event_id: "test" }], nextAction: { can_defer: true }})',
  '@/lib/dashboard/todayActivities': 'export const buildTodayActivities = () => ({ activities: [] }); export const readDailyGuide = () => undefined',
  '@/lib/dashboard/dailyRecommendation': 'export const buildDailyRecommendation = () => ({primary: {id: "check-in", title: "Daily check-in", category: "check_in", reason: "Start with you", href: "/dashboard/check-in"}})',
})

function scheduleFixture() {
  const started = [], pending = new Map()
  const fixture = { started, dailyPlanReads: 0, dailyPlan: { date: '2026-10-14' },
    read(source) { started.push(source); return new Promise(resolve => pending.set(source, resolve)) },
    finish(source, rows = []) { pending.get(source)?.(source === 'calendar' ? rows : { data: rows, error: null }) },
    db: { from(table) {
      const query = { select() { return query }, eq() { return query }, or() { return query }, order() { return query },
        then(resolve, reject) { return fixture.read(table).then(resolve, reject) } }
      return query
    } },
  }
  globalThis.scheduleStartupFixture = fixture
  return fixture
}

const scheduleArgs = { user: { id: 'owner' }, client: { client_id: 'client', program: 'ignite', timezone: 'America/Chicago' }, date: '2026-10-14', logic: {} }

test('independent schedule sources start together and reuse the already-loaded daily plan', async () => {
  const fixture = scheduleFixture()
  const result = getDailyScheduleState({ ...scheduleArgs, supabase: fixture.db, dailyPlan: fixture.dailyPlan })
  await new Promise(setImmediate)
  assert.deepEqual(new Set(fixture.started), new Set(['anastasis_schedule_events', 'client_schedule_blocks', 'calendar']))
  assert.equal(fixture.dailyPlanReads, 0)
  for (const source of fixture.started) fixture.finish(source)
  const state = await result
  assert.deepEqual(state.unavailableSources, [])
  assert.equal(state.nextAction.action_route, '/dashboard/check-in')
})

test('a stalled optional calendar cannot block daily actions or claim conflict-free time', async t => {
  t.mock.method(console, 'error', () => {})
  const fixture = scheduleFixture()
  const result = getDailyScheduleState({ ...scheduleArgs, supabase: fixture.db, dailyPlan: fixture.dailyPlan, sourceTimeoutMs: 20 })
  await new Promise(setImmediate)
  fixture.finish('anastasis_schedule_events'); fixture.finish('client_schedule_blocks')
  const state = await result
  assert.deepEqual(state.unavailableSources, ['calendar'])
  assert.deepEqual(state.openWindows, [])
  assert.deepEqual(state.adjustments, [])
  assert.equal(state.nextAction.can_defer, false)
  assert.equal(state.nextAction.action_route, '/dashboard/check-in')
  fixture.finish('calendar')
})

test('standalone schedule computation also loads the daily plan once for logic and schedule', async () => {
  const fixture = scheduleFixture()
  const result = getDailyScheduleState({ ...scheduleArgs, logic: undefined, supabase: fixture.db })
  await new Promise(setImmediate)
  for (const source of fixture.started) fixture.finish(source)
  await result
  assert.equal(fixture.dailyPlanReads, 1)
  assert.equal(fixture.logicPlan, fixture.dailyPlan)
})
