import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
function load(path, mocks = {}) {
  const module = { exports: {} }
  const source = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  vm.runInNewContext(source, { module, exports: module.exports, require: name => name === 'server-only' ? {} : mocks[name] ?? require(name), process, Buffer, Intl, URL, Response, console }, { filename: path })
  return module.exports
}
const environment = load('lib/commerce/environment.ts')
const proof = load('lib/commerce/purchaseProof.ts')
const catalog = load('lib/commerce/catalog.ts')
const fulfillment = load('lib/commerce/fulfillment.ts', { '@/lib/commerce/catalog': catalog })
const variables = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'PAYMENT_TEST_DATABASE_ISOLATED', 'PAYMENT_ENVIRONMENT', 'VERCEL_ENV', 'EMBER_SUB_PRICE', 'EMBER_YEAR_PRICE', 'NEXT_PUBLIC_APP_URL', 'RESEND_API_KEY']
async function isolated(run) {
  const prior = Object.fromEntries(variables.map(key => [key, process.env[key]]))
  variables.forEach(key => delete process.env[key])
  Object.assign(process.env, { STRIPE_SECRET_KEY: 'sk_test_mock_only', STRIPE_WEBHOOK_SECRET: 'whsec_mock_only', PAYMENT_TEST_DATABASE_ISOLATED: 'true', EMBER_SUB_PRICE: 'price_MonthlyMock', EMBER_YEAR_PRICE: 'price_FullMock', RESEND_API_KEY: 're_mock_only' })
  try { await run() } finally { for (const key of variables) { if (prior[key] === undefined) delete process.env[key]; else process.env[key] = prior[key] } }
}
function price(billing = 'annual', months = '1') {
  return { id: billing === 'annual' ? 'price_FullMock' : 'price_MonthlyMock', active: true, currency: 'usd', unit_amount: 36000, billing_scheme: 'per_unit', type: billing === 'annual' ? 'one_time' : 'recurring', recurring: billing === 'annual' ? null : { interval: 'month', interval_count: 1, usage_type: 'licensed' }, metadata: { program: 'ember', ...(months ? { access_months: months } : {}) }, product: { id: 'prod_EmberMock', active: true, metadata: { program: 'ember' } }, transform_quantity: null, custom_unit_amount: null }
}
function session(billing = 'annual') {
  return { id: 'cs_test_mock', status: 'complete', payment_status: 'paid', livemode: false, created: Date.parse('2028-01-31T16:00:00Z') / 1000, mode: billing === 'annual' ? 'payment' : 'subscription', metadata: { program: 'ember', billing, price_id: billing === 'annual' ? 'price_FullMock' : 'price_MonthlyMock', access_months: '1', purchase_proof_hash: 'a'.repeat(64) }, line_items: { data: [{ quantity: 1, price: { id: billing === 'annual' ? 'price_FullMock' : 'price_MonthlyMock' } }] }, customer_details: { email: '  Ember.Customer@Example.test  ', name: 'Test Customer' }, customer: 'cus_test_mock', subscription: billing === 'subscription' ? 'sub_test_mock' : null }
}
function transport(value = session(), configuredPrice = price()) {
  const calls = []
  const subscription = { id: 'sub_test_mock', status: 'active', current_period_start: Date.parse('2028-02-15T10:00:00Z') / 1000, current_period_end: Date.parse('2028-03-15T10:00:00Z') / 1000, cancel_at_period_end: false, items: { data: [] } }
  const stripe = { checkout: { sessions: { retrieve: async (_id, options) => { assert.equal(JSON.stringify(options.expand), JSON.stringify(['line_items.data.price.product', 'subscription'])); return value } } }, prices: { retrieve: async () => configuredPrice }, subscriptions: { retrieve: async () => subscription } }
  const supabase = { rpc: async (name, args) => { calls.push({ name, args }); return { data: { client_id: 'AN-TEST', email: 'ember.customer@example.test', program: 'ember', auth_user_id: null, replayed: calls.length > 1 }, error: null } } }
  return { stripe, supabase, calls, subscription, sessionId: value.id }
}

test('payment environment denies nonproduction live keys and nonisolated Stripe test databases', () => isolated(async () => {
  assert.equal(environment.paymentEnvironmentError(), null)
  delete process.env.PAYMENT_TEST_DATABASE_ISOLATED
  assert.match(environment.paymentEnvironmentError(), /isolated test database/)
  process.env.STRIPE_SECRET_KEY = 'sk_live_mock_only'
  assert.match(environment.paymentEnvironmentError(), /Live payments are disabled/)
  process.env.VERCEL_ENV = 'preview'
  assert.match(environment.paymentEnvironmentError(), /Live payments are disabled/)
  process.env.VERCEL_ENV = 'production'
  assert.equal(environment.paymentEnvironmentError(), null)
  delete process.env.STRIPE_SECRET_KEY
  assert.match(environment.paymentEnvironmentError(), /not configured/)
}))

test('purchase proof is random, hashed and refuses missing, malformed or forged ownership proof', () => {
  const first = proof.createPurchaseProof(), second = proof.createPurchaseProof()
  assert.notEqual(first, second); assert.match(first, /^[A-Za-z0-9_-]{43}$/)
  const hash = proof.hashPurchaseProof(first)
  assert.equal(proof.verifyPurchaseProof(first, hash), true)
  assert.equal(proof.verifyPurchaseProof(second, hash), false)
  assert.equal(proof.verifyPurchaseProof(undefined, hash), false)
  assert.equal(proof.verifyPurchaseProof(first, undefined), false)
  assert.equal(proof.verifyPurchaseProof(first, 'bad-hash'), false)
  assert.notEqual(hash, first)
})

test('fulfillment rejects unpaid, incomplete, wrong environment, unknown tier and wrong price without granting access', () => isolated(async () => {
  const invalid = [
    { payment_status: 'unpaid' }, { status: 'open' }, { livemode: true },
    { metadata: { program: 'founder', billing: 'annual' } },
    { metadata: { program: 'ember', billing: 'unsupported' } },
    { line_items: { data: [{ quantity: 1, price: { id: 'price_WrongTier' } }] } },
    { line_items: { data: [{ quantity: 2, price: { id: 'price_FullMock' } }] } },
  ]
  for (const override of invalid) {
    const input = transport({ ...session(), ...override })
    await assert.rejects(fulfillment.fulfillPurchase(input))
    assert.equal(input.calls.length, 0)
  }
  const duplicateItems = session(); duplicateItems.line_items.data.push({ quantity: 1, price: { id: 'price_FullMock' } })
  const input = transport(duplicateItems); await assert.rejects(fulfillment.fulfillPurchase(input)); assert.equal(input.calls.length, 0)
}))

test('pay-in-full fulfillment requires explicit duration and clamps calendar month end; retry reaches idempotent RPC with same period', () => isolated(async () => {
  const missingSnapshot = session(); delete missingSnapshot.metadata.access_months
  const noDuration = transport(missingSnapshot, price('annual', null))
  await assert.rejects(fulfillment.fulfillPurchase(noDuration), /needs confirmation/); assert.equal(noDuration.calls.length, 0)
  const input = transport()
  const first = await fulfillment.fulfillPurchase(input), retry = await fulfillment.fulfillPurchase(input)
  assert.equal(first.replayed, false); assert.equal(retry.replayed, true)
  assert.equal(input.calls[0].name, 'fulfill_checkout_purchase')
  assert.equal(input.calls[0].args.p_purchase.period_start, '2028-01-31T16:00:00.000Z')
  assert.equal(input.calls[0].args.p_purchase.period_end, '2028-02-29T16:00:00.000Z')
  assert.equal(input.calls[0].args.p_purchase.email, 'ember.customer@example.test')
  assert.equal(JSON.stringify(input.calls[0].args), JSON.stringify(input.calls[1].args))
  assert.equal(input.calls[0].args.p_purchase.billing_status, 'paid_in_full')
  assert.equal(input.calls[0].args.p_purchase.access_active, true)
}))

test('paid purchase snapshots preserve their original price and duration after catalog replacement or deactivation', () => isolated(async () => {
  const input = transport()
  process.env.EMBER_YEAR_PRICE = 'price_Replacement'
  input.stripe.prices.retrieve = async () => { throw new Error('Historical price is deactivated') }
  await fulfillment.fulfillPurchase(input)
  assert.equal(input.calls[0].args.p_purchase.period_end, '2028-02-29T16:00:00.000Z')
  const legacy = session(); delete legacy.metadata.purchase_proof_hash
  const noSnapshot = transport(legacy)
  await assert.rejects(fulfillment.fulfillPurchase(noSnapshot))
  assert.equal(noSnapshot.calls.length, 0)
}))

test('subscription fulfillment uses Stripe current period and status; canceled state sync does not manufacture active access', () => isolated(async () => {
  const input = transport(session('subscription'), price('subscription'))
  await fulfillment.fulfillPurchase(input)
  assert.equal(input.calls[0].args.p_purchase.period_start, '2028-02-15T10:00:00.000Z')
  assert.equal(input.calls[0].args.p_purchase.period_end, '2028-03-15T10:00:00.000Z')
  input.subscription.status = 'past_due'
  await fulfillment.fulfillPurchase(input)
  assert.equal(input.calls[1].args.p_purchase.access_active, false)
  input.subscription.status = 'canceled'
  await fulfillment.syncSubscription({ ...input, subscriptionId: 'sub_test_mock', eventCreated: 100 })
  assert.equal(input.calls[2].name, 'sync_member_subscription')
  assert.equal(input.calls[2].args.p_state.status, 'canceled'); assert.equal(input.calls[2].args.p_state.access, false)
  assert.equal(input.calls[2].args.p_state.event_created, 100)
  input.supabase.rpc = async () => ({ data: null, error: { message: 'private SQL detail' } })
  await assert.rejects(fulfillment.fulfillPurchase(input), /safely activated/)
  await assert.rejects(fulfillment.syncSubscription({ ...input, subscriptionId: 'sub_test_mock', eventCreated: 101 }), /Stripe should retry/)
}))

test('checkout rejects missing activation setup and forged client reference before creating Stripe checkout', () => isolated(async () => {
  let ready = true, owner = null, createCalls = [], cookies = [], existingBilling = null, currentStatus = 'active'
  class StripeMock {
    constructor() {
      this.prices = { retrieve: async () => price('subscription') }
      this.subscriptions = { retrieve: async () => ({ id: 'sub_Owned', status: currentStatus }) }
      this.checkout = { sessions: { create: async value => { createCalls.push(value); return { id: 'cs_test_owned_mock', url: 'https://checkout.stripe.test/session' } } } }
    }
  }
  const route = load('app/api/checkout/route.ts', {
    'next/server': { NextResponse: { json: (body, init) => { const response = Response.json(body, init); response.cookies = { set: (...args) => cookies.push(args) }; return response } } },
    stripe: StripeMock, '@/lib/commerce/catalog': catalog, '@/lib/commerce/environment': environment, '@/lib/commerce/purchaseProof': proof,
    '@/lib/supabase/admin': { createAdminClient: () => ({ rpc: async () => ({ data: ready, error: null }) }) },
    '@/lib/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: owner } }) }, from: table => ({ select: () => ({ eq: (_field, value) => ({ maybeSingle: async () => { assert.equal(value, table === 'clients' ? owner.id : 'AN-OWNED'); return { data: table === 'clients' ? { client_id: 'AN-OWNED' } : existingBilling, error: null } } }) }) }) }) },
  })
  const request = body => new Request('https://isolated-test.invalid/api/checkout', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } })
  const body = { program: 'ember', billing: 'subscription', email: 'guest@example.test' }
  delete process.env.STRIPE_WEBHOOK_SECRET
  assert.equal((await route.POST(request(body))).status, 503); assert.equal(createCalls.length, 0)
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_mock_only'; ready = false
  assert.equal((await route.POST(request(body))).status, 503); assert.equal(createCalls.length, 0)
  ready = true
  delete process.env.RESEND_API_KEY
  assert.equal((await route.POST(request(body))).status, 503); assert.equal(createCalls.length, 0)
  process.env.RESEND_API_KEY = 're_mock_only'
  assert.equal((await route.POST(request({ ...body, client_id: 'AN-OTHER' }))).status, 403); assert.equal(createCalls.length, 0)
  owner = { id: 'owned-user', email: 'verified-owner@example.test' }
  assert.equal((await route.POST(request({ ...body, client_id: 'AN-OTHER' }))).status, 403); assert.equal(createCalls.length, 0)
  const response = await route.POST(request({ ...body, client_id: 'AN-OWNED' }))
  assert.equal(response.status, 200); assert.equal(createCalls.length, 1)
  const purchase = createCalls[0]
  assert.equal(purchase.customer_email, owner.email)
  assert.equal(purchase.metadata.client_id, 'AN-OWNED'); assert.equal(purchase.metadata.auth_user_id, owner.id)
  assert.equal(purchase.cancel_url, 'https://isolated-test.invalid/program/ember/cart?checkout=canceled')
  assert.equal(cookies[0][0], proof.purchaseCookieName('cs_test_owned_mock'))
  assert.equal(proof.verifyPurchaseProof(cookies[0][1], purchase.metadata.purchase_proof_hash), true)
  assert.equal(cookies[0][2].httpOnly, true); assert.equal(cookies[0][2].secure, true); assert.equal(cookies[0][2].sameSite, 'lax'); assert.equal(cookies[0][2].path, '/verified')
  assert.doesNotMatch(JSON.stringify(await response.json()), /purchase_proof|auth_user_id|sk_test_/)
  existingBilling = { stripe_customer_id: 'cus_Owned', stripe_subscription_id: 'sub_Owned' }
  for (const status of ['active', 'trialing', 'past_due', 'unpaid', 'incomplete']) {
    currentStatus = status
    assert.equal((await route.POST(request({ ...body, client_id: 'AN-OWNED' }))).status, 409)
    assert.equal(createCalls.length, 1)
  }
  for (const status of ['canceled', 'incomplete_expired']) {
    currentStatus = status
    assert.equal((await route.POST(request({ ...body, client_id: 'AN-OWNED' }))).status, 200)
    assert.equal(createCalls.at(-1).customer, 'cus_Owned')
    assert.equal(createCalls.at(-1).customer_email, undefined)
  }
}))
