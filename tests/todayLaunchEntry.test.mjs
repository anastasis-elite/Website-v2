import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, extname, resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
class Redirect extends Error { constructor(destination) { super(destination); this.destination = destination } }
const plain = value => JSON.parse(JSON.stringify(value))
const member = (program = 'ignite', patch = {}) => ({ client_id: 'CLIENT-ONE', auth_user_id: 'OWNER-ONE', program,
  full_name: 'Synthetic Member', access: true, active: true, verified_purchase: false, timezone: 'UTC',
  onboarding_completed: true, birthdate: '1990-01-01', address_line_1: 'Synthetic address', city: 'Test', state: 'TX', postal_code: '00000', ...patch })
const nodes = (tree, predicate) => Array.isArray(tree) ? tree.flatMap(child => nodes(child, predicate))
  : !tree || typeof tree !== 'object' ? [] : [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)]

function harness() {
  let request = {}, record = member(), user = { id: 'OWNER-ONE', email_confirmed_at: '2026-01-01' }, authError = null
  let clientError = null, safetyError = null, safety = [], legal = true
  let sessionCookies = [], activeCookieCallbacks = null, clock = 0, clockFailure = false
  const counts = { auth: 0, clients: 0, profiles: 0, safety: 0, recovery: 0, legal: 0, fullLogic: 0 }
  const queries = [], audits = []
  // Model React's request dispatcher explicitly: only calls in the same render
  // share a cache, and newRequest discards every cached value and rejection.
  const cache = task => {
    const requests = new WeakMap()
    return (...args) => {
      let entries = requests.get(request)
      if (!entries) requests.set(request, entries = [])
      const found = entries.find(entry => entry.args.length === args.length && entry.args.every((value, index) => Object.is(value, args[index])))
      if (found) return found.value
      const value = task(...args)
      entries.push({ args, value })
      return value
    }
  }
  const supabase = { auth: { async getUser() {
    counts.auth++
    if (activeCookieCallbacks && sessionCookies.length) activeCookieCallbacks.setAll(sessionCookies)
    return { data: { user }, error: authError }
  } }, from(table) {
    const operations = []; queries.push({ table, operations })
    const result = () => {
      if (table === 'clients') {
        counts.clients++
        const owned = record && operations.some(operation => operation[0] === 'eq' && operation[1] === 'auth_user_id' && operation[2] === record.auth_user_id)
        return { data: owned ? record : null, error: clientError }
      }
      if (table === 'client_current_profiles') { counts.profiles++; return { data: null, error: null } }
      if (table === 'client_symptom_logs') { counts.safety++; return { data: safety, error: safetyError } }
      if (table === 'recovery_logs') { counts.recovery++; return { data: null, error: null } }
      assert.fail('Launch must not load full personalization: ' + table)
    }
    const builder = { maybeSingle: async () => result(), then: (yes, no) => Promise.resolve(result()).then(yes, no) }
    for (const method of ['select', 'eq', 'gte', 'order', 'limit', 'abortSignal']) builder[method] = (...args) => { operations.push([method, ...args]); return builder }
    return builder
  } }
  const cookieJar = (initial = []) => {
    const values = new Map(initial.map(cookie => [cookie.name, { ...cookie }]))
    return { getAll: () => [...values.values()], set(name, value, options = {}) {
      const cookie = typeof name === 'object' ? { ...name } : { name, value, ...options }
      values.set(cookie.name, cookie)
    } }
  }
  const mocks = {
    react: { cache, Suspense: 'Suspense' },
    'react/jsx-runtime': { jsx: (type, props, key) => ({ type, props, key }), jsxs: (type, props, key) => ({ type, props, key }), Fragment: 'Fragment' },
    'next/navigation': { redirect(destination) { throw new Redirect(destination) } },
    'next/server': { after(task) { audits.push(task) }, NextResponse: {
      next: init => ({ kind: 'next', request: init?.request, headers: new Headers(), cookies: cookieJar() }),
      redirect: url => ({ kind: 'redirect', url, headers: new Headers(), cookies: cookieJar() }),
      json: (body, init) => ({ kind: 'json', body, status: init.status, headers: new Headers(), cookies: cookieJar() }),
    } },
    '@/lib/supabase/server': { createClient: async () => { activeCookieCallbacks = null; return supabase } },
    '@supabase/ssr': { createServerClient: (_url, _key, options) => { activeCookieCallbacks = options.cookies; return supabase } },
    '@/lib/legal/hasCurrentLegalAcceptance': { async hasCurrentLegalAcceptance() { counts.legal++; return legal } },
    '@/lib/legal/logRecommendationAudit': { logRecommendationAudit() {} },
    '@/lib/dashboard/loadTodayEnrichment': { loadTodayEnrichment() { counts.fullLogic++; assert.fail('Today launch must not await enrichment') } },
    '@/lib/dashboard/logic/loadProgramLogicInputs': { DashboardLocalDayChangedError: class extends Error {} },
    'server-only': {},
  }
  const modules = new Map()
  function load(file) {
    file = resolve(file)
    if (modules.has(file)) return modules.get(file).exports
    const module = { exports: {} }; modules.set(file, module)
    const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText
    runInNewContext(code, { module, exports: module.exports, process: { env: { LEGAL_GATE_ENABLED: 'true' } }, console,
      Date, Intl, URL, URLSearchParams, Headers, performance: { now() { if (clockFailure) throw new Error('Restricted clock'); return clock += 2.5 } }, AbortController, setTimeout, clearTimeout, require(name) {
        if (Object.hasOwn(mocks, name)) return mocks[name]
        if (name.endsWith('.css')) return { __esModule: true, default: {} }
        if (name.startsWith('@/components/') && name !== '@/components/program-dashboard/ProgramDashboardPage') return { __esModule: true, default: name.split('/').at(-1) }
        const base = name.startsWith('@/') ? resolve(name.slice(2)) : name.startsWith('.') ? resolve(dirname(file), name) : null
        if (!base) return require(name)
        return load(extname(base) ? base : existsSync(base + '.ts') ? base + '.ts' : base + '.tsx')
      },
    }, { filename: file })
    return module.exports
  }
  async function render(tree) {
    tree = await tree
    if (Array.isArray(tree)) return Promise.all(tree.map(render))
    if (!tree || typeof tree !== 'object') return tree
    if (typeof tree.type === 'function') return render(tree.type(tree.props))
    return { ...tree, props: { ...tree.props, children: await render(tree.props?.children) } }
  }
  const context = load('lib/dashboard/getDashboardContext.ts').getDashboardContext
  const entry = load('app/dashboard/page.tsx').default
  const program = load('app/dashboard/program/[program]/page.tsx').default
  const middleware = load('middleware.ts').middleware
  return {
    counts, queries, audits, context,
    entry: () => render(entry()),
    program: tier => render(program({ params: Promise.resolve({ program: tier }) })),
    middleware(path = '/dashboard', headers = {}, cookies = []) {
      const url = new URL('https://launch.test' + path)
      return middleware({ method: 'GET', headers: new Headers(headers), cookies: cookieJar(cookies), nextUrl: {
        pathname: url.pathname, searchParams: url.searchParams, clone: () => new URL(url),
      } })
    },
    newRequest(patch = {}) {
      request = {}
      if ('member' in patch) record = patch.member
      if ('user' in patch) user = patch.user
      if ('authError' in patch) authError = patch.authError
      if ('clientError' in patch) clientError = patch.clientError
      if ('safetyError' in patch) safetyError = patch.safetyError
      if ('safety' in patch) safety = patch.safety
      if ('legal' in patch) legal = patch.legal
      if ('sessionCookies' in patch) sessionCookies = patch.sessionCookies
      if ('clockFailure' in patch) clockFailure = patch.clockFailure
    },
  }
}

test('paid PWA entry renders the real Today in one request and shares identity with layout callers', async () => {
  const view = harness()
  for (const tier of ['ember', 'ignite', 'phoenix']) {
    view.newRequest({ member: member(tier) })
    const before = { ...view.counts }
    assert.equal((await view.middleware()).kind, 'next')
    const layoutContext = await view.context({ allowIncompleteOnboarding: true, allowInactiveAccess: true })
    const tree = await view.entry()
    const startup = nodes(tree, node => node.type === 'TodayStartup')[0]
    assert.ok(startup, 'Subscribed member reaches real Today without a redirect')
    assert.equal(startup.props.seed.program, tier)
    assert.equal(startup.props.seed.ownerUserId, layoutContext.user.id)
    assert.equal(startup.props.seed.clientId, layoutContext.client.client_id)
    assert.equal(startup.props.seed.checkIn.status, 'ready', 'The small completion read is already verified in the launch response')
    assert.equal(startup.props.seed.checkIn.completed, false)
    assert.equal(startup.props.seed.day.sections[0].items[0].href, '/dashboard/check-in')
    assert.equal(view.counts.auth - before.auth, 2, 'Middleware and one shared render each verify identity')
    assert.equal(view.counts.clients - before.clients, 2)
    assert.equal(view.counts.profiles - before.profiles, 1)
    assert.equal(view.counts.safety - before.safety, 1)
    assert.equal(view.counts.recovery - before.recovery, 1)
    assert.equal(view.counts.fullLogic, 0)
  }
})

test('Free, Tracker and unrecognized entry destinations retain their existing redirects', async () => {
  const view = harness()
  for (const [tier, destination] of [['free', '/dashboard/community'], ['tracker', '/dashboard/tracker'], ['legacy-unknown', '/dashboard/payment-issue']]) {
    view.newRequest({ member: member(tier) })
    await assert.rejects(view.entry(), error => error instanceof Redirect && error.destination === destination)
  }
  assert.equal(view.counts.fullLogic, 0)
  assert.equal(view.counts.safety, 0)
})

test('expired or revoked sessions and failed member reads cannot reuse a previous render or accept spoofed headers', async () => {
  const view = harness()
  await view.entry()
  for (const auth of [{ user: null, authError: null }, { user: { id: 'OWNER-ONE' }, authError: { message: 'Expired token' } }]) {
    view.newRequest(auth)
    await assert.rejects(view.entry(), error => error instanceof Redirect && error.destination === '/login')
  }
  view.newRequest({ user: null, authError: null })
  const refused = await view.middleware('/dashboard', { 'x-dashboard-user-id': 'OWNER-ONE', 'x-dashboard-access': 'true', 'x-dashboard-program': 'phoenix' })
  assert.equal(refused.kind, 'redirect')
  assert.equal(refused.url.pathname, '/login')
  view.newRequest({ user: { id: 'OWNER-ONE' }, clientError: { message: 'Synthetic unavailable' } })
  await assert.rejects(view.entry(), /Client lookup failed/)
  assert.equal((await view.middleware()).status, 503)
  assert.equal(view.counts.fullLogic, 0)
})

test('membership expiry and incomplete onboarding remain strict even after a permissive layout context read', async () => {
  const view = harness()
  const expired = [
    { access: false }, { active: false }, { membership_expires_at: '2000-01-01T00:00:00Z' },
    { subscription_ends_at: '2000-01-01' }, { membership_expires_at: 'malformed' },
    { verified_purchase: true, membership_expires_at: null, subscription_ends_at: null },
  ]
  for (const patch of expired) {
    view.newRequest({ member: member('ignite', patch) })
    await view.context({ allowIncompleteOnboarding: true, allowInactiveAccess: true })
    await assert.rejects(view.entry(), error => error instanceof Redirect && error.destination === '/dashboard/payment-issue')
    const result = await view.middleware()
    assert.equal(result.kind, 'redirect'); assert.equal(result.url.pathname, '/dashboard/payment-issue')
  }
  for (const patch of [{ onboarding_completed: false }, { postal_code: null }]) {
    view.newRequest({ member: member('phoenix', patch) })
    await view.context({ allowIncompleteOnboarding: true, allowInactiveAccess: true })
    await assert.rejects(view.entry(), error => error instanceof Redirect && error.destination === '/dashboard/onboarding/profile')
    assert.equal((await view.middleware()).url.pathname, '/dashboard/onboarding/profile')
  }
  assert.equal(view.counts.safety, 0)
  assert.equal(view.counts.fullLogic, 0)
})

test('composed launch and direct program entry retain legal, safety and subscribed-program gates', async () => {
  const view = harness()
  view.newRequest({ legal: false })
  await assert.rejects(view.entry(), error => error instanceof Redirect && error.destination === '/legal/acceptance')
  assert.equal(view.counts.safety, 0)
  view.newRequest({ legal: true, safetyError: { message: 'Synthetic unavailable' } })
  await assert.rejects(view.entry(), /safety status could not be verified/)
  view.newRequest({ safetyError: null, safety: [{ severity: 9, notes: 'chest pain' }] })
  const held = await view.entry()
  assert.equal(nodes(held, node => node.type === 'TodayStartup').length, 0)
  assert.ok(nodes(held, node => node.type === 'SafetyEscalationNotice').length)
  view.newRequest({ safety: [], member: member('ignite') })
  await assert.rejects(view.program('phoenix'), error => error instanceof Redirect && error.destination === '/dashboard/program/ignite')
  assert.equal(view.counts.fullLogic, 0)
})

test('the next request verifies the new account instead of sharing previous Today identity', async () => {
  const view = harness()
  await view.entry()
  view.newRequest({ user: { id: 'OWNER-TWO' }, member: member('ember', { client_id: 'CLIENT-TWO', auth_user_id: 'OWNER-TWO' }) })
  const tree = await view.entry()
  const seed = nodes(tree, node => node.type === 'TodayStartup')[0].props.seed
  assert.deepEqual(plain([seed.ownerUserId, seed.clientId, seed.program]), ['OWNER-TWO', 'CLIENT-TWO', 'ember'])
  const currentReads = view.queries.filter(query => query.table === 'clients').at(-1)
  assert.ok(currentReads.operations.some(operation => operation[0] === 'eq' && operation[1] === 'auth_user_id' && operation[2] === 'OWNER-TWO'))
})

test('optional middleware startup metrics contain only static numeric durations on exact launch routes', async () => {
  const view = harness()
  for (const path of ['/dashboard', '/dashboard/program/ember', '/dashboard/program/ignite?view=plan', '/dashboard/program/phoenix']) {
    view.newRequest()
    const result = await view.middleware(path, { 'Server-Timing': 'forged-owner;desc="OWNER-ONE"', 'x-dashboard-auth': 'forged' })
    assert.equal(result.kind, 'next')
    assert.equal(result.headers.get('Server-Timing'), 'today_mw_auth;dur=2.500, today_mw_context;dur=2.500')
    assert.doesNotMatch(result.headers.get('Server-Timing'), /OWNER|forged|CLIENT|http|desc=/)
  }
  for (const path of ['/dashboard/account', '/dashboard/program/ignite/workout', '/dashboard/program/unknown', '/api/daily-check-in']) {
    view.newRequest()
    const result = await view.middleware(path)
    assert.equal(result.kind, 'next')
    assert.equal(result.headers.get('Server-Timing'), null)
  }
  view.newRequest({ clockFailure: true })
  const restricted = await view.middleware()
  assert.equal(restricted.kind, 'next', 'Unavailable diagnostics cannot interfere with access')
  assert.equal(restricted.headers.get('Server-Timing'), null)
})

test('startup timing preserves refreshed and cleared session cookies on success, expiry and error responses', async () => {
  const view = harness()
  const fresh = { name: 'sb-auth-token', value: 'synthetic-refreshed-token', options: { httpOnly: true, path: '/', sameSite: 'lax' } }
  view.newRequest({ sessionCookies: [fresh] })
  const accepted = await view.middleware('/dashboard', {}, [{ name: fresh.name, value: 'synthetic-old-token' }])
  assert.equal(accepted.kind, 'next')
  assert.deepEqual(plain(accepted.request.cookies.getAll()), [{ name: fresh.name, value: fresh.value }], 'The same downstream request receives refreshed cookies')
  assert.deepEqual(plain(accepted.cookies.getAll()), [{ name: fresh.name, value: fresh.value, ...fresh.options }])
  assert.match(accepted.headers.get('Server-Timing'), /^today_mw_auth;dur=\d+\.\d{3}, today_mw_context;dur=\d+\.\d{3}$/)

  const cleared = { name: fresh.name, value: '', options: { maxAge: 0, path: '/' } }
  view.newRequest({ user: null, authError: { message: 'Expired session' }, sessionCookies: [cleared] })
  const beforeClientReads = view.counts.clients
  const expired = await view.middleware('/dashboard', {}, [{ name: fresh.name, value: 'synthetic-expired-token' }])
  assert.equal(expired.kind, 'redirect'); assert.equal(expired.url.pathname, '/login')
  assert.deepEqual(plain(expired.cookies.getAll()), [{ name: cleared.name, value: '', ...cleared.options }])
  assert.equal(view.counts.clients, beforeClientReads)
  assert.equal(expired.headers.get('Server-Timing'), 'today_mw_auth;dur=2.500')

  view.newRequest({ user: { id: 'OWNER-ONE' }, authError: null, member: member('ignite', { membership_expires_at: '2000-01-01T00:00:00Z' }), sessionCookies: [fresh] })
  const membership = await view.middleware()
  assert.equal(membership.kind, 'redirect'); assert.equal(membership.url.pathname, '/dashboard/payment-issue')
  assert.deepEqual(plain(membership.cookies.getAll()), [{ name: fresh.name, value: fresh.value, ...fresh.options }])
  assert.equal(membership.headers.get('Server-Timing'), 'today_mw_auth;dur=2.500, today_mw_context;dur=2.500')

  view.newRequest({ member: member(), clientError: { message: 'Synthetic unavailable' }, sessionCookies: [fresh] })
  const unavailable = await view.middleware()
  assert.equal(unavailable.status, 503)
  assert.deepEqual(plain(unavailable.cookies.getAll()), [{ name: fresh.name, value: fresh.value, ...fresh.options }])
  assert.equal(unavailable.headers.get('Server-Timing'), 'today_mw_auth;dur=2.500, today_mw_context;dur=2.500')
})
