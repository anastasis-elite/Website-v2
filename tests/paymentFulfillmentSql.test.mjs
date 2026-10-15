import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { PGlite } from '@electric-sql/pglite'

const migration = readFileSync('supabase/migrations/20261012174637_secure_checkout_fulfillment_and_billing.sql', 'utf8')
const owner = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'
const unconfirmed = '33333333-3333-4333-8333-333333333333'

async function fixture(run) {
  const db = new PGlite()
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated,service_role; grant select on auth.users to service_role;
      grant execute on function auth.uid() to authenticated,service_role;
      create table public.clients(client_id text primary key,auth_user_id uuid,email text,login_email text,full_name text,program text,
        onboarding_completed boolean,verified_purchase boolean,access boolean,active boolean,subscription_status text,
        subscription_started_at timestamptz,subscription_ends_at timestamptz,updated_at timestamptz,city text);
      create table public.client_billing(client_id text references clients(client_id),stripe_customer_id text check(stripe_customer_id<>'cus_failure'),
        stripe_subscription_id text,billing_type text,billing_status text,current_period_start timestamptz,current_period_end timestamptz,
        last_payment_date timestamptz,next_payment_date timestamptz,access_active boolean,cancel_at_period_end boolean,updated_at timestamptz);
      create table public.saved_progress(client_id text references clients(client_id),record jsonb);
      create table public.client_invitations(id uuid primary key default gen_random_uuid(),client_id text references clients(client_id),email text,token_hash text,expires_at timestamptz,consumed_at timestamptz);
      alter table clients enable row level security;
      create policy owner_profile on clients for all to authenticated using(auth_user_id=auth.uid()) with check(auth_user_id=auth.uid());
      alter table client_billing enable row level security;
      create policy owner_billing on client_billing for select to authenticated using(exists(select 1 from clients c where c.client_id=client_billing.client_id and c.auth_user_id=auth.uid()));
      grant all on clients,client_billing,saved_progress to service_role;
      grant select,insert,update on clients to authenticated; grant select on client_billing to authenticated;`)
    await db.query('insert into auth.users values($1,$4,now()),($2,$5,now()),($3,$4,null)', [owner, other, unconfirmed, 'ember.qa@example.test', 'other.qa@example.test'])
    await db.exec(migration)
    await run(db)
  } finally { await db.close() }
}

function purchase(sessionId = 'cs_test_sql_qa', overrides = {}) {
  return { session_id: sessionId, email: 'ember.qa@example.test', full_name: 'Isolated Ember QA', program: 'ember',
    bound_client_id: null, bound_user_id: null, customer_id: 'cus_sql_qa', subscription_id: null,
    billing_type: 'payment', billing_status: 'paid_in_full', access_active: true,
    period_start: '2098-01-01T00:00:00Z', period_end: '2099-01-01T00:00:00Z',
    purchased_at: '2098-01-01T00:00:00Z', cancel_at_period_end: false, livemode: false, ...overrides }
}
async function fulfill(db, payload) {
  return (await db.query('select fulfill_checkout_purchase($1::jsonb) as result', [JSON.stringify(payload)])).rows[0].result
}
async function claim(db, sessionId, userId) {
  return (await db.query('select claim_checkout_purchase($1,$2::uuid) as result', [sessionId, userId])).rows[0].result
}
async function sync(db, subscriptionId, state = {}) {
  await db.query('select sync_member_subscription($1,$2::jsonb)', [subscriptionId, JSON.stringify({ status: 'active', access: true, start: '2098-01-01T00:00:00Z', end: '2099-01-01T00:00:00Z', event_created: 100, cancelAtPeriodEnd: false, ...state })])
}
async function addExisting(db, clientId = 'QA-EXISTING') {
  await db.query(`insert into clients(client_id,auth_user_id,email,login_email,full_name,program,onboarding_completed,verified_purchase,access,active,city)
    values($1,$2,'ember.qa@example.test','ember.qa@example.test','Saved Member','ignite',true,true,false,false,'Chicago')`, [clientId, owner])
  await db.query('insert into saved_progress values($1,$2::jsonb)', [clientId, JSON.stringify({ historical_workout: true, added_load: 0 })])
}

test('shipped payment SQL atomically rolls back failed activation and makes concurrent retries stable', () => fixture(async db => {
  await db.exec('set role service_role')
  await assert.rejects(fulfill(db, purchase('cs_test_failure', { customer_id: 'cus_failure' })), /check constraint/)
  assert.equal((await db.query('select count(*)::int as n from clients')).rows[0].n, 0)
  assert.equal((await db.query('select count(*)::int as n from checkout_purchases')).rows[0].n, 0)
  const payload = purchase('cs_test_failure')
  const results = await Promise.all([fulfill(db, payload), fulfill(db, payload), fulfill(db, payload)])
  assert.equal(new Set(results.map(result => result.client_id)).size, 1)
  assert.equal(results.filter(result => !result.replayed).length, 1)
  assert.equal((await db.query('select count(*)::int as n from clients')).rows[0].n, 1)
  assert.equal((await db.query('select count(*)::int as n from checkout_purchases')).rows[0].n, 1)
  const original = (await db.query('select current_period_end,last_checkout_created_at from client_billing')).rows[0]
  assert.equal((await fulfill(db, purchase('cs_test_failure', { period_end: '2105-01-01T00:00:00Z', program: 'phoenix' }))).replayed, true)
  assert.deepEqual((await db.query('select current_period_end,last_checkout_created_at from client_billing')).rows[0], original)
  assert.equal((await db.query('select program from clients')).rows[0].program, 'ember')
}))

test('guest email cannot overwrite saved member; verified returning claim preserves history and is replay safe', () => fixture(async db => {
  await addExisting(db)
  await db.exec('set role service_role')
  const pending = await fulfill(db, purchase('cs_test_returning'))
  assert.notEqual(pending.client_id, 'QA-EXISTING')
  assert.equal((await db.query("select program from clients where client_id='QA-EXISTING'")).rows[0].program, 'ignite')
  await assert.rejects(claim(db, 'cs_test_returning', other), /verified login/)
  await assert.rejects(claim(db, 'cs_test_returning', unconfirmed), /verified login/)
  assert.equal((await db.query("select client_id from checkout_purchases where session_id='cs_test_returning'")).rows[0].client_id, pending.client_id)
  const result = await claim(db, 'cs_test_returning', owner)
  assert.equal(result.client_id, 'QA-EXISTING'); assert.equal(result.auth_user_id, owner)
  const target = (await db.query("select program,onboarding_completed,full_name,city,access from clients where client_id='QA-EXISTING'")).rows[0]
  assert.deepEqual(target, { program: 'ember', onboarding_completed: true, full_name: 'Saved Member', city: 'Chicago', access: true })
  assert.deepEqual((await db.query("select record from saved_progress where client_id='QA-EXISTING'")).rows[0].record, { historical_workout: true, added_load: 0 })
  assert.deepEqual((await db.query('select stripe_customer_id,stripe_subscription_id,access_active from client_billing where client_id=$1', [pending.client_id])).rows[0], { stripe_customer_id: null, stripe_subscription_id: null, access_active: false })
  assert.equal((await db.query('select access from clients where client_id=$1', [pending.client_id])).rows[0].access, false)
  assert.deepEqual(await claim(db, 'cs_test_returning', owner), result)
  assert.equal((await fulfill(db, purchase('cs_test_returning'))).client_id, 'QA-EXISTING')
}))

test('new member claim binds only a confirmed receipt owner and rejects a later different login', () => fixture(async db => {
  await db.exec('set role service_role')
  const pending = await fulfill(db, purchase('cs_test_new_member'))
  await assert.rejects(claim(db, 'cs_test_new_member', unconfirmed), /verified login/)
  const claimed = await claim(db, 'cs_test_new_member', owner)
  assert.equal(claimed.client_id, pending.client_id)
  assert.equal((await db.query('select login_email,onboarding_completed from clients where client_id=$1', [pending.client_id])).rows[0].onboarding_completed, false)
  await db.exec('reset role')
  await db.query('update auth.users set email=$1 where id=$2', ['ember.qa@example.test', other])
  await db.exec('set role service_role')
  await assert.rejects(claim(db, 'cs_test_new_member', other), /another login/)
}))

test('failed returning claim rolls back entitlement transfer and ledger ownership before a safe retry', () => fixture(async db => {
  await addExisting(db)
  await db.exec('set role service_role')
  const pending = await fulfill(db, purchase('cs_test_claim_failure'))
  await db.exec('reset role')
  // Inject a database failure on the destination billing write, after the
  // function has begun changing the saved member's entitlement.
  await db.exec("alter table client_billing add constraint qa_claim_failure check(not(client_id='QA-EXISTING' and stripe_customer_id='cus_sql_qa')) not valid")
  await db.exec('set role service_role')
  await assert.rejects(claim(db, 'cs_test_claim_failure', owner), /qa_claim_failure/)
  assert.deepEqual((await db.query("select program,access,onboarding_completed from clients where client_id='QA-EXISTING'")).rows[0], { program: 'ignite', access: false, onboarding_completed: true })
  assert.equal((await db.query("select client_id from checkout_purchases where session_id='cs_test_claim_failure'")).rows[0].client_id, pending.client_id)
  assert.equal((await db.query('select access from clients where client_id=$1', [pending.client_id])).rows[0].access, true)
  assert.equal((await db.query("select count(*)::int as n from client_billing where client_id='QA-EXISTING'")).rows[0].n, 0)
  await db.exec('reset role; alter table client_billing drop constraint qa_claim_failure; set role service_role')
  assert.equal((await claim(db, 'cs_test_claim_failure', owner)).client_id, 'QA-EXISTING')
}))

test('bound purchase checks actual owner; old checkout cannot replace newer tier, period or billing identity', () => fixture(async db => {
  await addExisting(db)
  await db.exec('set role service_role')
  await assert.rejects(fulfill(db, purchase('cs_test_wrong_owner', { bound_client_id: 'QA-EXISTING', bound_user_id: other })), /owner does not match/)
  assert.equal((await db.query('select count(*)::int as n from checkout_purchases')).rows[0].n, 0)
  const binding = { bound_client_id: 'QA-EXISTING', bound_user_id: owner }
  await fulfill(db, purchase('cs_test_newer', { ...binding, program: 'phoenix', customer_id: 'cus_newer', purchased_at: '2098-03-01T00:00:00Z', period_end: '2100-03-01T00:00:00Z' }))
  await fulfill(db, purchase('cs_test_older', binding))
  assert.equal((await db.query("select program from clients where client_id='QA-EXISTING'")).rows[0].program, 'phoenix')
  const billing = (await db.query("select stripe_customer_id,current_period_end from client_billing where client_id='QA-EXISTING'")).rows[0]
  assert.equal(billing.stripe_customer_id, 'cus_newer'); assert.equal(new Date(billing.current_period_end).toISOString(), '2100-03-01T00:00:00.000Z')
  assert.equal((await db.query('select count(*)::int as n from checkout_purchases')).rows[0].n, 2)
}))

test('subscription webhooks reject stale state and terminal resurrection while allowing a new paid subscription', () => fixture(async db => {
  await addExisting(db)
  await db.exec('set role service_role')
  const binding = { bound_client_id: 'QA-EXISTING', bound_user_id: owner, billing_type: 'subscription', billing_status: 'active', subscription_id: 'sub_qa_old' }
  await fulfill(db, purchase('cs_test_subscription', binding))
  await sync(db, 'sub_qa_old', { status: 'past_due', access: false, event_created: 200 })
  await sync(db, 'sub_qa_old', { status: 'active', access: true, event_created: 199 })
  assert.equal((await db.query("select access,subscription_status from clients where client_id='QA-EXISTING'")).rows[0].subscription_status, 'past_due')
  await sync(db, 'sub_qa_old', { status: 'canceled', access: false, event_created: 201 })
  for (const event_created of [200, 201, 202]) await sync(db, 'sub_qa_old', { event_created })
  assert.deepEqual((await db.query("select access,active,subscription_status from clients where client_id='QA-EXISTING'")).rows[0], { access: false, active: false, subscription_status: 'canceled' })
  await fulfill(db, purchase('cs_test_replacement', { ...binding, subscription_id: 'sub_qa_new', purchased_at: '2098-02-01T00:00:00Z' }))
  await sync(db, 'sub_qa_old', { status: 'canceled', access: false, event_created: 999 })
  assert.equal((await db.query("select access from clients where client_id='QA-EXISTING'")).rows[0].access, true)
  await sync(db, 'sub_qa_new', { end: '2000-01-01T00:00:00Z', event_created: 203 })
  assert.equal((await db.query("select access from clients where client_id='QA-EXISTING'")).rows[0].access, false)
  await sync(db, 'sub_unknown_qa', { event_created: 9999 })
  assert.equal((await db.query('select count(*)::int as n from clients')).rows[0].n, 1)
}))

test('a second recurring purchase cannot hide existing billing during fulfillment or a returning claim', () => fixture(async db => {
  await addExisting(db)
  await db.exec('set role service_role')
  const binding = { bound_client_id: 'QA-EXISTING', bound_user_id: owner, billing_type: 'subscription', billing_status: 'active', subscription_id: 'sub_existing', customer_id: 'cus_existing' }
  await fulfill(db, purchase('cs_test_existing_sub', binding))
  for (const [suffix, purchased_at] of [['newer', '2098-03-01T00:00:00Z'], ['older', '2097-12-01T00:00:00Z'], ['equal', '2098-01-01T00:00:00Z']]) {
    const sessionId = 'cs_test_racing_second_sub_' + suffix
    await assert.rejects(fulfill(db, purchase(sessionId, { ...binding, subscription_id: 'sub_second', customer_id: 'cus_second', purchased_at })), /recurring subscription.*support/)
    assert.equal((await db.query('select count(*)::int as n from checkout_purchases where session_id=$1', [sessionId])).rows[0].n, 0)
  }
  const pending = await fulfill(db, purchase('cs_test_guest_second_sub', { billing_type: 'subscription', billing_status: 'active', subscription_id: 'sub_guest_second', customer_id: 'cus_guest_second', purchased_at: '2098-03-01T00:00:00Z' }))
  await assert.rejects(claim(db, 'cs_test_guest_second_sub', owner), /recurring subscription.*support/)
  const ownedBilling = (await db.query("select stripe_customer_id,stripe_subscription_id from client_billing where client_id='QA-EXISTING'")).rows[0]
  assert.deepEqual(ownedBilling, { stripe_customer_id: 'cus_existing', stripe_subscription_id: 'sub_existing' })
  const pendingBilling = (await db.query('select stripe_customer_id,stripe_subscription_id from client_billing where client_id=$1', [pending.client_id])).rows[0]
  assert.deepEqual(pendingBilling, { stripe_customer_id: 'cus_guest_second', stripe_subscription_id: 'sub_guest_second' })
  assert.equal((await db.query("select client_id from checkout_purchases where session_id='cs_test_guest_second_sub'")).rows[0].client_id, pending.client_id)
  await sync(db, 'sub_existing', { status: 'canceled', access: false })
  assert.equal((await claim(db, 'cs_test_guest_second_sub', owner)).client_id, 'QA-EXISTING')
  assert.equal((await db.query("select stripe_subscription_id from client_billing where client_id='QA-EXISTING'")).rows[0].stripe_subscription_id, 'sub_guest_second')
}))

test('an older active recurring purchase cannot disappear behind a newer one-time purchase', () => fixture(async db => {
  await addExisting(db)
  await db.exec('set role service_role')
  await fulfill(db, purchase('cs_test_newer_one_time', { bound_client_id: 'QA-EXISTING', bound_user_id: owner, customer_id: 'cus_one_time', purchased_at: '2098-04-01T00:00:00Z' }))
  const recurring = { billing_type: 'subscription', billing_status: 'active', subscription_id: 'sub_older_still_billing', customer_id: 'cus_older_still_billing' }
  await assert.rejects(fulfill(db, purchase('cs_test_older_bound_recurring', { ...recurring, bound_client_id: 'QA-EXISTING', bound_user_id: owner })), /Older recurring purchase requires support/)
  const pending = await fulfill(db, purchase('cs_test_older_guest_recurring', recurring))
  await assert.rejects(claim(db, 'cs_test_older_guest_recurring', owner), /Older recurring purchase requires support/)
  assert.equal((await db.query("select stripe_customer_id from client_billing where client_id='QA-EXISTING'")).rows[0].stripe_customer_id, 'cus_one_time')
  assert.equal((await db.query('select stripe_customer_id,stripe_subscription_id from client_billing where client_id=$1', [pending.client_id])).rows[0].stripe_subscription_id, 'sub_older_still_billing')
  assert.equal((await db.query("select client_id from checkout_purchases where session_id='cs_test_older_guest_recurring'")).rows[0].client_id, pending.client_id)
  await sync(db, 'sub_older_still_billing', { status: 'canceled', access: false })
  assert.equal((await claim(db, 'cs_test_older_guest_recurring', owner)).client_id, 'QA-EXISTING')
  assert.equal((await db.query("select stripe_customer_id from client_billing where client_id='QA-EXISTING'")).rows[0].stripe_customer_id, 'cus_one_time')
}))

test('browser cannot call payment RPCs, inspect ledgers or change entitlement fields; owned profile and billing reads remain usable', () => fixture(async db => {
  await addExisting(db)
  await db.exec('set role service_role')
  await fulfill(db, purchase('cs_test_permissions', { bound_client_id: 'QA-EXISTING', bound_user_id: owner }))
  await db.exec(`set role authenticated; set request.jwt.claim.sub='${owner}'`)
  await db.query("update clients set city='Austin' where client_id='QA-EXISTING'")
  assert.equal((await db.query("select city from clients where client_id='QA-EXISTING'")).rows[0].city, 'Austin')
  const changes = { client_id: 'QA-STOLEN', auth_user_id: other, email: 'other@example.test', login_email: 'other@example.test', program: 'phoenix', verified_purchase: false, access: false, active: false, subscription_status: 'gifted', subscription_started_at: '2000-01-01T00:00:00Z', subscription_ends_at: '2100-01-01T00:00:00Z' }
  for (const [field, value] of Object.entries(changes)) await assert.rejects(db.query(`update clients set ${field}=$1 where client_id='QA-EXISTING'`, [value]), /cannot be changed from the browser/)
  await assert.rejects(db.query('insert into clients(client_id,auth_user_id,program,access) values($1,$2,$3,true)', ['QA-FORGED', owner, 'phoenix']), /provisioned by the server/)
  for (const relation of ['checkout_purchases', 'stripe_webhook_events']) await assert.rejects(db.query(`select * from ${relation}`), /permission denied/)
  await assert.rejects(fulfill(db, purchase('cs_test_forged_rpc')), /permission denied for function/)
  await assert.rejects(claim(db, 'cs_test_permissions', owner), /permission denied for function/)
  await assert.rejects(sync(db, 'sub_forged'), /permission denied for function/)
  await assert.rejects(db.query("update client_billing set stripe_customer_id='cus_foreign'"), /permission denied/)
  assert.equal((await db.query('select stripe_customer_id from client_billing')).rows[0].stripe_customer_id, 'cus_sql_qa')
  await db.exec(`set request.jwt.claim.sub='${other}'`)
  assert.equal((await db.query('select * from client_billing')).rows.length, 0)
  await db.exec('set role anon')
  await assert.rejects(fulfill(db, purchase('cs_test_anon_rpc')), /permission denied for function/)
  await assert.rejects(db.query('select * from checkout_purchases'), /permission denied/)
}))

test('billing tamper trigger survives historical permissive browser grants and policies', () => fixture(async db => {
  await addExisting(db)
  await db.exec('set role service_role')
  await fulfill(db, purchase('cs_test_billing_tamper', { bound_client_id: 'QA-EXISTING', bound_user_id: owner }))
  await db.exec(`reset role; grant insert,update,delete on client_billing to authenticated;
    create policy historical_broad_billing on client_billing for all to authenticated using(true) with check(true);
    set role authenticated; set request.jwt.claim.sub='${owner}'`)
  await assert.rejects(db.query("update client_billing set stripe_customer_id='cus_victim' where client_id='QA-EXISTING'"), /can only be changed by the server/)
  await assert.rejects(db.query("delete from client_billing where client_id='QA-EXISTING'"), /can only be changed by the server/)
  await assert.rejects(db.query("insert into client_billing(client_id,stripe_customer_id) values('QA-EXISTING','cus_victim')"), /can only be changed by the server/)
  assert.equal((await db.query("select stripe_customer_id from client_billing where client_id='QA-EXISTING'")).rows[0].stripe_customer_id, 'cus_sql_qa')
}))
