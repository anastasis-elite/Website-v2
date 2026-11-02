import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, readdirSync } from 'node:fs'
import { createProductionFixture, setFixtureIdentity } from '../scripts/lib/p0-production-fixture.mjs'

test('prepared commerce, analytics and membership contracts coexist on the captured schema with authoritative owner-only conversions', async t => {
  const { db } = await createProductionFixture()
  t.after(() => db.close())
  // Existing P0 files reconstruct the captured production schema. Storage is a
  // disposable local substitute; the real prepared Community files run intact.
  for (const name of readdirSync('supabase/migrations').filter(name => /_p0_.*\.sql$/.test(name)).sort()) await db.exec(readFileSync('supabase/migrations/' + name, 'utf8'))
  assert.equal((await db.query("select data_type from information_schema.columns where table_schema='public' and table_name='clients' and column_name='subscription_ends_at'")).rows[0].data_type, 'date')
  await db.exec(`create schema storage;
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text not null,name text not null,metadata jsonb,unique(bucket_id,name));
    alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated,anon;
    grant select,insert,update,delete on storage.objects to authenticated,anon;`)
  for (const name of [
    '20261029010729_community_posts_storage.sql', '20261029010738_community_operations.sql',
    '20261101145900_membership_exact_expiry.sql', '20261101150000_launch_commerce_foundation.sql',
    '20261101152000_analytics_conversion_receipts.sql', '20261101153000_analytics_consent_attribution.sql',
    '20261101160000_membership_capabilities.sql',
  ]) {
    await db.exec(readFileSync('supabase/migrations/' + name, 'utf8'))
  }
  const owner = '11111111-1111-4111-8111-111111111111', freeOwner = '22222222-2222-4222-8222-222222222222'
  const historicalLog = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  await db.query(`insert into auth.users(id,email,email_confirmed_at) values($1,'paid@synthetic.invalid',now()),($2,'free@synthetic.invalid',now())`, [owner, freeOwner])
  await db.query(`insert into clients(client_id,auth_user_id,email,login_email,program,access,active) values('COMBINED-PAID',$1,'paid@synthetic.invalid','paid@synthetic.invalid','free',true,true)`, [owner])
  await db.query(`insert into nutrition_logs(id,client_id,auth_user_id,log_date,calories,water_consumed_oz) values($1,'COMBINED-PAID',$2,current_date-1,1900,12)`, [historicalLog, owner])
  await setFixtureIdentity(db, 'authenticated', freeOwner)
  const freeId = (await db.query("select enroll_free_community('Synthetic Free Owner') result")).rows[0].result.client_id
  assert.equal((await db.query("select member_has_capability($1,'community') allowed", [freeId])).rows[0].allowed, true)
  assert.equal((await db.query('select community_private.has_member_access() allowed')).rows[0].allowed, true)
  assert.equal((await db.query("select member_has_capability(null,'community') allowed")).rows[0].allowed, false)
  assert.equal((await db.query('select member_has_capability($1,null) allowed', [freeId])).rows[0].allowed, false)
  assert.equal((await db.query("select member_has_capability($1,'generatedCoaching') allowed", [freeId])).rows[0].allowed, false)
  await assert.rejects(db.query("update clients set program='phoenix' where client_id=$1", [freeId]), /entitlement/)
  await assert.rejects(db.query('select fulfill_checkout_purchase($1)', [{}]), /permission denied/)
  await assert.rejects(db.query("select analytics_private.record_conversion($1,'subscription_activated','forged','{}')", [freeOwner]), /permission denied/)
  assert.equal((await db.query('select count(*)::int n from nutrition_logs where id=$1', [historicalLog])).rows[0].n, 0)

  await setFixtureIdentity(db, 'authenticated', owner)
  assert.equal((await db.query("select member_has_capability('COMBINED-PAID','generatedCoaching') allowed")).rows[0].allowed, false)
  await setFixtureIdentity(db, 'service_role')
  const browserId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', journey = 'anonymous_' + browserId
  assert.equal((await db.query('select record_analytics_consent_v2($1::uuid,true,100,$2::uuid,$3) accepted', [owner, browserId, journey])).rows[0].accepted, true)
  const purchase = { session_id: 'cs_combined_synthetic', program: 'ember', price_id: 'price_combinedEmber', email: 'paid@synthetic.invalid',
    bound_client_id: 'COMBINED-PAID', bound_user_id: owner, customer_id: 'cus_combined', subscription_id: 'sub_combined',
    billing_type: 'subscription', billing_status: 'active', access_active: true, period_start: '2026-01-01T00:00:00Z', period_end: '2035-01-01T15:45:30Z',
    purchased_at: '2026-11-01T00:00:00Z', livemode: false }
  await db.query('select save_checkout_analytics_context($1,$2::uuid,100,$3,true)', [purchase.session_id, browserId, journey])
  const fulfill = async () => (await db.query('select fulfill_checkout_purchase($1) result', [purchase])).rows[0].result
  assert.equal((await fulfill()).replayed, false)
  const activation = (await db.query("select event,properties,eligible from analytics_conversion_receipts where user_id=$1 and event='subscription_activated'", [owner])).rows
  assert.deepEqual(activation, [{ event: 'subscription_activated', properties: { tier: 'ember' }, eligible: true }], 'Verified fulfillment alone is the authority; no return-page or later provider event is required.')
  await fulfill()
  assert.equal((await db.query("select count(*)::int n from analytics_conversion_receipts where event='subscription_activated'")).rows[0].n, 1)
  assert.deepEqual((await db.query("select membership_program,stripe_price_id from client_billing where client_id='COMBINED-PAID'")).rows[0], { membership_program: 'ember', stripe_price_id: 'price_combinedEmber' })
  assert.equal(new Date((await db.query("select membership_expires_at from clients where client_id='COMBINED-PAID'")).rows[0].membership_expires_at).toISOString(), '2035-01-01T15:45:30.000Z')

  const state = { program: 'ignite', price_id: 'price_combinedIgnite', status: 'active', access: true, start: '2026-01-01T00:00:00Z', end: '2035-01-01T15:45:30Z', event_created: 100, cancelAtPeriodEnd: false }
  const sync = async patch => (await db.query('select sync_member_subscription_v3($1,$2) result', ['sub_combined', { ...state, ...patch }])).rows[0].result
  assert.equal((await sync({})).accepted, true)
  assert.equal((await db.query("select program from clients where client_id='COMBINED-PAID'")).rows[0].program, 'ignite')
  const receipts = () => db.query("select event,properties,eligible from analytics_conversion_receipts where event in ('subscription_activated','subscription_upgraded','subscription_cancelled') order by event").then(result => result.rows)
  const afterUpgrade = await receipts()
  assert.deepEqual(afterUpgrade, [
    { event: 'subscription_activated', properties: { tier: 'ember' }, eligible: true },
    { event: 'subscription_upgraded', properties: { tier: 'ignite', previous_tier: 'ember' }, eligible: true },
  ])
  await sync({})
  assert.equal((await sync({ program: 'phoenix', price_id: 'price_combinedPhoenix', event_created: 99 })).accepted, false)
  assert.deepEqual(await receipts(), afterUpgrade)
  await setFixtureIdentity(db, 'authenticated', owner)
  assert.equal((await db.query("select member_has_capability('COMBINED-PAID','nutritionMealLogging') allowed")).rows[0].allowed, true)
  assert.equal((await db.query("select member_has_capability('COMBINED-PAID','recoveryDirectedNextAction') allowed")).rows[0].allowed, false)
  await assert.rejects(db.query("update client_billing set stripe_price_id='price_forged' where client_id='COMBINED-PAID'"), /permission denied/)
  await setFixtureIdentity(db, 'service_role')
  await sync({ status: 'canceled', access: false, event_created: 101 })
  assert.equal((await sync({ event_created: 102 })).accepted, false)
  const finalReceipts = await receipts()
  assert.equal(finalReceipts.filter(receipt => receipt.event === 'subscription_cancelled').length, 1)
  assert.doesNotMatch(JSON.stringify(finalReceipts), /synthetic\.invalid|price_|sub_|email|token|payment|capacity|assessment/)
  await setFixtureIdentity(db, 'authenticated', owner)
  assert.equal((await db.query("select member_has_capability('COMBINED-PAID','generatedCoaching') allowed")).rows[0].allowed, false)
  assert.equal((await db.query("select member_has_capability('COMBINED-PAID','accountData') allowed")).rows[0].allowed, true)
  const retained = (await db.query('select calories,water_consumed_oz from nutrition_logs where id=$1', [historicalLog])).rows[0]
  assert.equal(Number(retained.calories), 1900); assert.equal(Number(retained.water_consumed_oz), 12)
  await assert.rejects(db.query('select * from analytics_conversion_receipts'), /permission denied/)
})
