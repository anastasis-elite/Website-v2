import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'

const migration = readFileSync('supabase/migrations/20261101150000_launch_commerce_foundation.sql', 'utf8')
const owner = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'
const hash = value => createHash('sha256').update(value).digest('hex')

async function fixture() {
  const db = new PGlite()
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key,email text);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated,service_role;
    grant execute on function auth.uid() to anon,authenticated,service_role;
    create table clients(client_id text primary key,email text,full_name text,program text,auth_user_id uuid,login_email text,
      onboarding_completed boolean default false,verified_purchase boolean default false,access boolean default false,active boolean default false,
      subscription_status text,subscription_started_at timestamptz,subscription_ends_at timestamptz,updated_at timestamptz default now());
    create table client_billing(client_id text primary key references clients(client_id),stripe_customer_id text,stripe_subscription_id text,
      billing_type text,billing_status text,current_period_start timestamptz,current_period_end timestamptz,last_payment_date timestamptz,
      next_payment_date timestamptz,access_active boolean default false,cancel_at_period_end boolean default false,updated_at timestamptz default now());
    grant select,insert,update,delete on clients to service_role;
    grant select on clients to authenticated;
    alter table clients enable row level security;
    create policy owned_client_read on clients for select to authenticated using(auth_user_id=(select auth.uid()));
    insert into clients(client_id,email,program,auth_user_id,access,active) values
      ('OWNED','owner@synthetic.invalid','ember','${owner}',true,true),('FOREIGN','other@synthetic.invalid','ignite','${other}',true,true);
  `)
  const before = (await db.query('select * from clients order by client_id')).rows
  await db.exec(migration)
  await db.exec(migration)
  const after = (await db.query('select * from clients order by client_id')).rows
  assert.ok(after.every(row => row.membership_expires_at === null), 'Legacy rows must not acquire fabricated exact expiry.')
  assert.deepEqual(after.map(({ membership_expires_at, ...legacy }) => legacy), before, 'Migration must not backfill or alter existing memberships.')
  return db
}
async function identity(db, role, id = '') {
  await db.exec('reset role')
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id])
  await db.exec(`set role ${role}`)
}
const purchase = patch => ({ session_id: 'cs_synthetic', program: 'ember', email: 'receipt@synthetic.invalid', customer_id: 'cus_synthetic', subscription_id: 'sub_synthetic',
  billing_type: 'subscription', billing_status: 'active', access_active: true, period_start: '2026-01-01T00:00:00Z', period_end: '2035-01-01T00:00:00Z',
  purchased_at: '2026-11-01T00:00:00Z', livemode: false, ...patch })
const state = patch => ({ program: 'ignite', price_id: 'price_igniteSynthetic', status: 'active', access: true, start: '2026-01-01T00:00:00Z', end: '2035-01-01T00:00:00Z', event_created: 100, cancelAtPeriodEnd: false, ...patch })
const rpc = async (db, name, args) => (await db.query(`select ${name}(${args.map((_, i) => `$${i + 1}`).join(',')}) result`, args)).rows[0].result

test('returning verified receipt owners keep their existing login without replacement invitations', async t => {
  const db = await fixture(); t.after(() => db.close())
  await identity(db, 'service_role')
  await rpc(db, 'fulfill_checkout_purchase', [purchase({ session_id: 'cs_returning', email: 'OWNER@synthetic.invalid' })])
  assert.equal(await rpc(db, 'claim_purchase_invitation', ['cs_returning', hash('returning'), new Date(Date.now() + 3600000).toISOString()]), null)
  assert.equal((await db.query("select status from purchase_invitation_outbox where session_id='cs_returning'")).rows[0].status, 'suppressed')
  assert.equal((await db.query('select count(*)::int n from client_invitations')).rows[0].n, 0)
  assert.equal((await db.query("select auth_user_id from clients where client_id='OWNED'")).rows[0].auth_user_id, owner)
})

test('prepared commerce foundation is dependency-complete, replay-safe and authorizes only server operations', async t => {
  const db = await fixture(); t.after(() => db.close())
  await t.test('foundation creates missing dependencies, contract v3 and protects receipts, delivery jobs and billing owners', async () => {
    await identity(db, 'service_role')
    assert.equal(await rpc(db, 'commerce_configuration_ready', [3]), true)
    assert.equal(await rpc(db, 'commerce_configuration_ready', [2]), false)
    await assert.rejects(db.query('select * from auth.users'), /permission denied/)
    for (const role of ['anon', 'authenticated']) {
      await identity(db, role, owner)
      for (const table of ['checkout_purchases', 'stripe_webhook_events', 'purchase_invitation_outbox', 'client_invitations']) await assert.rejects(db.query(`select * from ${table}`), /permission denied/)
      await assert.rejects(rpc(db, 'sync_member_subscription_v3', ['sub_synthetic', state()]), /permission denied/)
      await assert.rejects(rpc(db, 'claim_purchase_invitation', ['cs_synthetic', hash('token'), '2030-01-01']), /permission denied/)
      await assert.rejects(rpc(db, 'commerce_configuration_ready', [3]), /permission denied/)
    }
    await identity(db, 'service_role')
  })
  let clientId
  await t.test('fulfillment is atomic/idempotent, allows mapped Tracker and enqueues exactly one unbound receipt-owned invitation', async () => {
    await assert.rejects(rpc(db, 'fulfill_checkout_purchase', [purchase({ period_end: null })]), /Invalid purchase/)
    assert.equal((await db.query('select count(*)::int n from checkout_purchases')).rows[0].n, 0)
    const first = await rpc(db, 'fulfill_checkout_purchase', [purchase({ program: 'tracker' })]); clientId = first.client_id
    assert.equal(first.program, 'tracker'); assert.equal(first.replayed, false)
    assert.equal((await rpc(db, 'fulfill_checkout_purchase', [purchase({ program: 'tracker' })])).replayed, true)
    assert.equal((await db.query('select count(*)::int n from checkout_purchases')).rows[0].n, 1)
    assert.equal((await db.query('select count(*)::int n from purchase_invitation_outbox')).rows[0].n, 1)
    await rpc(db, 'fulfill_checkout_purchase', [purchase({ session_id: 'cs_owned', bound_client_id: 'OWNED', bound_user_id: owner, email: 'owner@synthetic.invalid', subscription_id: 'sub_owned' })])
    assert.equal((await db.query('select count(*)::int n from purchase_invitation_outbox')).rows[0].n, 1)
  })
  await t.test('current approved prices synchronize tier/status/period atomically; unknown prices revoke access without replacing history tier', async () => {
    const changed = await rpc(db, 'sync_member_subscription_v3', ['sub_synthetic', state()])
    assert.equal(changed.accepted, true); assert.equal(changed.previous_program, 'tracker'); assert.equal(changed.program, 'ignite')
    const client = (await db.query('select program,access,active,subscription_status from clients where client_id=$1', [clientId])).rows[0]
    assert.deepEqual(client, { program: 'ignite', access: true, active: true, subscription_status: 'active' })
    const bill = (await db.query('select membership_program,stripe_price_id,current_period_end from client_billing where client_id=$1', [clientId])).rows[0]
    assert.equal(bill.membership_program, 'ignite'); assert.equal(bill.stripe_price_id, 'price_igniteSynthetic')
    await rpc(db, 'sync_member_subscription_v3', ['sub_synthetic', state({ program: null, price_id: null, access: false, event_created: 101 })])
    assert.deepEqual((await db.query('select program,access,active from clients where client_id=$1', [clientId])).rows[0], { program: 'ignite', access: false, active: false })
    assert.equal((await rpc(db, 'sync_member_subscription_v3', ['sub_synthetic', state({ event_created: 100 })])).accepted, false)
  })
  await t.test('stale/equal-second events and legacy payloads cannot resurrect a canceled subscription', async () => {
    await rpc(db, 'sync_member_subscription_v3', ['sub_synthetic', state({ status: 'canceled', access: false, event_created: 102 })])
    for (const event_created of [101, 102, 103]) assert.equal((await rpc(db, 'sync_member_subscription_v3', ['sub_synthetic', state({ event_created })])).accepted, false)
    await rpc(db, 'sync_member_subscription', ['sub_synthetic', state({ program: undefined, price_id: undefined, event_created: 104 })])
    assert.deepEqual((await db.query('select program,access,active,subscription_status from clients where client_id=$1', [clientId])).rows[0], { program: 'ignite', access: false, active: false, subscription_status: 'canceled' })
  })
  await t.test('delivery leases retain one token/expiry/provider body across failures and permanently stop after success', async () => {
    const expires = new Date(Date.now() + 47 * 3600000).toISOString()
    const first = await rpc(db, 'claim_purchase_invitation', ['cs_synthetic', hash('stable-token'), expires])
    assert.equal(first.email, 'receipt@synthetic.invalid'); assert.equal(first.client_id, clientId); assert.equal(first.program, 'tracker')
    assert.equal(await rpc(db, 'claim_purchase_invitation', ['cs_synthetic', hash('stable-token'), expires]), null, 'Unexpired lease blocks concurrent delivery.')
    assert.equal(await rpc(db, 'finish_purchase_invitation', ['cs_synthetic', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true]), false)
    assert.equal(await rpc(db, 'finish_purchase_invitation', ['cs_synthetic', first.lease_token, false]), true)
    assert.equal(await rpc(db, 'claim_purchase_invitation', ['cs_synthetic', hash('stable-token'), expires]), null, 'Failure has a bounded retry delay.')
    await db.query("update purchase_invitation_outbox set next_attempt_at=now()-interval '1 minute' where session_id='cs_synthetic'")
    await assert.rejects(rpc(db, 'claim_purchase_invitation', ['cs_synthetic', hash('rotated-key'), expires]), /delivery key changed/)
    const next = await rpc(db, 'claim_purchase_invitation', ['cs_synthetic', hash('stable-token'), new Date(Date.now() + 48 * 3600000).toISOString()])
    assert.equal(next.invitation_id, first.invitation_id); assert.equal(next.expires_at, first.expires_at)
    assert.equal((await db.query('select count(*)::int n from client_invitations')).rows[0].n, 1)
    assert.equal(await rpc(db, 'finish_purchase_invitation', ['cs_synthetic', next.lease_token, true]), true)
    assert.equal(await rpc(db, 'claim_purchase_invitation', ['cs_synthetic', hash('stable-token'), expires]), null)
    assert.ok((await db.query('select delivered_at from client_invitations')).rows[0].delivered_at)
  })
  await t.test('claimed owners suppress pending invitations; uncertain delivery is held before provider idempotency retention expires', async () => {
    await rpc(db, 'fulfill_checkout_purchase', [purchase({ session_id: 'cs_claimed', subscription_id: 'sub_claimed' })])
    const claimedId = (await db.query("select client_id from checkout_purchases where session_id='cs_claimed'")).rows[0].client_id
    await db.query('update clients set auth_user_id=$1 where client_id=$2', [owner, claimedId])
    assert.equal(await rpc(db, 'claim_purchase_invitation', ['cs_claimed', hash('claimed'), new Date(Date.now() + 3600000).toISOString()]), null)
    assert.equal((await db.query("select status from purchase_invitation_outbox where session_id='cs_claimed'")).rows[0].status, 'suppressed')
    await rpc(db, 'fulfill_checkout_purchase', [purchase({ session_id: 'cs_uncertain', subscription_id: 'sub_uncertain' })])
    await db.query("update purchase_invitation_outbox set first_attempt_at=now()-interval '23 hours',attempts=1 where session_id='cs_uncertain'")
    assert.equal(await rpc(db, 'claim_purchase_invitation', ['cs_uncertain', hash('uncertain'), new Date(Date.now() + 3600000).toISOString()]), null)
    assert.equal((await db.query("select status from purchase_invitation_outbox where session_id='cs_uncertain'")).rows[0].status, 'manual_recovery')
  })
})
