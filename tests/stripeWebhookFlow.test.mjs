import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'
const require = createRequire(import.meta.url)
function load(path, mocks, env) {
  const module = { exports: {} }
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  vm.runInNewContext(code, { module, exports: module.exports, require: id => id === 'server-only' ? {} : mocks[id] ?? require(id), process: { env }, Buffer, Date, URL, Request, Response, console: { error() {} } })
  return module.exports
}
function fixture() {
  const env = { STRIPE_SECRET_KEY: 'sk_test_local', STRIPE_WEBHOOK_SECRET: 'whsec_local', PAYMENT_TEST_DATABASE_ISOLATED: 'true', EMBER_SUB_PRICE: 'price_monthly', EMBER_YEAR_PRICE: 'price_full' }
  const state = { events: new Map(), purchases: new Map(), grantCount: 0, readFailures: 0, insertFailures: 0, rpcFailures: 0, syncs: [], subscription: { id: 'sub_owned', status: 'active', cancel_at_period_end: false, current_period_start: 2000000000, current_period_end: 2002678400, items: { data: [] } } }
  const session = { id: 'cs_test_one', status: 'complete', payment_status: 'paid', livemode: false, created: 2000000000, mode: 'subscription', subscription: 'sub_owned', customer: 'cus_owned', customer_email: 'qa@example.test', metadata: { program: 'ember', billing: 'subscription' }, line_items: { data: [{ quantity: 1, price: { id: 'price_monthly' } }] } }
  const price = { id: 'price_monthly', active: true, product: { id: 'prod_ember', active: true, metadata: { program: 'ember' } }, unit_amount: 36000, currency: 'usd', billing_scheme: 'per_unit', metadata: {}, type: 'recurring', recurring: { interval: 'month', interval_count: 1, usage_type: 'licensed' } }
  class Stripe {
    webhooks = { constructEvent(payload, signature) { if (signature !== 'valid') throw new Error('Invalid signature'); return JSON.parse(payload) } }
    prices = { retrieve: async () => price }
    checkout = { sessions: { retrieve: async () => session } }
    subscriptions = { retrieve: async () => state.subscription }
  }
  const db = { from(table) {
    assert.equal(table, 'stripe_webhook_events')
    let id
    return { select() { return this }, eq(_key, value) { id = value; return this }, async maybeSingle() { if (state.readFailures-- > 0) return { error: { code: 'XX000' } }; return { data: state.events.get(id) || null, error: null } }, async insert(row) { if (state.insertFailures-- > 0) return { error: { code: 'XX000' } }; if (state.events.has(row.event_id)) return { error: { code: '23505' } }; state.events.set(row.event_id, row); return { error: null } } }
  }, async rpc(name, args) {
    if (state.rpcFailures-- > 0) return { error: { code: 'XX000' } }
    if (name === 'fulfill_checkout_purchase') {
      const purchase = args.p_purchase
      if (!state.purchases.has(purchase.session_id)) { state.purchases.set(purchase.session_id, purchase); state.grantCount++ }
      return { data: { client_id: 'qa-client', program: 'ember', email: 'qa@example.test', auth_user_id: null, replayed: state.grantCount > 1 }, error: null }
    }
    assert.equal(name, 'sync_member_subscription'); state.syncs.push(args); return { error: null }
  } }
  const catalog = load('lib/commerce/catalog.ts', {}, env)
  const fulfillment = load('lib/commerce/fulfillment.ts', { '@/lib/commerce/catalog': catalog }, env)
  const environment = load('lib/commerce/environment.ts', {}, env)
  const route = load('app/api/webhooks/stripe/route.ts', { stripe: Stripe, 'next/server': { NextResponse: { json: (data, init) => new Response(JSON.stringify(data), init) } }, '@/lib/supabase/admin': { createAdminClient: () => db }, '@/lib/commerce/environment': environment, '@/lib/commerce/fulfillment': fulfillment }, env)
  const event = (id, type = 'checkout.session.completed', object = session) => ({ id, type, livemode: false, created: 2000000010, data: { object } })
  const send = (value, signature = 'valid') => route.POST(new Request('https://anastasis.test/api/webhooks/stripe', { method: 'POST', headers: signature ? { 'stripe-signature': signature } : {}, body: JSON.stringify(value) }))
  return { state, session, event, send, env }
}
test('real webhook handler rejects missing/bad signatures and payment environment mismatch before writes', async () => {
  const f = fixture()
  assert.equal((await f.send(f.event('evt_missing'), '')).status, 400)
  assert.equal((await f.send(f.event('evt_bad'), 'forged')).status, 400)
  const wrong = f.event('evt_live'); wrong.livemode = true
  assert.equal((await f.send(wrong)).status, 400)
  assert.equal(f.state.events.size, 0); assert.equal(f.state.grantCount, 0)
})
test('database failures return retry responses; retries and multiple session event IDs grant one purchase', async () => {
  const f = fixture()
  f.state.readFailures = 1
  assert.equal((await f.send(f.event('evt_read'))).status, 500)
  assert.equal(f.state.grantCount, 0)
  f.state.insertFailures = 1
  assert.equal((await f.send(f.event('evt_paid'))).status, 500)
  assert.equal(f.state.grantCount, 1)
  assert.equal((await f.send(f.event('evt_paid'))).status, 200)
  const duplicate = await f.send(f.event('evt_paid'))
  assert.equal((await duplicate.json()).duplicate, true)
  const results = await Promise.all([f.send(f.event('evt_alias_a')), f.send(f.event('evt_alias_b', 'checkout.session.async_payment_succeeded'))])
  assert.deepEqual(results.map(response => response.status), [200, 200])
  assert.equal(f.state.grantCount, 1); assert.equal(f.state.purchases.size, 1)
})
test('unpaid completion does not grant access; later asynchronous success fulfills the actual paid session', async () => {
  const f = fixture(); f.session.payment_status = 'unpaid'
  assert.equal((await f.send(f.event('evt_unpaid'))).status, 200)
  assert.equal(f.state.grantCount, 0)
  f.session.payment_status = 'paid'
  assert.equal((await f.send(f.event('evt_async', 'checkout.session.async_payment_succeeded'))).status, 200)
  assert.equal(f.state.grantCount, 1)
  assert.equal((await f.send(f.event('evt_failed', 'checkout.session.async_payment_failed'))).status, 200)
  assert.equal(f.state.grantCount, 1)
})
test('failed/successful invoices use current Stripe cancellation and never invent active status; unrelated subscriptions grant nothing', async () => {
  const f = fixture(); f.state.subscription.status = 'canceled'
  assert.equal((await f.send(f.event('evt_failed', 'invoice.payment_failed', { subscription: 'sub_owned' }))).status, 200)
  assert.equal(f.state.syncs[0].p_state.status, 'canceled'); assert.equal(f.state.syncs[0].p_state.access, false)
  assert.equal((await f.send(f.event('evt_old_success', 'invoice.payment_succeeded', { subscription: 'sub_owned' }))).status, 200)
  assert.equal(f.state.syncs[1].p_state.access, false)
  assert.equal((await f.send(f.event('evt_parent_subscription', 'invoice.payment_failed', { parent: { subscription_details: { subscription: 'sub_owned' } } }))).status, 200)
  assert.equal(f.state.syncs[2].p_state.status, 'canceled')
  f.state.subscription.id = 'sub_unlinked'
  assert.equal((await f.send(f.event('evt_unlinked', 'customer.subscription.updated', f.state.subscription))).status, 200)
  assert.equal(f.state.grantCount, 0)
})
