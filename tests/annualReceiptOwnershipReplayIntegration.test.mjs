import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { PGlite } from '@electric-sql/pglite'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const owner = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'
const iso = value => new Date(value).toISOString()
const plain = value => JSON.parse(JSON.stringify(value))
const seconds = value => Date.parse(value) / 1000

function annualSession(overrides = {}) {
  const charge = { id: 'ch_AnnualSynthetic', object: 'charge', paid: true, status: 'succeeded', captured: true, refunded: false,
    amount: 360000, amount_captured: 360000, amount_refunded: 0, currency: 'usd', livemode: false,
    created: seconds('2024-02-29T16:45:30Z'), payment_intent: 'pi_AnnualSynthetic', customer: 'cus_AnnualSynthetic' }
  const paymentIntent = { id: 'pi_AnnualSynthetic', object: 'payment_intent', status: 'succeeded', amount: 360000,
    amount_received: 360000, currency: 'usd', livemode: false, latest_charge: charge, customer: 'cus_AnnualSynthetic' }
  return { id: 'cs_test_AnnualSynthetic', object: 'checkout.session', status: 'complete', payment_status: 'paid', livemode: false,
    created: seconds('2024-02-28T12:00:00Z'), mode: 'payment', metadata: {}, amount_total: 360000, currency: 'usd',
    line_items: { data: [{ quantity: 1, price: { id: 'price_AnnualEmber', type: 'one_time', recurring: null, livemode: false, product: 'prod_AnnualSynthetic' } }] },
    customer_details: { email: 'receipt@synthetic.invalid', name: 'Synthetic Owner' }, customer: 'cus_AnnualSynthetic',
    subscription: null, payment_intent: paymentIntent, ...overrides }
}

async function fixture() {
  const db = new PGlite()
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated,service_role;
    grant execute on function auth.uid() to anon,authenticated,service_role;
    create table clients(client_id text primary key,email text,full_name text,program text,auth_user_id uuid,login_email text,
      onboarding_completed boolean default false,verified_purchase boolean default false,access boolean default false,active boolean default false,
      subscription_status text,subscription_started_at date,subscription_ends_at date,timezone text,state text,onboarding_data jsonb default '{}',updated_at timestamptz default now());
    create table client_billing(id uuid primary key default gen_random_uuid(),client_id text references clients(client_id),stripe_customer_id text,stripe_subscription_id text,
      billing_type text,billing_status text,current_period_start timestamptz,current_period_end timestamptz,last_payment_date timestamptz,next_payment_date timestamptz,
      access_active boolean default false,cancel_at_period_end boolean default false,updated_at timestamptz default now());
    grant select,insert,update,delete on clients to service_role;
    grant select on clients to authenticated;alter table clients enable row level security;
    create policy owned_profile_read on clients for select to authenticated using(auth_user_id=auth.uid());
    insert into auth.users(id,email,email_confirmed_at) values('${owner}','receipt@synthetic.invalid',now()),('${other}','other@synthetic.invalid',now());
    insert into clients(client_id,auth_user_id,email,login_email,program,timezone,access,active) values
      ('ANNUAL-OWNER','${owner}','owner@synthetic.invalid','owner@synthetic.invalid','free','America/Chicago',true,true),
      ('ANNUAL-OTHER','${other}','other@synthetic.invalid','other@synthetic.invalid','free','America/Chicago',true,true);`)
  for (const file of ['20261101145900_membership_exact_expiry.sql', '20261101150000_launch_commerce_foundation.sql',
    '20261101170500_subscription_reconciliation.sql', '20261101180000_membership_milestones.sql']) {
    await db.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'))
  }
  await db.exec('set role service_role')
  const env = { NODE_ENV: 'test', STRIPE_SECRET_KEY: 'sk_test_synthetic', STRIPE_WEBHOOK_SECRET: 'whsec_synthetic',
    PAYMENT_TEST_DATABASE_ISOLATED: 'true', EMBER_YEAR_PRICE: 'price_AnnualEmber', EMBER_SUB_PRICE: 'price_MonthlyEmber',
    IGNITE_YEAR_PRICE: 'price_AnnualIgnite', PHOENIX_YEAR_PRICE: 'price_AnnualPhoenix', NEXT_PUBLIC_APP_URL: 'https://synthetic.invalid',
    RESEND_API_KEY: 'synthetic-email-key', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-invitation-hmac-only' }
  const state = { session: annualSession(), user: null, cookies: new Map(), event: null, calls: [], emails: [], retrievals: [], priceOverrides: {},
    successAt: seconds('2024-02-29T16:45:30Z'), successEvents: null, eventLookups: [], eventLookupError: null }
  const price = id => ({ id, object: 'price', active: true, livemode: false, currency: 'usd', unit_amount: 360000, billing_scheme: 'per_unit',
    type: 'one_time', recurring: null, metadata: {}, product: { id: 'prod_AnnualSynthetic', object: 'product', active: true, metadata: {} },
    transform_quantity: null, custom_unit_amount: null, ...state.priceOverrides })
  const stripe = {
    checkout: { sessions: { async retrieve(id, options) { assert.equal(id, state.session.id); state.retrievals.push(plain(options || {})); return state.session } } },
    prices: { async retrieve(id) { return price(id) } },
    paymentIntents: { async retrieve(id) { assert.equal(id, state.session.payment_intent.id); return state.session.payment_intent } },
    charges: { async retrieve(id) { assert.equal(id, state.session.payment_intent.latest_charge.id); return state.session.payment_intent.latest_charge } },
    subscriptions: { async retrieve() { assert.fail('An annual one-time purchase must not fetch recurring subscription state.') } },
    events: { list(options) {
      state.eventLookups.push(plain(options || {}))
      if (state.eventLookupError) throw state.eventLookupError
      const events = state.successEvents ?? [{ id: 'evt_AnnualSuccessSynthetic', object: 'event', type: 'checkout.session.completed',
        livemode: state.session.livemode, created: state.successAt, data: { object: plain(state.session) } }]
      const page = { object: 'list', data: events, has_more: false, url: '/v1/events' }
      return { ...page, then(resolve, reject) { return Promise.resolve(page).then(resolve, reject) },
        async *[Symbol.asyncIterator]() { for (const event of events) yield event },
        autoPagingToArray: async () => events }
    } },
    webhooks: { constructEvent() { return state.event } },
  }
  const rpcArguments = {
    fulfill_checkout_purchase_v4: ['p_purchase'], claim_checkout_purchase_v4: ['p_session_id', 'p_user_id', 'p_verified_email'],
    claim_purchase_invitation: ['p_session_id', 'p_token_hash', 'p_expires_at'], finish_purchase_invitation: ['p_session_id', 'p_lease_token', 'p_delivered'],
  }
  const sqlName = value => { assert.match(value, /^[a-z_]+$/); return value }
  const admin = {
    async rpc(name, args) {
      state.calls.push({ name, args: plain(args) })
      assert.ok(rpcArguments[name], `Unexpected RPC ${name}`)
      const values = rpcArguments[name].map(key => args[key])
      try { return { data: (await db.query(`select public.${name}(${values.map((_, i) => `$${i + 1}`).join(',')}) result`, values)).rows[0].result, error: null } }
      catch (error) { return { data: null, error } }
    },
    from(table) {
      sqlName(table)
      const conditions = [], values = []
      let columns = '*', rowLimit, inserted
      const query = {
        select(value) { columns = value.split(',').map(sqlName).join(','); return query },
        eq(key, value) { values.push(value); conditions.push(`${sqlName(key)}=$${values.length}`); return query },
        not(key, operator, value) { assert.equal(operator, 'is'); assert.equal(value, null); conditions.push(`${sqlName(key)} is not null`); return query },
        limit(value) { assert.equal(value, 1); rowLimit = 1; return query },
        insert(value) { inserted = value; return query },
        async maybeSingle() { const result = await execute(); return { ...result, data: result.data?.[0] || null } },
        then(resolve, reject) { return execute().then(resolve, reject) },
      }
      async function execute() {
        try {
          if (inserted) {
            const keys = Object.keys(inserted)
            await db.query(`insert into public.${table}(${keys.map(sqlName).join(',')}) values(${keys.map((_, i) => `$${i + 1}`).join(',')})`, keys.map(key => inserted[key]))
            return { data: null, error: null }
          }
          const result = await db.query(`select ${columns} from public.${table}${conditions.length ? ` where ${conditions.join(' and ')}` : ''}${rowLimit ? ' limit 1' : ''}`, values)
          return { data: result.rows, error: null }
        } catch (error) { return { data: null, error } }
      }
      return query
    },
  }
  const modules = new Map()
  function load(path) {
    if (modules.has(path)) return modules.get(path).exports
    const module = { exports: {} }; modules.set(path, module)
    const compiled = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText
    runInNewContext(compiled, { module, exports: module.exports, process: { env }, Buffer, Intl, URL, URLSearchParams, Request, Response, Error,
      console: { error() { /* No receipt contents are printed by this synthetic fixture. */ } },
      require(name) {
        if (name === 'server-only') return {}
        if (name === 'stripe') return { __esModule: true, default: class Stripe { constructor() { return stripe } } }
        if (name === 'resend') return { Resend: class Resend { emails = { send: async (message, options) => { state.emails.push({ message, options }); return { data: { id: 'synthetic-email-id' }, error: null } } } } }
        if (name === 'next/headers') return { cookies: async () => ({ get: key => state.cookies.has(key) ? { value: state.cookies.get(key) } : undefined, toString: () => '' }) }
        if (name === 'next/link') return { __esModule: true, default: 'a' }
        if (name === 'next/server') return { NextResponse: { json: (body, init) => Response.json(body, init) } }
        if (name === '@/lib/supabase/admin') return { createAdminClient: () => admin }
        if (name === '@/lib/supabase/server') return { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: state.user } }) } }) }
        if (name === '../styles/globalstyles') return {}
        if (name.startsWith('@/')) return load(`${name.slice(2)}.ts`)
        return require(name)
      },
    }, { filename: path })
    return module.exports
  }
  const fulfill = successEvent => load('lib/commerce/fulfillment.ts').fulfillPurchase({ stripe, supabase: admin, sessionId: state.session.id, ...(successEvent ? { successEvent } : {}) })
  const verify = () => load('app/verified/page.tsx').default({ searchParams: Promise.resolve({ session_id: state.session.id }) })
  const webhook = async (id, type = 'checkout.session.completed') => {
    state.event = { id, object: 'event', type, livemode: state.session.livemode, created: state.successAt, data: { object: plain(state.session) } }
    return load('app/api/webhooks/stripe/route.ts').POST(new Request('https://synthetic.invalid/api/webhooks/stripe', { method: 'POST', headers: { 'stripe-signature': 'synthetic-signature' }, body: '{}' }))
  }
  const snapshot = async () => plain((await db.query(`select to_jsonb(c) profile,to_jsonb(b) billing from public.clients c join public.client_billing b using(client_id) order by c.client_id`)).rows)
  return { db, env, state, stripe, admin, load, fulfill, verify, webhook, snapshot, close: () => db.close() }
}

function text(node) {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(text).join(' ')
  return node && typeof node === 'object' ? text(node.props?.children) : ''
}

test('approved annual fulfillment accepts consistent live-mode evidence through the production-gated webhook without a sandbox-only offering', async t => {
  const app = await fixture(); t.after(app.close)
  // These credentials, SDK and event are synthetic VM inputs. No environment
  // value, real Stripe account, charge, signature or email provider is accessed.
  app.env.STRIPE_SECRET_KEY = 'sk_live_synthetic_only';app.env.VERCEL_ENV = 'production'
  app.state.session.livemode = true;app.state.session.line_items.data[0].price.livemode = true
  app.state.session.payment_intent.livemode = true;app.state.session.payment_intent.latest_charge.livemode = true
  app.state.priceOverrides.livemode = true
  const paidAt = Math.floor(Date.now()/1000)-3600
  app.state.session.created = paidAt-1800;app.state.session.payment_intent.latest_charge.created = paidAt
  app.state.event = { id:'evt_LiveAnnualSynthetic',type:'checkout.session.completed',livemode:true,created:paidAt,data:{object:app.state.session} }
  const response = await app.load('app/api/webhooks/stripe/route.ts').POST(new Request('https://synthetic.invalid/api/webhooks/stripe', {
    method:'POST',headers:{'stripe-signature':'synthetic-signature'},body:'{}',
  }))
  assert.equal(response.status,200)
  const payload = app.state.calls.find(call=>call.name==='fulfill_checkout_purchase_v4').args.p_purchase
  assert.equal(payload.livemode,true);assert.equal(payload.billing_type,'payment');assert.equal(payload.billing_status,'paid_in_full')
  assert.equal(payload.purchased_at,iso(paidAt*1000));assert.equal(payload.access_active,true)
  assert.equal(new Date(payload.period_end).getUTCFullYear(),new Date(paidAt*1000).getUTCFullYear()+1)
  assert.equal((await app.db.query('select livemode from public.checkout_purchases')).rows[0].livemode,true)
  assert.equal((await app.db.query('select count(*)::int n from public.membership_milestone_anchors')).rows[0].n,0)
})

test('monthly fulfillment and renewal keep provider billing periods without acquiring an annual cutoff', async t => {
  const app = await fixture(); t.after(app.close)
  app.state.session = annualSession({ id: 'cs_test_MonthlyPreserved', mode: 'subscription', subscription: 'sub_MonthlySynthetic',
    payment_intent: null, created: seconds('2098-04-15T10:00:00Z'),
    metadata: { program: 'ember', billing: 'subscription', price_id: 'price_MonthlyEmber', purchase_proof_hash: 'a'.repeat(64), access_months: '12' },
    line_items: { data: [{ quantity: 1, price: { id: 'price_MonthlyEmber' } }] } })
  const subscription = { id: 'sub_MonthlySynthetic', status: 'active', cancel_at_period_end: false,
    start_date: seconds('2098-01-15T10:00:00Z'), current_period_start: seconds('2098-04-15T10:00:00Z'), current_period_end: seconds('2098-05-15T10:00:00Z'),
    metadata: { program: 'phoenix', access_months: '12' },
    items: { data: [{ quantity: 1, price: { id: 'price_MonthlyEmber', type: 'recurring', recurring: { interval: 'month', interval_count: 1 } } }] } }
  app.stripe.subscriptions.retrieve = async id => { assert.equal(id, subscription.id); return subscription }
  const result = await app.fulfill(), payload = app.state.calls.at(-1).args.p_purchase
  assert.equal(result.program, 'ember');assert.equal(payload.billing_type, 'subscription')
  assert.equal(payload.period_start, '2098-04-15T10:00:00.000Z');assert.equal(payload.period_end, '2098-05-15T10:00:00.000Z')
  assert.equal(payload.membership_started_at, '2098-01-15T10:00:00.000Z')
  const anchorBefore = (await app.db.query('select id,started_at from public.membership_milestone_anchors')).rows
  assert.equal(anchorBefore.length, 1)
  subscription.current_period_start = seconds('2098-05-15T10:00:00Z');subscription.current_period_end = seconds('2098-06-15T10:00:00Z')
  const renewed = await app.load('lib/commerce/fulfillment.ts').syncSubscription({ stripe: app.stripe, subscriptionId: subscription.id, eventCreated: 100,
    supabase: { rpc: async (name,args) => {
      assert.equal(name, 'sync_member_subscription_v3')
      return { data: (await app.db.query('select public.sync_member_subscription_v3($1,$2) result',[args.p_subscription_id,args.p_state])).rows[0].result, error: null }
    } } })
  assert.equal(renewed.accepted, true)
  const billing = (await app.db.query('select billing_type,current_period_end from public.client_billing where client_id=$1',[result.clientId])).rows[0]
  assert.equal(billing.billing_type, 'subscription');assert.equal(iso(billing.current_period_end), '2098-06-15T10:00:00.000Z')
  assert.deepEqual((await app.db.query('select id,started_at from public.membership_milestone_anchors')).rows,anchorBefore)
})

test('legacy annual fulfillment uses the approved exact price and immutable success event for twelve calendar months, including leap and month ends', async t => {
  const app = await fixture(); t.after(app.close)
  for (const [index, [paidAt, expiry]] of [
    ['2024-02-29T16:45:30Z', '2025-02-28T16:45:30.000Z'],
    ['2023-01-31T23:59:59Z', '2024-01-31T23:59:59.000Z'],
    ['2025-04-30T12:34:56Z', '2026-04-30T12:34:56.000Z'],
  ].entries()) {
    app.state.session = annualSession({ id: `cs_test_AnnualCalendar${index}` })
    const charge = app.state.session.payment_intent.latest_charge
    app.state.successAt = seconds(paidAt)
    charge.created = app.state.successAt - 2 * 86_400
    app.state.session.created = charge.created - 86_400
    if (index === 2) {
      app.state.session.customer = null; app.state.session.payment_intent.customer = null; charge.customer = null
    }
    app.state.session.metadata = { client_id: 'ANNUAL-OTHER', auth_user_id: other,
      access_months: '120', purchased_at: '2099-01-01T00:00:00Z', membership_started_at: '2000-01-01T00:00:00Z' }
    const result = await app.fulfill()
    assert.equal(result.program, 'ember')
    assert.equal(result.authUserId, null, 'Legacy metadata cannot bind the purchase directly to an account.')
    const purchase = app.state.calls.at(-1).args.p_purchase
    assert.equal(app.state.calls.at(-1).name, 'fulfill_checkout_purchase_v4')
    assert.equal(purchase.period_start, iso(paidAt))
    assert.equal(purchase.purchased_at, iso(paidAt))
    assert.equal(purchase.period_end, expiry)
    assert.equal(purchase.access_active, false, 'Returning to an expired historical receipt cannot manufacture current access.')
    assert.equal(purchase.bound_user_id, null)
    assert.equal(purchase.bound_client_id, null)
    assert.equal(purchase.membership_started_at, null, 'A one-time annual purchase never arms recurring-membership check-ins.')
    assert.equal(purchase.membership_paid, true)
    assert.ok(app.state.retrievals.at(-1).expand.includes('payment_intent.latest_charge'))
  }
  assert.equal((await app.db.query('select count(*)::integer n from public.membership_milestone_anchors')).rows[0].n, 0)
  assert.equal((await app.db.query("select verified_purchase from clients where client_id='ANNUAL-OTHER'")).rows[0].verified_purchase, false)
})

test('annual fulfillment rejects unpaid, unknown, wrong-mode, ambiguous or inconsistent provider evidence before any ledger write', async t => {
  const app = await fixture(); t.after(app.close)
  const invalid = [
    ['unpaid', session => { session.payment_status = 'unpaid' }],
    ['no-payment-required', session => { session.payment_status = 'no_payment_required' }],
    ['open checkout', session => { session.status = 'open' }],
    ['wrong checkout mode', session => { session.mode = 'subscription' }],
    ['unexpected subscription', session => { session.subscription = 'sub_wrongMode' }],
    ['unknown price', session => { session.line_items.data[0].price.id = 'price_UnknownAnnual' }],
    ['conflicting program', session => { session.metadata.program = 'ignite' }],
    ['conflicting billing', session => { session.metadata.billing = 'subscription' }],
    ['conflicting snapshot price', session => { session.metadata.price_id = 'price_AnnualIgnite' }],
    ['wrong quantity', session => { session.line_items.data[0].quantity = 2 }],
    ['multiple items', session => { session.line_items.data.push(session.line_items.data[0]) }],
    ['inactive configured price', () => { app.state.priceOverrides.active = false }],
    ['recurring configured price', () => { app.state.priceOverrides.type = 'recurring'; app.state.priceOverrides.recurring = { interval: 'year', interval_count: 1 } }],
    ['ambiguous configured mapping', () => { app.env.IGNITE_YEAR_PRICE = app.env.EMBER_YEAR_PRICE }],
    ['wrong checkout environment', session => { session.livemode = true }],
    ['unexpanded payment intent', session => { session.payment_intent = 'pi_AnnualSynthetic' }],
    ['unsuccessful payment intent', session => { session.payment_intent.status = 'processing' }],
    ['wrong payment intent environment', session => { session.payment_intent.livemode = true }],
    ['unexpanded charge', session => { session.payment_intent.latest_charge = 'ch_AnnualSynthetic' }],
    ['unpaid charge', session => { session.payment_intent.latest_charge.paid = false }],
    ['failed charge', session => { session.payment_intent.latest_charge.status = 'failed' }],
    ['uncaptured charge', session => { session.payment_intent.latest_charge.captured = false }],
    ['wrong charge environment', session => { session.payment_intent.latest_charge.livemode = true }],
    ['wrong payment intent reference', session => { session.payment_intent.latest_charge.payment_intent = 'pi_Foreign' }],
    ['wrong payment intent customer', session => { session.payment_intent.customer = 'cus_Foreign' }],
    ['wrong charge customer', session => { session.payment_intent.latest_charge.customer = 'cus_Foreign' }],
    ['different amount received', session => { session.payment_intent.amount_received -= 1 }],
    ['different captured charge amount', session => { session.payment_intent.latest_charge.amount_captured -= 1 }],
    ['different charge currency', session => { session.payment_intent.latest_charge.currency = 'eur' }],
    ['zero payment', session => { session.amount_total = 0; session.payment_intent.amount = 0; session.payment_intent.amount_received = 0; session.payment_intent.latest_charge.amount = 0; session.payment_intent.latest_charge.amount_captured = 0 }],
    ['invalid successful event timestamp', () => { app.state.successAt = 0 }],
  ]
  for (const [label, mutate] of invalid) {
    app.state.session = annualSession(); app.state.priceOverrides = {}; app.state.successAt = seconds('2024-02-29T16:45:30Z'); app.env.IGNITE_YEAR_PRICE = 'price_AnnualIgnite'
    mutate(app.state.session)
    await assert.rejects(app.fulfill(), undefined, label)
    assert.equal(app.state.calls.length, 0, `${label} must fail before any RPC.`)
  }
  assert.equal((await app.db.query('select count(*)::integer n from public.checkout_purchases')).rows[0].n, 0)
})

test('actual webhook, verification and fulfillment replays preserve annual expiry and one durable invitation', async t => {
  const app = await fixture(); t.after(app.close)
  assert.equal((await app.webhook('evt_AnnualFirst')).status, 200)
  assert.equal(app.state.emails.length, 1)
  const pending = await app.snapshot()
  assert.equal(iso(pending[0].billing.current_period_end), '2025-02-28T16:45:30.000Z')
  assert.equal(pending[0].profile.auth_user_id, null)
  assert.equal(pending[0].profile.access, false)
  assert.equal((await app.webhook('evt_AnnualFirst')).status, 200)
  assert.equal((await app.webhook('evt_AnnualAsync', 'checkout.session.async_payment_succeeded')).status, 200)
  assert.equal((await app.fulfill()).replayed, true)
  assert.deepEqual(await app.snapshot(), pending)
  assert.equal(app.state.emails.length, 1)
  assert.equal(app.state.emails[0].options.idempotencyKey, 'purchase-login:cs_test_AnnualSynthetic')
  app.state.user = { id: owner, email: 'receipt@synthetic.invalid', email_confirmed_at: '2024-01-01T00:00:00Z' }
  assert.match(text(await app.verify()), /Your purchase is connected to your private login/)
  const claimed = await app.snapshot()
  const ownerBilling = claimed.find(row => row.profile.client_id === 'ANNUAL-OWNER')
  assert.equal(ownerBilling.profile.auth_user_id, owner)
  assert.equal(iso(ownerBilling.billing.current_period_start), '2024-02-29T16:45:30.000Z')
  assert.equal(iso(ownerBilling.billing.current_period_end), '2025-02-28T16:45:30.000Z')
  assert.equal(ownerBilling.profile.access, false)
  assert.match(text(await app.verify()), /Your purchase is connected to your private login/)
  assert.equal((await app.webhook('evt_AnnualAfterClaim')).status, 200)
  assert.equal((await app.fulfill()).replayed, true)
  assert.deepEqual(await app.snapshot(), claimed)
  assert.equal(app.state.emails.length, 1)
  assert.equal((await app.db.query('select count(*)::integer n from public.checkout_purchases')).rows[0].n, 1)
  assert.equal((await app.db.query('select count(*)::integer n from public.purchase_invitation_outbox')).rows[0].n, 1)
  assert.equal((await app.db.query('select count(*)::integer n from public.client_invitations')).rows[0].n, 1)
  assert.equal((await app.db.query('select count(*)::integer n from public.membership_milestone_anchors')).rows[0].n, 0)
})

test('verified receipt claims require authenticated verification, respect persisted ownership and reject unconfirmed claim results', async t => {
  const app = await fixture(); t.after(app.close)
  app.state.session.metadata = { client_id: 'ANNUAL-OWNER', auth_user_id: owner }
  for (const user of [null,
    { id: owner, email: 'receipt@synthetic.invalid', email_confirmed_at: null },
    { id: owner, email: 'different@synthetic.invalid', email_confirmed_at: '2024-01-01T00:00:00Z' }]) {
    app.state.user = user
    assert.match(text(await app.verify()), /We could not open your account yet/)
    assert.equal(app.state.calls.length, 0, 'Receipt email text or metadata identity alone cannot claim a purchase.')
  }
  app.state.user = { id: owner, email: 'receipt@synthetic.invalid', email_confirmed_at: '2024-01-01T00:00:00Z' }
  await app.fulfill()
  const originalRpc = app.admin.rpc
  app.admin.rpc = async (name, args) => name === 'claim_checkout_purchase_v4'
    ? { data: { client_id: 'ANNUAL-OTHER', email: 'receipt@synthetic.invalid', program: 'ember', auth_user_id: other }, error: null }
    : originalRpc(name, args)
  assert.match(text(await app.verify()), /We could not open your account yet/, 'A mismatched claim reply is never confirmed.')
  app.admin.rpc = originalRpc
  assert.match(text(await app.verify()), /Your purchase is connected to your private login/)
  const claimed = await app.snapshot(), claimCount = app.state.calls.filter(call => call.name === 'claim_checkout_purchase_v4').length
  app.state.user = { id: other, email: 'receipt@synthetic.invalid', email_confirmed_at: '2024-01-01T00:00:00Z' }
  assert.match(text(await app.verify()), /We could not open your account yet/, 'A matching verified email cannot override another stored owner.')
  assert.equal(app.state.calls.filter(call => call.name === 'claim_checkout_purchase_v4').length, claimCount)
  assert.deepEqual(await app.snapshot(), claimed)
  app.state.user = { id: owner, email: 'changed@synthetic.invalid', email_confirmed_at: '2024-01-01T00:00:00Z' }
  assert.match(text(await app.verify()), /Your purchase is connected to your private login/, 'The stored owner may revisit after changing their verified email.')
  assert.deepEqual(await app.snapshot(), claimed)
})

test('an existing fulfilled ledger retains its historical grant instead of being rewritten by annual compatibility', async t => {
  const app = await fixture(); t.after(app.close)
  const paid = '2024-02-29T16:45:30.000Z', historicalEnd = '2024-03-29T16:45:30.000Z'
  const { error } = await app.admin.rpc('fulfill_checkout_purchase_v4', { p_purchase: {
    session_id: app.state.session.id, program: 'ember', email: 'receipt@synthetic.invalid', customer_id: 'cus_AnnualSynthetic',
    subscription_id: null, price_id: 'price_AnnualEmber', billing_type: 'payment', billing_status: 'paid_in_full', access_active: false,
    period_start: paid, period_end: historicalEnd, purchased_at: paid, livemode: false, membership_started_at: null, membership_paid: true,
  } })
  assert.equal(error, null)
  const before = await app.snapshot()
  assert.equal((await app.fulfill()).replayed, true)
  assert.deepEqual(await app.snapshot(), before)
  assert.equal(iso((await app.snapshot())[0].billing.current_period_end), historicalEnd)
  assert.equal((await app.db.query('select count(*)::integer n from public.purchase_invitation_outbox')).rows[0].n, 1)
})

test('an opaque modern purchase proof can open an unbound receipt without inventing authenticated ownership', async t => {
  const app = await fixture(); t.after(app.close)
  const proof = app.load('lib/commerce/purchaseProof.ts'), token = proof.createPurchaseProof()
  app.state.session.metadata = { program: 'ember', billing: 'annual', price_id: 'price_AnnualEmber',
    access_months: '120', purchase_proof_hash: proof.hashPurchaseProof(token) }
  app.state.cookies.set(proof.purchaseCookieName(app.state.session.id), token)
  assert.match(text(await app.verify()), /Your purchase is confirmed/)
  assert.equal(app.state.calls.filter(call => call.name === 'claim_checkout_purchase_v4').length, 0)
  assert.equal((await app.snapshot())[0].profile.auth_user_id, null)
  assert.equal(iso((await app.snapshot())[0].billing.current_period_end), '2025-02-28T16:45:30.000Z')
  assert.equal(app.state.emails.length, 1)
  const before = await app.snapshot()
  app.state.cookies.set(proof.purchaseCookieName(app.state.session.id), 'forged-proof')
  assert.match(text(await app.verify()), /We could not open your account yet/)
  assert.deepEqual(await app.snapshot(), before)
  assert.equal(app.state.emails.length, 1)
})

function successEvent(app, { id = 'evt_ConfirmedAnnualSuccess', type = 'checkout.session.completed', created = app.state.successAt, snapshot = app.state.session } = {}) {
  return { id, object: 'event', type, livemode: snapshot.livemode, created, data: { object: plain(snapshot) } }
}

test('annual delayed capture starts twelve months at matching immutable payment success, not earlier Checkout or Charge creation', async t => {
  const app = await fixture(); t.after(app.close)
  app.state.session.created = seconds('2024-02-26T09:00:00Z')
  app.state.session.payment_intent.latest_charge.created = seconds('2024-02-27T10:15:00Z')
  app.state.successAt = seconds('2024-02-29T16:45:30Z')
  const confirmed = successEvent(app)
  await app.fulfill(confirmed)
  const purchase = app.state.calls.find(call => call.name === 'fulfill_checkout_purchase_v4').args.p_purchase
  assert.equal(purchase.purchased_at, '2024-02-29T16:45:30.000Z')
  assert.equal(purchase.period_start, '2024-02-29T16:45:30.000Z')
  assert.equal(purchase.period_end, '2025-02-28T16:45:30.000Z')
  assert.equal(app.state.eventLookups.length, 0, 'Signed webhook evidence needs no historical event lookup.')
})

test('annual asynchronous payment ignores unpaid completion even when retrieval is now paid, then uses async success event time', async t => {
  const app = await fixture(); t.after(app.close)
  const unpaidSnapshot = plain(app.state.session)
  unpaidSnapshot.payment_status = 'unpaid'
  unpaidSnapshot.payment_intent.status = 'processing'
  app.state.event = successEvent(app, { id: 'evt_UnpaidCheckoutCompletion', created: seconds('2024-02-27T10:15:00Z'), snapshot: unpaidSnapshot })
  const route = app.load('app/api/webhooks/stripe/route.ts')
  const request = () => new Request('https://synthetic.invalid/api/webhooks/stripe', { method: 'POST', headers: { 'stripe-signature': 'synthetic-signature' }, body: '{}' })
  assert.equal((await route.POST(request())).status, 200)
  assert.equal(app.state.calls.length, 0, 'The unpaid event cannot grant from a newer retrieved paid state.')
  assert.equal(app.state.emails.length, 0)
  app.state.session.payment_intent.latest_charge.created = seconds('2024-02-27T10:15:00Z')
  app.state.successAt = seconds('2024-03-03T08:30:00Z')
  app.state.event = successEvent(app, { id: 'evt_AsyncPaymentSucceeded', type: 'checkout.session.async_payment_succeeded' })
  assert.equal((await route.POST(request())).status, 200)
  const purchase = app.state.calls.find(call => call.name === 'fulfill_checkout_purchase_v4').args.p_purchase
  assert.equal(purchase.period_start, '2024-03-03T08:30:00.000Z')
  assert.equal(purchase.period_end, '2025-03-03T08:30:00.000Z')
  assert.equal(app.state.emails.length, 1)
})

test('return-page-first uses matching provider success evidence and delayed webhook/retries retain the exact annual term and one invitation', async t => {
  const app = await fixture(); t.after(app.close)
  app.state.session.payment_intent.latest_charge.created = seconds('2024-02-27T10:15:00Z')
  app.state.successAt = seconds('2024-03-03T08:30:00Z')
  app.state.successEvents = [successEvent(app, { type: 'checkout.session.async_payment_succeeded' })]
  const proof = app.load('lib/commerce/purchaseProof.ts'), token = proof.createPurchaseProof()
  app.state.session.metadata = { program: 'ember', billing: 'annual', price_id: 'price_AnnualEmber', purchase_proof_hash: proof.hashPurchaseProof(token) }
  app.state.cookies.set(proof.purchaseCookieName(app.state.session.id), token)
  assert.match(text(await app.verify()), /Your purchase is confirmed/)
  assert.ok(app.state.eventLookups.length > 0)
  const original = await app.snapshot()
  assert.equal(iso(original[0].billing.current_period_start), '2024-03-03T08:30:00.000Z')
  assert.equal(iso(original[0].billing.current_period_end), '2025-03-03T08:30:00.000Z')
  const originalPurchase = plain((await app.db.query('select purchased_at from checkout_purchases')).rows)
  app.state.successEvents = [];app.state.eventLookupError = new Error('Historical provider event no longer recoverable')
  assert.equal((await app.webhook('evt_DelayedAsyncDelivery', 'checkout.session.async_payment_succeeded')).status, 200)
  assert.equal((await app.webhook('evt_DelayedAsyncDelivery', 'checkout.session.async_payment_succeeded')).status, 200)
  assert.match(text(await app.verify()), /Your purchase is confirmed/)
  assert.deepEqual(await app.snapshot(), original)
  assert.deepEqual(plain((await app.db.query('select purchased_at from checkout_purchases')).rows), originalPurchase)
  assert.equal(app.state.emails.length, 1)
})

test('missing or mismatched historical success evidence keeps an unpersisted annual receipt pending without guessed timing or invitations', async t => {
  const app = await fixture(); t.after(app.close)
  app.state.user = { id: owner, email: 'receipt@synthetic.invalid', email_confirmed_at: '2024-01-01T00:00:00Z' }
  for (const makeEvents of [
    () => [],
    () => [successEvent(app, { snapshot: { ...app.state.session, id: 'cs_test_ForeignReceipt' } })],
    () => [successEvent(app, { snapshot: { ...app.state.session, payment_status: 'unpaid' } })],
    () => [successEvent(app, { snapshot: { ...app.state.session, payment_intent: 'pi_ForeignPayment' } })],
    () => [successEvent(app, { created: 0 })],
    () => [successEvent(app, { type: 'checkout.session.expired' })],
    () => [successEvent(app, { snapshot: { ...app.state.session, livemode: true } })],
    () => [successEvent(app, { snapshot: { ...app.state.session, customer: 'cus_ForeignReceipt' } })],
    () => [successEvent(app), successEvent(app, { id: 'evt_AmbiguousAnnualSuccess', created: app.state.successAt + 86_400 })],
    () => Array.from({ length: 201 }, (_, index) => successEvent(app, { id: `evt_BoundedHistory${index}` })),
  ]) {
    app.state.successEvents = makeEvents()
    assert.match(text(await app.verify()), /We could not open your account yet/)
    assert.equal(app.state.calls.length, 0)
    assert.equal(app.state.emails.length, 0)
  }
  app.state.eventLookupError = new Error('Provider historical event retention exhausted')
  assert.match(text(await app.verify()), /We could not open your account yet/)
  assert.equal(app.state.calls.length, 0)
  assert.equal((await app.db.query('select count(*)::int n from checkout_purchases')).rows[0].n, 0)
})

test('fully refunded legacy payments fail before membership RPC or invitation, for flag or full refunded amount evidence', async t => {
  const app = await fixture(); t.after(app.close)
  for (const mutate of [charge => { charge.refunded = true }, charge => { charge.amount_refunded = charge.amount_captured }]) {
    app.state.session = annualSession()
    mutate(app.state.session.payment_intent.latest_charge)
    await assert.rejects(app.fulfill(successEvent(app)))
    assert.equal(app.state.calls.length, 0)
    assert.equal((await app.webhook('evt_FullRefundInitialGrant')).status, 500)
    assert.equal(app.state.calls.length, 0)
    assert.equal(app.state.emails.length, 0)
  }
  assert.equal((await app.db.query('select count(*)::int n from checkout_purchases')).rows[0].n, 0)
})

test('persisted annual history is reused after event retention and full refund without rewriting its original grant', async t => {
  const app = await fixture(); t.after(app.close)
  await app.fulfill(successEvent(app))
  const before = await app.snapshot()
  const ledger = plain((await app.db.query('select to_jsonb(p) receipt from checkout_purchases p')).rows)
  app.state.session.payment_intent.latest_charge.refunded = true
  app.state.session.payment_intent.latest_charge.amount_refunded = app.state.session.amount_total
  app.state.successEvents = [];app.state.eventLookupError = new Error('Old event unavailable')
  assert.equal((await app.fulfill()).replayed, true)
  assert.deepEqual(await app.snapshot(), before)
  assert.deepEqual(plain((await app.db.query('select to_jsonb(p) receipt from checkout_purchases p')).rows), ledger)
  assert.equal(app.state.calls.filter(call => call.name === 'fulfill_checkout_purchase_v4').length, 1, 'Existing receipt replay does not perform a fresh grant.')
})
