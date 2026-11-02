import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { PGlite } from '@electric-sql/pglite'

const require = createRequire(import.meta.url)
const owner = '11111111-1111-4111-8111-111111111111'
const foundationPath = 'supabase/migrations/20261101150000_launch_commerce_foundation.sql'
const foundation = readFileSync(foundationPath, 'utf8')
const plain = value => JSON.parse(JSON.stringify(value))
const purchase = patch => ({ session_id: 'cs_test_CutoverCurrent', program: 'ember', price_id: 'price_CutoverEmber',
  email: 'receipt@synthetic.invalid', customer_id: 'cus_Cutover', subscription_id: 'sub_Cutover',
  billing_type: 'subscription', billing_status: 'active', access_active: true, period_start: '2026-11-01T12:34:56Z',
  period_end: '2030-12-01T12:34:56Z', purchased_at: '2026-11-01T12:34:56Z', livemode: false, ...patch })
const state = patch => ({ program: 'ignite', price_id: 'price_CutoverIgnite', status: 'active', access: true,
  start: '2026-11-01T12:34:56Z', end: '2031-01-01T15:45:30Z', event_created: 100, cancelAtPeriodEnd: false, ...patch })

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
    insert into auth.users(id,email,email_confirmed_at) values('${owner}','receipt@synthetic.invalid',now());
    insert into clients(client_id,auth_user_id,email,login_email,program,timezone,access,active)
      values('CUTOVER-OWNER','${owner}','receipt@synthetic.invalid','receipt@synthetic.invalid','free','America/Chicago',true,true);`)
  for (const path of ['20261101145900_membership_exact_expiry.sql', '20261101150000_launch_commerce_foundation.sql',
    '20261101170500_subscription_reconciliation.sql', '20261101180000_membership_milestones.sql']) {
    await db.exec(readFileSync('supabase/migrations/' + path, 'utf8'))
  }
  await db.exec('set role service_role')
  const rpc = async (name, args) => (await db.query(`select public.${name}(${args.map((_, i) => `$${i + 1}`).join(',')}) result`, args)).rows[0].result
  const snapshot = async () => {
    const tables = ['clients', 'client_billing', 'checkout_purchases', 'purchase_invitation_outbox', 'client_invitations',
      'stripe_webhook_events', 'subscription_reconciliation_leases', 'membership_milestone_anchors', 'membership_milestones']
    return Object.fromEntries(await Promise.all(tables.map(async table => [table, plain((await db.query(
      `select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') rows from public.${table} t`)).rows[0].rows)])))
  }
  return { db, rpc, snapshot, close: () => db.close() }
}

function callbacks(app) {
  // These are the production old-shaped writer contracts injected into the
  // actual current callback shells. This is local catch/side-effect evidence,
  // not execution of the deployed old application or hosted acceptance.
  const trace = { calls: [], claims: 0, sends: 0, acknowledgments: 0 }
  const oldPurchase = purchase({ session_id: 'cs_test_CutoverOldCallback' });delete oldPurchase.price_id
  const oldState = state({ event_created: 200 });delete oldState.program;delete oldState.price_id
  const session = { id: oldPurchase.session_id, mode: 'payment', payment_status: 'paid', status: 'complete', livemode: false,
    customer_details: { email: 'receipt@synthetic.invalid' }, metadata: {}, subscription: null }
  const admin = {
    async rpc(name, args) {
      trace.calls.push(name)
      if (name.includes('claim_checkout_purchase')) trace.claims++
      try {
        const ordered = name === 'sync_member_subscription' ? [args.p_subscription_id, args.p_state] : [args.p_purchase]
        return { data: await app.rpc(name, ordered), error: null }
      } catch (error) { return { data: null, error } }
    },
    from(table) {
      const conditions = [], values = [];let columns = '*'
      return {
        select(value) { columns = value;return this },
        eq(key, value) { assert.match(key, /^[a-z_]+$/);values.push(value);conditions.push(`${key}=$${values.length}`);return this },
        async maybeSingle() {
          const rows = (await app.db.query(`select ${columns} from public.${table}${conditions.length ? ' where ' + conditions.join(' and ') : ''}`, values)).rows
          return { data: rows[0] || null, error: null }
        },
        async insert(row) {
          trace.acknowledgments++
          const keys = Object.keys(row)
          await app.db.query(`insert into public.${table}(${keys.join(',')}) values(${keys.map((_, i) => '$' + (i + 1)).join(',')})`, keys.map(key => row[key]))
          return { error: null }
        },
      }
    },
  }
  const oldWriters = {
    async fulfillPurchase() {
      const result = await admin.rpc('fulfill_checkout_purchase', { p_purchase: oldPurchase })
      if (result.error) throw result.error
      return result.data
    },
    async syncSubscription() {
      const result = await admin.rpc('sync_member_subscription', { p_subscription_id: 'sub_Cutover', p_state: oldState })
      if (result.error) throw result.error
      return result.data
    },
    async reconcileSubscription() { assert.fail('No reconciliation is required for an unacknowledged first event.') },
  }
  const env = { STRIPE_SECRET_KEY: 'sk_test_synthetic', STRIPE_WEBHOOK_SECRET: 'whsec_synthetic' }
  const mocks = {
    stripe: { __esModule: true, default: class Stripe {
      webhooks = { constructEvent: input => JSON.parse(input) }
      checkout = { sessions: { retrieve: async () => session } }
    } },
    'next/server': { NextResponse: { json: (value, init) => Response.json(value, init) } },
    'next/headers': { cookies: async () => ({ get: () => undefined, toString: () => '' }) },
    'next/link': { __esModule: true, default: 'a' },
    '@/lib/supabase/admin': { createAdminClient: () => admin },
    '@/lib/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: {
      id: owner, email: 'receipt@synthetic.invalid', email_confirmed_at: '2026-01-01T00:00:00Z',
    } } }) } }) },
    '@/lib/commerce/environment': { paymentEnvironmentError: () => null },
    '@/lib/commerce/fulfillment': oldWriters,
    '@/lib/commerce/invitationDelivery': { deliverPurchaseInvitation: async () => { trace.sends++;return true } },
    '@/lib/commerce/purchaseProof': { purchaseCookieName: () => 'synthetic', verifyPurchaseProof: () => false },
    '@/lib/analytics/checkoutContext': { bindAnalyticsOwner: async () => {} },
    '../styles/globalstyles': {},
  }
  const load = path => {
    const module = { exports: {} }
    const source = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText
    runInNewContext(source, { module, exports: module.exports, process: { env }, Buffer, Date, URL, Request, Response,
      console: { error() {} }, require: name => mocks[name] ?? require(name) }, { filename: path })
    return module.exports
  }
  const route = load('app/api/webhooks/stripe/route.ts')
  const webhook = async (id, type, object) => route.POST(new Request('https://synthetic.invalid/api/webhooks/stripe', {
    method: 'POST', headers: { 'stripe-signature': 'synthetic-signature' }, body: JSON.stringify({ id, type, livemode: false, created: 100,
      data: { object } }),
  }))
  return { trace,
    checkout: () => webhook('evt_CutoverCheckout', 'checkout.session.completed', session),
    subscription: () => webhook('evt_CutoverSubscription', 'customer.subscription.updated', { id: 'sub_Cutover' }),
    verify: () => load('app/verified/page.tsx').default({ searchParams: Promise.resolve({ session_id: session.id }) }),
  }
}

function text(node) {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(text).join(' ')
  return node && typeof node === 'object' ? text(node.props?.children) : ''
}

test('prepared cutover guards reject outdated writers before mutation and preserve current commerce contracts', async t => {
  const app = await fixture();t.after(app.close)
  const first = await app.rpc('fulfill_checkout_purchase_v4', [purchase()])

  await t.test('old fulfillment, NULL and malformed prices cannot mutate or bypass the guard through replay', async () => {
    const before = await app.snapshot()
    const bad = [null, 'null', '{}', '[]', 'true', '"price_Synthetic"',
      ...[undefined, null, '', 'price_', 'price_bad-value', ' price_Synthetic', 'PRICE_Synthetic', 123, {}, []].map(price_id => JSON.stringify(purchase({ price_id }))),
      JSON.stringify(purchase({ session_id: 'cs_test_NewOldPayload', price_id: undefined })),
    ]
    for (const input of bad) {
      await assert.rejects(app.db.query('select public.fulfill_checkout_purchase($1::jsonb)', [input]), error => error.code === '22023')
      assert.deepEqual(await app.snapshot(), before)
    }
    const body = foundation.slice(foundation.indexOf('create or replace function public.fulfill_checkout_purchase('), foundation.indexOf('revoke execute on function public.fulfill_checkout_purchase'))
    assert.ok(body.indexOf("p_purchase->'price_id'") < body.indexOf('pg_advisory_xact_lock'), 'Price validation precedes advisory locking and replay lookup.')
  })

  await t.test('old subscription snapshots, NULL and invalid mapped tiers/prices throw before v3 changes access or revision', async () => {
    const before = await app.snapshot()
    const legacy = state();delete legacy.program;delete legacy.price_id
    const bad = [null, 'null', '{}', '[]', 'true', JSON.stringify(legacy),
      ...[undefined, null, '', 'free', 'unknown', 'EMBER', 123, {}, []].map(program => JSON.stringify(state({ program }))),
      ...[undefined, null, '', 'price_', 'price_bad-value', ' price_Synthetic', 123, {}, []].map(price_id => JSON.stringify(state({ price_id }))),
    ]
    for (const input of bad) {
      await assert.rejects(app.db.query('select public.sync_member_subscription($1,$2::jsonb)', ['sub_Cutover', input]), error => error.code === '22023')
      assert.deepEqual(await app.snapshot(), before)
    }
  })

  await t.test('callback shells return retryable failure without acknowledgment, claim or email for old-shaped SQL writers', async () => {
    const before = await app.snapshot(), handlers = callbacks(app)
    assert.equal((await handlers.checkout()).status, 500)
    assert.equal((await handlers.subscription()).status, 500)
    assert.match(text(await handlers.verify()), /We could not open your account yet/)
    assert.deepEqual(handlers.trace.calls, ['fulfill_checkout_purchase', 'sync_member_subscription', 'fulfill_checkout_purchase'])
    assert.equal(handlers.trace.acknowledgments, 0);assert.equal(handlers.trace.claims, 0);assert.equal(handlers.trace.sends, 0)
    assert.deepEqual(await app.snapshot(), before)
  })

  await t.test('new direct v3, mapped legacy wrapper and v4 annual purchase/replay retain their existing semantics', async () => {
    const accepted = await app.rpc('sync_member_subscription_v3', ['sub_Cutover', state()])
    assert.equal(accepted.accepted, true)
    const synced = (await app.db.query('select c.program,c.access,c.membership_expires_at,b.subscription_sync_revision from clients c join client_billing b using(client_id) where c.client_id=$1', [first.client_id])).rows[0]
    assert.equal(synced.program, 'ignite');assert.equal(synced.access, true);assert.equal(synced.subscription_sync_revision, 1)
    assert.equal(new Date(synced.membership_expires_at).toISOString(), '2031-01-01T15:45:30.000Z')
    await app.rpc('sync_member_subscription', ['sub_Cutover', state({ program: 'phoenix', price_id: 'price_CutoverPhoenix', event_created: 101 })])
    assert.equal((await app.db.query('select program from clients where client_id=$1', [first.client_id])).rows[0].program, 'phoenix')
    const annual = purchase({ session_id: 'cs_test_CutoverAnnual', program: 'ember', price_id: 'price_CutoverAnnual', subscription_id: null,
      billing_type: 'payment', billing_status: 'paid_in_full', period_start: '2024-02-29T16:45:30Z', purchased_at: '2024-02-29T16:45:30Z', period_end: '2025-02-28T16:45:30Z', access_active: false })
    const saved = await app.rpc('fulfill_checkout_purchase_v4', [annual]);assert.equal(saved.replayed, false)
    const beforeReplay = await app.snapshot()
    assert.equal((await app.rpc('fulfill_checkout_purchase_v4', [annual])).replayed, true)
    assert.deepEqual(await app.snapshot(), beforeReplay)
    const bill = (await app.db.query('select billing_type,billing_status,current_period_start,current_period_end,stripe_price_id from client_billing where client_id=$1', [saved.client_id])).rows[0]
    assert.equal(bill.billing_type, 'payment');assert.equal(bill.billing_status, 'paid_in_full');assert.equal(bill.stripe_price_id, annual.price_id)
    assert.equal(new Date(bill.current_period_start).toISOString(), '2024-02-29T16:45:30.000Z')
    assert.equal(new Date(bill.current_period_end).toISOString(), '2025-02-28T16:45:30.000Z')
  })

  await t.test('contract readiness and exact callable signatures/grants/SECURITY INVOKER boundaries stay unchanged', async () => {
    assert.equal(await app.rpc('commerce_configuration_ready', [2]), false)
    assert.equal(await app.rpc('commerce_configuration_ready', [4]), true)
    for (const [signature, result] of [
      ['public.fulfill_checkout_purchase(jsonb)', 'jsonb'], ['public.sync_member_subscription(text,jsonb)', 'void'],
      ['public.sync_member_subscription_v3(text,jsonb)', 'jsonb'], ['public.fulfill_checkout_purchase_v4(jsonb)', 'jsonb'],
      ['public.claim_checkout_purchase_v4(text,uuid,text)', 'jsonb'],
    ]) {
      const row = (await app.db.query(`select pg_get_function_result(p.oid) result,p.prosecdef,
        has_function_privilege('service_role',p.oid,'execute') service,
        has_function_privilege('authenticated',p.oid,'execute') member,has_function_privilege('anon',p.oid,'execute') anon
        from pg_proc p where p.oid=$1::regprocedure`, [signature])).rows[0]
      assert.deepEqual(row, { result, prosecdef: false, service: true, member: false, anon: false }, signature)
    }
  })
})
