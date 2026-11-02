import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
function load(path, mocks = {}, env = {}) {
  const module = { exports: {} }
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  vm.runInNewContext(code, { module, exports: module.exports, require: name => name === 'server-only' ? {} : mocks[name] ?? require(name), process: { env }, Buffer, Date, URL, URLSearchParams, Request, Response, console: { error() {} } })
  return module.exports
}
const env = { EMBER_SUB_PRICE: 'price_ember', IGNITE_SUB_PRICE: 'price_ignite', PHOENIX_SUB_PRICE: 'price_phoenix' }
const catalog = load('lib/commerce/catalog.ts', {}, env)
const fulfillment = load('lib/commerce/fulfillment.ts', { '@/lib/commerce/catalog': catalog }, env)

test('subscription mapping requires a single approved server price; Tracker stays unavailable until configured', async () => {
  assert.equal(catalog.parseProgram('tracker'), 'tracker')
  assert.equal(catalog.parseProgram('founder'), null)
  assert.equal(catalog.configuredPriceId('tracker', 'subscription'), undefined)
  assert.equal(catalog.subscriptionProgramForPrice('price_ember'), 'ember')
  assert.equal(catalog.subscriptionProgramForPrice('price_unknown'), null)
  await assert.rejects(catalog.getPrice({ prices: { retrieve() { assert.fail('Unconfigured Tracker must not call the provider') } } }, 'tracker', 'subscription'), /not configured/)
  env.TRACKER_SUB_PRICE = 'price_tracker'
  assert.equal(catalog.subscriptionProgramForPrice('price_tracker'), 'tracker')
  env.TRACKER_SUB_PRICE = 'price_ember'
  assert.equal(catalog.subscriptionProgramForPrice('price_ember'), null)
  delete env.TRACKER_SUB_PRICE
})

test('subscription sync resolves current item price, ignores caller metadata and clears unknown-price access without fabricating a tier', async () => {
  const calls = []
  const subscription = { id: 'sub_synthetic', status: 'active', current_period_start: 1900000000, current_period_end: 1902678400, cancel_at_period_end: false,
    metadata: { program: 'phoenix' }, items: { data: [{ quantity: 1, price: { id: 'price_ignite', type: 'recurring', recurring: { interval: 'month', interval_count: 1 } } }] } }
  const input = { stripe: { subscriptions: { retrieve: async () => subscription } }, supabase: { rpc: async (name, args) => { calls.push({ name, args }); return { data: { accepted: true }, error: null } } }, subscriptionId: subscription.id, eventCreated: 99 }
  await fulfillment.syncSubscription(input)
  assert.equal(calls[0].name, 'sync_member_subscription_v3')
  assert.equal(calls[0].args.p_state.program, 'ignite')
  assert.equal(calls[0].args.p_state.price_id, 'price_ignite')
  assert.equal(calls[0].args.p_state.access, true)
  subscription.items.data[0].price.id = 'price_unknown'
  await fulfillment.syncSubscription(input)
  assert.equal(calls[1].args.p_state.program, null)
  assert.equal(calls[1].args.p_state.access, false)
  subscription.status = 'canceled'; subscription.items.data[0].price.id = 'price_ember'
  await fulfillment.syncSubscription(input)
  assert.equal(calls[2].args.p_state.status, 'canceled')
  assert.equal(calls[2].args.p_state.access, false)
  subscription.items.data.push(subscription.items.data[0])
  await fulfillment.syncSubscription(input)
  assert.equal(calls[3].args.p_state.program, null)
})

test('initial purchase cannot grant a stale receipt tier after its current subscription price becomes unknown or changes tier', async () => {
  const session = { id: 'cs_test_stale', status: 'complete', payment_status: 'paid', livemode: false, mode: 'subscription', created: 1900000000,
    metadata: { program: 'ember', billing: 'subscription', price_id: 'price_ember', purchase_proof_hash: 'a'.repeat(64) },
    line_items: { data: [{ quantity: 1, price: { id: 'price_ember' } }] }, customer_email: 'receipt@example.test', subscription: 'sub_stale' }
  const subscription = { id: 'sub_stale', status: 'active', current_period_start: 1900000000, current_period_end: 1902678400,
    items: { data: [{ quantity: 1, price: { id: 'price_unknown', type: 'recurring', recurring: { interval: 'month', interval_count: 1 } } }] } }
  let writes = 0
  const input = { sessionId: session.id, stripe: { checkout: { sessions: { retrieve: async () => session } }, subscriptions: { retrieve: async () => subscription } }, supabase: { rpc() { writes++; assert.fail('Unknown or changed subscription must not grant the stale receipt tier') } } }
  await assert.rejects(fulfillment.fulfillPurchase(input), /subscription price does not match/)
  subscription.items.data[0].price.id = 'price_ignite'
  await assert.rejects(fulfillment.fulfillPurchase(input), /subscription price does not match/)
  assert.equal(writes, 0)
  const receiptPrice = session.line_items.data[0].price
  session.line_items.data[0].price = null
  await assert.rejects(fulfillment.fulfillPurchase(input), /purchased price does not match/)
  session.line_items.data[0].price = receiptPrice
  subscription.items.data[0].price.id = 'price_ember'
  input.supabase.rpc = async (_name, args) => {
    assert.equal(args.p_purchase.price_id, 'price_ember')
    assert.equal(args.p_purchase.program, 'ember')
    return { data: { client_id: 'verified-owner', program: 'ember', email: 'receipt@example.test', auth_user_id: null }, error: null }
  }
  assert.equal((await fulfillment.fulfillPurchase(input)).program, 'ember')
})

function invitationFixture() {
  const state = { status: 'pending', claimError: false, providerFailure: false, finishFailure: false, claims: [], messages: [], finishes: [] }
  const invitationEnv = { RESEND_API_KEY: 'synthetic-resend', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-invitation-signing-secret' }
  const job = { session_id: 'cs_test_owned', client_id: 'receipt-owner', email: 'receipt@example.test', program: 'ignite', invitation_id: 'synthetic-invitation', expires_at: '2099-01-01T00:00:00Z', lease_token: 'synthetic-lease', first_attempt_at: new Date().toISOString() }
  const db = { async rpc(name, args) {
    if (name === 'claim_purchase_invitation') { state.claims.push(args); if (state.claimError) return { error: { message: 'synthetic failure' } }; if (state.status === 'delivered' || state.status === 'suppressed' || state.status === 'manual_recovery') return { data: null }; state.status = 'sending'; return { data: job } }
    assert.equal(name, 'finish_purchase_invitation'); state.finishes.push(args)
    if (state.finishFailure) return { error: { message: 'synthetic failure' } }
    state.status = args.p_delivered ? 'delivered' : 'pending'; return { data: true }
  }, from() { return { select() { return this }, eq() { return this }, async maybeSingle() { return { data: { status: state.status }, error: null } } } } }
  class Resend { emails = { send: async (payload, options) => { state.messages.push({ payload, options }); if (state.providerFailure) throw new Error('Synthetic network timeout'); return { data: { id: 'synthetic-mail' }, error: null } } } }
  const invitations = load('lib/auth/clientInvitations.ts')
  const delivery = load('lib/commerce/invitationDelivery.ts', { resend: { Resend }, '@/lib/auth/clientInvitations': invitations }, invitationEnv)
  const run = () => delivery.deliverPurchaseInvitation({ supabase: db, clientId: 'untrusted-client', email: 'wrong@example.test', program: 'phoenix', sessionId: job.session_id, origin: 'https://app.example.test' })
  return { state, run, delivery, invitationEnv, job }
}

test('durable invitations use authoritative receipt ownership, hashed stable tokens, and a stable provider key', async () => {
  const f = invitationFixture()
  assert.equal(await f.run(), true)
  assert.equal(f.state.messages.length, 1)
  assert.equal(f.state.messages[0].payload.to, 'receipt@example.test')
  const html = f.state.messages[0].payload.html
  assert.match(html, /client_id=receipt-owner/)
  assert.doesNotMatch(html, /wrong@example|untrusted-client|program=phoenix/)
  assert.equal(f.state.messages[0].options.idempotencyKey, 'purchase-login:cs_test_owned')
  assert.equal(f.state.claims[0].p_token_hash.length, 64)
  assert.doesNotMatch(JSON.stringify(f.state.claims[0]), new RegExp(f.delivery.purchaseInvitationToken(f.job.session_id)))
  assert.equal(await f.run(), true)
  assert.equal(f.state.messages.length, 1)
})

test('provider timeout and post-send persistence failure retry the same invitation without claiming success', async () => {
  const f = invitationFixture(); f.state.providerFailure = true
  await assert.rejects(f.run(), /Retry is required/)
  assert.equal(f.state.finishes.at(-1).p_delivered, false)
  f.state.providerFailure = false; f.state.finishFailure = true
  await assert.rejects(f.run(), /Retry is required/)
  f.state.finishFailure = false
  assert.equal(await f.run(), true)
  assert.equal(new Set(f.state.messages.map(message => message.options.idempotencyKey)).size, 1)
  assert.equal(new Set(f.state.messages.map(message => message.payload.html)).size, 1)
  assert.equal(new Set(f.state.claims.map(claim => claim.p_token_hash)).size, 1)
})

test('suppressed returning accounts and recovery-held jobs never send replacement invitations', async () => {
  const f = invitationFixture(); f.state.status = 'suppressed'
  assert.equal(await f.run(), false)
  f.state.status = 'manual_recovery'
  await assert.rejects(f.run(), /pending/)
  assert.equal(f.state.messages.length, 0)
  f.state.status = 'pending'; f.state.claimError = true
  await assert.rejects(f.run(), /administrator setup/)
  assert.equal(f.state.messages.length, 0)
  delete f.invitationEnv.RESEND_API_KEY
  await assert.rejects(f.run(), /not configured/)
})

test('invitation retry endpoint requires the existing scheduler secret and never exposes receipt data', async () => {
  let drains = 0, conversions = 0, reminders = 0
  const cronEnv = { CRON_SECRET: 'synthetic-scheduler' }
  const route = load('app/api/commerce/invitations/cron/route.ts', {
    'next/server': { NextResponse: { json: (data, init) => Response.json(data, init) } },
    '@/lib/supabase/admin': { createAdminClient: () => ({}) },
    '@/lib/commerce/invitationDelivery': { drainPurchaseInvitations: async () => { drains++; return { delivered: 1, failed: 0 } } },
    '@/lib/analytics/server': { deliverPendingConversions: async () => { conversions++; return true } },
    '@/lib/commerce/experienceReminderDelivery': { drainMembershipReminders: async () => { reminders++; return { delivered: 0, failed: 0, skipped: 0, configured: false } } },
  }, cronEnv)
  assert.equal((await route.GET(new Request('https://app.test/cron'))).status, 401)
  assert.equal(drains, 0)
  assert.equal(conversions, 0)
  assert.equal(reminders, 0)
  const response = await route.GET(new Request('https://app.test/cron', { headers: { authorization: 'Bearer synthetic-scheduler' } }))
  assert.deepEqual(await response.json(), { delivered: 1, failed: 0, reminders: { delivered: 0, failed: 0, skipped: 0, configured: false } })
  assert.equal(drains, 1)
  assert.equal(conversions, 1)
  assert.equal(reminders, 1)
})
