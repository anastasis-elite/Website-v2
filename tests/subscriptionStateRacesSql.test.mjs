import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

const migration = () => readFileSync('supabase/migrations/20261101150000_launch_commerce_foundation.sql', 'utf8')
async function fixture({ apply = true } = {}) {
  const db = new PGlite()
  await db.exec(`
    create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create table auth.users(id uuid primary key,email text);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated,service_role;
    grant execute on function auth.uid() to anon,authenticated,service_role;
    create table clients(client_id text primary key,email text,full_name text,program text,auth_user_id uuid,login_email text,
      onboarding_completed boolean default false,verified_purchase boolean default false,access boolean default false,active boolean default false,
      subscription_status text,subscription_started_at date,subscription_ends_at date,membership_expires_at timestamptz,updated_at timestamptz default now());
    -- Captured production permits several billing rows for one client. The new
    -- migration must preflight duplicates, rather than silently discarding one.
    create table client_billing(id uuid primary key default gen_random_uuid(),client_id text references clients(client_id),stripe_customer_id text,stripe_subscription_id text,
      billing_type text,billing_status text,current_period_start timestamptz,current_period_end timestamptz,last_payment_date timestamptz,
      next_payment_date timestamptz,access_active boolean default false,cancel_at_period_end boolean default false,updated_at timestamptz default now());
    grant select,insert,update,delete on clients to service_role;
    grant select on clients to authenticated;
    alter table clients enable row level security;
    create policy owned_client_read on clients for select to authenticated using(auth_user_id=(select auth.uid()));
    insert into clients(client_id,email,program,access,active) values('RACE','race@synthetic.invalid','ember',true,true);
  `)
  if (apply) {
    await db.exec(migration())
    await db.exec(`insert into client_billing(client_id,stripe_subscription_id,billing_status,access_active,current_period_start,current_period_end,membership_program,stripe_price_id)
      values('RACE','sub_synthetic_race','active',true,'2026-01-01','2035-01-01','ember','price_syntheticEmber');set role service_role;`)
  }
  return db
}
const state = patch => ({ status: 'active', access: true, program: 'ember', price_id: 'price_syntheticEmber', start: '2026-01-01T00:00:00Z', end: '2035-01-01T00:00:00Z', cancelAtPeriodEnd: false, event_created: 100, ...patch })
const sync = (db, value) => db.query('select sync_member_subscription_v3($1,$2) result', ['sub_synthetic_race', value]).then(result => result.rows[0].result)
const snapshot = async db => {
  const client = (await db.query("select program,subscription_status,access,active from clients where client_id='RACE'")).rows[0]
  const billing = (await db.query("select billing_status,membership_program,access_active,last_subscription_event_created,subscription_sync_conflicted from client_billing where client_id='RACE'")).rows[0]
  return { client, billing }
}

test('conflicting same-second active/past-due snapshots fail closed in either concurrent submission order without rewriting accepted tier or status', async t => {
  for (const reversed of [false, true]) {
    const db = await fixture(); t.after(() => db.close())
    const states = [state({}), state({ status: 'past_due', access: false, program: 'ignite', price_id: 'price_syntheticIgnite' })]
    if (reversed) states.reverse()
    // Both snapshots were fetched before either write. PGlite serializes the
    // concurrently issued calls, exercising each lock-acquisition order.
    const results = await Promise.all(states.map(value => sync(db, value)))
    assert.equal(results[0].accepted, true)
    assert.equal(results[1].accepted, false); assert.equal(results[1].conflict, true)
    const saved = await snapshot(db)
    assert.equal(saved.client.program, states[0].program)
    assert.equal(saved.client.subscription_status, states[0].status)
    assert.equal(saved.billing.billing_status, states[0].status)
    assert.equal(saved.client.access, false); assert.equal(saved.client.active, false)
    assert.equal(saved.billing.access_active, false); assert.equal(saved.billing.subscription_sync_conflicted, true)
    assert.equal((await sync(db, states[0])).accepted, false, 'An equal-second replay cannot undo conflict denial.')
    assert.equal((await sync(db, states[1])).accepted, false)
    const recovery = await sync(db, state({ event_created: 101, program: 'ignite', price_id: 'price_syntheticIgnite' }))
    assert.equal(recovery.accepted, true)
    const recovered = await snapshot(db)
    assert.equal(recovered.client.program, 'ignite'); assert.equal(recovered.client.access, true)
    assert.equal(recovered.billing.subscription_sync_conflicted, false)
  }
})

test('identical same-second replays are safe; tier-only conflicts deny until newer payment recovery and terminal cancellation remains absorbing', async t => {
  const db = await fixture(); t.after(() => db.close())
  const initial = state({})
  assert.equal((await sync(db, initial)).accepted, true)
  assert.equal((await sync(db, { ...initial, start: '2025-12-31T19:00:00-05:00' })).accepted, true, 'Equivalent period instants produce the same state fingerprint.')
  assert.equal((await snapshot(db)).client.access, true)
  assert.equal((await sync(db, state({ program: 'phoenix', price_id: 'price_syntheticPhoenix' }))).conflict, true)
  assert.equal((await snapshot(db)).client.program, 'ember')
  assert.equal((await snapshot(db)).client.access, false)
  assert.equal((await sync(db, state({ event_created: 101, status: 'past_due', access: false }))).accepted, true)
  assert.equal((await sync(db, state({ event_created: 102 }))).accepted, true, 'A genuinely newer paid-again state restores access.')
  assert.equal((await snapshot(db)).client.access, true)
  assert.equal((await sync(db, state({ event_created: 102, status: 'canceled', access: false }))).accepted, true)
  assert.equal((await snapshot(db)).client.subscription_status, 'canceled')
  assert.equal((await sync(db, state({ event_created: 103 }))).accepted, false)
  assert.equal((await snapshot(db)).client.access, false)
})

test('duplicate production-shaped billing rows stop the migration for operator review without deleting or changing customer rows', async t => {
  const db = await fixture({ apply: false }); t.after(() => db.close())
  await db.exec(`insert into client_billing(client_id,stripe_customer_id,stripe_subscription_id,billing_status,access_active)
    values('RACE','cus_first','sub_first','active',true),('RACE','cus_second','sub_second','past_due',false);`)
  const before = (await db.query('select * from client_billing order by stripe_customer_id')).rows
  await assert.rejects(db.exec(migration()), /operator review|review.*duplicate|duplicate.*review/i)
  await db.exec('rollback')
  assert.deepEqual((await db.query('select * from client_billing order by stripe_customer_id')).rows, before)
  assert.equal((await db.query("select access from clients where client_id='RACE'")).rows[0].access, true)
})
