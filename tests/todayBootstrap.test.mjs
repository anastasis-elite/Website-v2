import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'

const { createTodayBootstrap, loadTodayBootstrap } = await importTs('lib/dashboard/todayBootstrap.ts')
const owner = { id: 'member-one' }
const client = { client_id: 'CLIENT-ONE', auth_user_id: owner.id, program: 'ignite', full_name: 'Test Member', timezone: 'America/Los_Angeles' }
const context = { user: owner, client, program: 'ignite' }
const fixed = () => new Date('2026-11-14T16:00:00Z')
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes }); return { promise, resolve } }

function recoveryDatabase(reply) {
  const queries = []
  return {
    queries,
    supabase: { from(table) {
      const query = { table, operations: [] }
      queries.push(query)
      const builder = { select(...args) { query.operations.push(['select', ...args]); return builder },
        eq(...args) { query.operations.push(['eq', ...args]); return builder },
        maybeSingle() { return typeof reply === 'function' ? reply(query) : reply } }
      return builder
    } },
  }
}

test('the real day boundaries are available while check-in evidence is delayed, without invented completion or recommendations', async () => {
  const seed = createTodayBootstrap({ ...context, now: fixed() })
  assert.deepEqual(seed.checkIn, { status: 'pending', completed: null })
  assert.equal(seed.date, '2026-11-14')
  assert.equal(seed.memberName, 'Test')
  assert.equal(seed.carouselStyle, 'section')
  assert.deepEqual(seed.day.sections.map(section => section.id), ['morning', 'midday', 'evening'])
  assert.ok(seed.day.sections.every(section => section.items.length === 0))
  assert.equal(seed.day.currentSection, 'morning')
  assert.equal(seed.day.nextBoundaryAt, '2026-11-14T18:00:00.000Z')
  assert.equal('hydration' in seed, false)
  assert.equal('flameState' in seed, false)

  const held = deferred()
  const database = recoveryDatabase(held.promise)
  const loading = loadTodayBootstrap({ ...context, supabase: database.supabase, now: fixed })
  assert.equal(seed.checkIn.status, 'pending')
  assert.deepEqual(database.queries, [{ table: 'recovery_logs', operations: [
    ['select', 'check_in_completed_at'], ['eq', 'client_id', client.client_id],
    ['eq', 'auth_user_id', owner.id], ['eq', 'log_date', '2026-11-14'],
  ] }])
  held.resolve({ data: null, error: null })
  const verified = await loading
  assert.deepEqual(verified.checkIn, { status: 'ready', completed: false })
  assert.deepEqual(verified.day.sections[0].items.map(item => [item.activityId, item.href]), [['check-in', '/dashboard/check-in']])
  assert.ok(verified.day.sections.slice(1).every(section => section.items.length === 0))
})

test('fresh requests preserve saved completion and never share data between members or calls', async () => {
  const database = recoveryDatabase({ data: { check_in_completed_at: '2026-11-14T15:00:00Z' }, error: null })
  const completed = await loadTodayBootstrap({ ...context, supabase: database.supabase, now: fixed })
  assert.deepEqual(completed.checkIn, { status: 'ready', completed: true })
  assert.equal(completed.day.sections[0].items.length, 0)
  const other = { user: { id: 'member-two' }, client: { ...client, client_id: 'CLIENT-TWO', auth_user_id: 'member-two', carousel_style: 'step' }, program: 'ignite' }
  const otherBootstrap = await loadTodayBootstrap({ ...other, supabase: database.supabase, now: fixed })
  assert.equal(otherBootstrap.ownerUserId, 'member-two')
  assert.equal(otherBootstrap.carouselStyle, 'step')
  assert.equal(database.queries.length, 2)
  assert.ok(database.queries[1].operations.some(operation => operation[1] === 'client_id' && operation[2] === 'CLIENT-TWO'))
  assert.throws(() => createTodayBootstrap({ ...context, user: other.user }), /verified member/)
  assert.throws(() => createTodayBootstrap({ ...context, program: 'phoenix' }), /verified member/)
})

test('check-in read errors remain unknown and retry can activate only verified evidence', async () => {
  for (const reply of [{ data: null, error: { message: 'Unavailable' } }, () => { throw new Error('Network interrupted') }]) {
    const database = recoveryDatabase(reply)
    const result = await loadTodayBootstrap({ ...context, supabase: database.supabase, now: fixed })
    assert.equal(result.checkIn.status, 'error')
    assert.equal(result.checkIn.completed, null)
    assert.equal(result.day.sections[0].items.length, 0)
  }
  const retry = recoveryDatabase({ data: null, error: null })
  assert.equal((await loadTodayBootstrap({ ...context, supabase: retry.supabase, now: fixed })).checkIn.status, 'ready')
})

test('member-local midnight discards old completion and reads the new date before activating check-in', async () => {
  let current = new Date('2026-11-15T07:59:59Z')
  let count = 0
  const database = recoveryDatabase(() => {
    count += 1
    if (count === 1) {
      current = new Date('2026-11-15T08:00:00Z')
      return { data: { check_in_completed_at: '2026-11-14T18:00:00Z' }, error: null }
    }
    return { data: null, error: null }
  })
  const result = await loadTodayBootstrap({ ...context, supabase: database.supabase, now: () => current })
  assert.equal(result.date, '2026-11-15')
  assert.equal(result.checkIn.completed, false)
  assert.deepEqual(database.queries.map(query => query.operations.find(operation => operation[1] === 'log_date')[2]), ['2026-11-14', '2026-11-15'])
})

const accessMocks = {
  'next/navigation': `export function redirect(destination) { const error = new Error('redirect'); error.digest = 'NEXT_REDIRECT;replace;' + destination + ';307;'; throw error }`,
  'next/server': `export function after(task) { void task() } export const NextResponse = { json(body, options = {}) { return { body, status: options.status || 200, headers: options.headers || {} } } }`,
  '@/lib/dashboard/getDashboardContext': `export async function getDashboardContext() { return globalThis.__todayAccessContext() }`,
  '@/lib/legal/hasCurrentLegalAcceptance': `export async function hasCurrentLegalAcceptance() { return globalThis.__todayLegalAccepted }`,
  '@/lib/legal/logRecommendationAudit': `export async function logRecommendationAudit(entry) { globalThis.__todayAudit.push(entry) }`,
}
const access = await importTs('lib/dashboard/todayAccess.ts', accessMocks)
const bootstrapRoute = await importTs('app/api/dashboard/today-bootstrap/route.ts', accessMocks)

function withAccess(t, { safetyError = null, safetyData = [], recoveryReply = { data: null, error: null } } = {}) {
  const originalGate = process.env.LEGAL_GATE_ENABLED
  delete process.env.LEGAL_GATE_ENABLED
  globalThis.__todayLegalAccepted = true
  globalThis.__todayAudit = []
  let queryCount = 0
  const current = { ...context, supabase: { from(table) {
    queryCount += 1
    const result = table === 'client_symptom_logs' ? { data: safetyData, error: safetyError } : recoveryReply
    const builder = { then(resolve, reject) { return Promise.resolve(result).then(resolve, reject) }, maybeSingle() { return Promise.resolve(result) } }
    for (const method of ['select', 'eq', 'gte', 'order', 'limit']) builder[method] = () => builder
    return builder
  } } }
  globalThis.__todayAccessContext = async () => current
  t.after(() => {
    if (originalGate === undefined) delete process.env.LEGAL_GATE_ENABLED
    else process.env.LEGAL_GATE_ENABLED = originalGate
    delete globalThis.__todayAccessContext
    delete globalThis.__todayLegalAccepted
    delete globalThis.__todayAudit
  })
  return { current, queries: () => queryCount }
}

test('startup API enforces account, legal, safety and local-day gates before publishing member data', async t => {
  const state = withAccess(t)
  const route = query => bootstrapRoute.GET(new Request(`https://example.test/api/dashboard/today-bootstrap?${query}`))
  const switched = await route('ownerUserId=other-member&clientId=CLIENT-ONE')
  assert.equal(switched.status, 401)
  assert.equal(switched.body.redirect, '/dashboard')
  assert.equal(switched.body.bootstrap, undefined)
  assert.equal(state.queries(), 0)
  process.env.LEGAL_GATE_ENABLED = 'true'
  globalThis.__todayLegalAccepted = false
  const legal = await route('program=ignite')
  assert.equal(legal.status, 403)
  assert.equal(legal.body.redirect, '/legal/acceptance')
  assert.equal(state.queries(), 0)
  globalThis.__todayLegalAccepted = true
  const midnight = await route('program=ignite&date=2000-01-01')
  assert.equal(midnight.status, 409)
  assert.equal(midnight.body.bootstrap, undefined)
  assert.equal(midnight.headers['Cache-Control'], 'private, no-store')
  const ready = await route('program=ignite&ownerUserId=member-one&clientId=CLIENT-ONE')
  assert.equal(ready.status, 200)
  assert.equal(ready.body.bootstrap.ownerUserId, owner.id)
  assert.equal(ready.headers['Cache-Control'], 'private, no-store')
})

test('startup API fails closed when safety is unavailable or needs escalation, and handles logout', async t => {
  const state = withAccess(t, { safetyError: { message: 'Slow safety source' } })
  const unavailable = await bootstrapRoute.GET(new Request('https://example.test/api/dashboard/today-bootstrap'))
  assert.equal(unavailable.status, 503)
  assert.equal(unavailable.body.bootstrap, undefined)
  assert.equal(state.queries(), 1)
  globalThis.__todayAccessContext = async () => ({ ...state.current, supabase: { from() {
    const builder = { then(resolve) { return Promise.resolve({ data: [{ notes: 'chest pain' }], error: null }).then(resolve) } }
    for (const method of ['select', 'eq', 'gte', 'order', 'limit']) builder[method] = () => builder
    return builder
  } } })
  const escalation = await bootstrapRoute.GET(new Request('https://example.test/api/dashboard/today-bootstrap'))
  assert.equal(escalation.status, 409)
  assert.equal(escalation.body.safetyFlags[0].code, 'chest_pain')
  assert.equal(escalation.body.bootstrap, undefined)
  assert.equal(globalThis.__todayAudit.length, 1)
  assert.equal(globalThis.__todayAudit[0].recommendationType, 'dashboard_safety_escalation')
  assert.equal(globalThis.__todayAudit[0].clientId, client.client_id)
  globalThis.__todayAccessContext = async () => { throw { digest: 'NEXT_REDIRECT;replace;/login;307;' } }
  const loggedOut = await bootstrapRoute.GET(new Request('https://example.test/api/dashboard/today-bootstrap'))
  assert.equal(loggedOut.status, 401)
  assert.equal(loggedOut.body.redirect, '/login')
  assert.equal(loggedOut.headers['Cache-Control'], 'private, no-store')
})

test('API redirect errors retain only the verified navigation destination', () => {
  const response = access.todayAccessError({ digest: 'NEXT_REDIRECT;replace;/dashboard/payment-issue;307;' }, 'Unavailable')
  assert.equal(response.status, 403)
  assert.equal(response.body.redirect, '/dashboard/payment-issue')
})
