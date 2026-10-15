import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'
const require = createRequire(import.meta.url)
function load(path, mocks = {}, env = {}) {
  const module = { exports: {} }
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  vm.runInNewContext(code, { module, exports: module.exports, require: name => name === 'server-only' ? {} : mocks[name] ?? require(name), process: { env }, Date, URL, Request, Response, console })
  return module.exports
}
test('paid access requires explicit access and unexpired verified periods; gifted access stays separate', () => {
  const { hasMemberAccess } = load('lib/commerce/access.ts')
  const now = new Date('2026-11-01T07:30:00Z')
  assert.equal(hasMemberAccess({ program: 'ember', access: true, active: true, verified_purchase: true, subscription_ends_at: '2026-11-01T08:00:00Z' }, now), true)
  assert.equal(hasMemberAccess({ program: 'ember', access: true, active: true, verified_purchase: true, subscription_ends_at: '2026-11-01T07:00:00Z' }, now), false)
  assert.equal(hasMemberAccess({ program: 'ignite', access: true, active: true, verified_purchase: false }, now), true)
  assert.equal(hasMemberAccess({ program: 'ignite', access: true, active: true, verified_purchase: false, subscription_ends_at: '2026-11-01T07:00:00Z' }, now), false)
  for (const client of [null, { program: 'other', access: true }, { program: 'ember' }, { program: 'ember', access: true, verified_purchase: true }, { program: 'ember', access: true, active: false }]) assert.equal(hasMemberAccess(client, now), false)
})
function portalFixture() {
  const state = { user: { id: 'owned-user' }, clients: [{ client_id: 'mine', auth_user_id: 'owned-user', active: false }], billing: [{ client_id: 'mine', stripe_customer_id: 'cus_owned', billing_type: 'subscription' }, { client_id: 'other', stripe_customer_id: 'cus_other' }], calls: [] }
  const db = { auth: { getUser: async () => ({ data: { user: state.user } }) }, from(table) {
    const filters = []
    return { select() { return this }, eq(key, value) { filters.push(row => row[key] === value); return this }, async maybeSingle() { return { data: (table === 'clients' ? state.clients : state.billing).find(row => filters.every(filter => filter(row))) || null, error: null } } } }
  }
  const env = { STRIPE_SECRET_KEY: 'sk_test_fixture', PAYMENT_TEST_DATABASE_ISOLATED: 'true' }
  class Stripe { billingPortal = { sessions: { create: async input => { state.calls.push(input); return { url: 'https://billing.stripe.test/owned' } } } } }
  const environment = load('lib/commerce/environment.ts', {}, env)
  const route = load('app/api/billing/portal/route.ts', { stripe: Stripe, 'next/server': { NextResponse: { json: (value, init) => new Response(JSON.stringify(value), init) } }, '@/lib/supabase/server': { createClient: async () => db }, '@/lib/commerce/environment': environment }, env)
  return { state, route, env }
}
test('billing portal is owned by verified login, ignores browser customer IDs and remains usable for canceled members', async () => {
  const f = portalFixture()
  const response = await f.route.POST(new Request('https://anastasis.test/api/billing/portal', { method: 'POST', body: JSON.stringify({ customer_id: 'cus_other', client_id: 'other', return_url: 'https://attacker.test' }) }))
  assert.equal(response.status, 200)
  assert.equal(f.state.calls.length, 1)
  assert.equal(f.state.calls[0].customer, 'cus_owned')
  assert.equal(f.state.calls[0].return_url, 'https://anastasis.test/dashboard/account#billing')
})
test('gifted, unauthenticated, missing-profile and unsafe environment requests cannot create portal sessions', async () => {
  const request = () => new Request('https://anastasis.test/api/billing/portal', { method: 'POST' })
  const f = portalFixture()
  f.state.billing = []
  assert.equal((await f.route.POST(request())).status, 409)
  f.state.user = null
  assert.equal((await f.route.POST(request())).status, 401)
  f.state.user = { id: 'foreign-user' }
  assert.equal((await f.route.POST(request())).status, 404)
  assert.equal(f.state.calls.length, 0)
  const g = portalFixture(); g.env.STRIPE_SECRET_KEY = 'sk_live_fixture'; g.env.VERCEL_ENV = 'preview'; g.env.PAYMENT_ENVIRONMENT = 'production'
  assert.equal((await g.route.POST(request())).status, 503)
  assert.equal(g.state.calls.length, 0)
})
