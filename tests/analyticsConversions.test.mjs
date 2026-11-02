import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import { importTs } from './typescriptModule.mjs'

const server = await importTs('lib/analytics/server.ts', { '@/lib/supabase/admin': 'export const createAdminClient = () => globalThis.analyticsAdmin' })
const migration = readFileSync('supabase/migrations/20261101152000_analytics_conversion_receipts.sql', 'utf8')
const owner = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222'
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

async function database() {
  const db = new PGlite()
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated,service_role;
    create table clients(client_id text primary key,auth_user_id uuid,onboarding_completed boolean default false);
    create table workout_logs(id uuid default gen_random_uuid(),client_id text,completed boolean default false);
    create table recovery_activity_logs(id uuid default gen_random_uuid(),client_id text);
    create table nutrition_logs(id uuid primary key,client_id text);
    create table meal_entries(id uuid default gen_random_uuid(),nutrition_log_id uuid,entry_state text);
    create table macro_entries(id uuid default gen_random_uuid(),nutrition_log_id uuid,calories numeric,protein_g numeric,carbs_g numeric,fat_g numeric);
    create table client_billing(client_id text,stripe_subscription_id text,membership_program text,billing_status text,access_active boolean,last_subscription_event_created bigint default 0);
    insert into auth.users values('${owner}'),('${other}');
    insert into clients(client_id,auth_user_id) values('owner','${owner}'),('other','${other}');
    insert into nutrition_logs values('${id}','owner');
  `)
  await db.exec(migration)
  return db
}
const rows = (db, sql) => db.query(sql).then(result => result.rows)

test('SQL success receipts are atomic, first-ever, owner-bound, and never publicly forgeable', async () => {
  const db = await database()
  try {
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${owner}',false); select set_analytics_consent(true); reset role;`)
    await assert.rejects(db.exec(`set role authenticated; select analytics_private.record_conversion('${owner}','subscription_activated','forged','{}');`), /permission denied/)
    await db.exec('reset role;')
    await db.exec(`update clients set onboarding_completed=true where client_id='owner'; update clients set onboarding_completed=true where client_id='owner';
      insert into workout_logs(id,client_id,completed) values('${id}','owner',false); update workout_logs set completed=true where id='${id}'; update workout_logs set completed=true where id='${id}';
      insert into recovery_activity_logs(client_id) values('owner'); insert into recovery_activity_logs(client_id) values('owner');
      insert into macro_entries(nutrition_log_id,calories) values('${id}',0),('${id}',100);
      insert into meal_entries(nutrition_log_id,entry_state) values('${id}','draft'),('${id}','confirmed');`)
    assert.deepEqual((await rows(db, 'select event,count(*)::integer as total from analytics_conversion_receipts group by event order by event')).map(row => [row.event,row.total]), [
      ['first_nutrition_completed',1],['first_recovery_completed',1],['first_workout_completed',1],['onboarding_completed',1],
    ])
    assert.equal((await rows(db, 'select count(*)::integer as total from analytics_conversion_receipts where eligible'))[0].total, 4)
    await db.exec(`begin;insert into recovery_activity_logs(client_id) values('other');rollback;`)
    assert.equal((await rows(db, `select count(*)::integer as total from analytics_conversion_receipts where user_id='${other}'`))[0].total, 0)
    await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${other}',false);select set_analytics_consent(false);`)
    await assert.rejects(db.query('select * from analytics_conversion_receipts'), /permission denied/)
    await assert.rejects(db.query('select * from claim_analytics_conversions(null,10)'), /permission denied/)
    await db.exec('reset role;')
  } finally { await db.close() }
})

test('consent is required at occurrence and delivery; retry leases and acknowledgements cannot duplicate or revive suppressed events', async () => {
  const db = await database()
  try {
    await db.exec(`insert into recovery_activity_logs(client_id) values('owner');
      set role authenticated;select set_config('request.jwt.claim.sub','${owner}',false);select set_analytics_consent(true);reset role;
      insert into recovery_activity_logs(client_id) values('owner');`)
    assert.equal((await rows(db, 'select eligible from analytics_conversion_receipts'))[0].eligible, false, 'Later consent must not backfill a pre-consent first action.')
    await db.exec(`update clients set onboarding_completed=true where client_id='owner';set role service_role;`)
    const claimed = await rows(db, 'select * from claim_analytics_conversions(null,10)')
    assert.equal(claimed.length, 1)
    assert.equal((await rows(db, 'select * from claim_analytics_conversions(null,10)')).length, 0)
    await db.query('select ack_analytics_conversions($1::uuid[],$2::uuid)', [[claimed[0].id], id])
    assert.equal((await rows(db, `select delivered_at from analytics_conversion_receipts where id='${claimed[0].id}'`))[0].delivered_at, null)
    await db.query('select ack_analytics_conversions($1::uuid[],$2::uuid)', [[claimed[0].id], claimed[0].claim_token])
    assert.ok((await rows(db, `select delivered_at from analytics_conversion_receipts where id='${claimed[0].id}'`))[0].delivered_at)
    await db.exec(`reset role;insert into workout_logs(client_id,completed) values('owner',true);
      set role authenticated;select set_config('request.jwt.claim.sub','${owner}',false);select set_analytics_consent(false);reset role;set role service_role;`)
    assert.equal((await rows(db, 'select * from claim_analytics_conversions(null,10)')).length, 0)
  } finally { await db.close() }
})

test('billing lifecycle receipts follow actual accepted state changes, tier upgrades and later verified purchase binding', async () => {
  const db = await database()
  try {
    await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${owner}',false);select set_analytics_consent(true);reset role;
      insert into client_billing values('owner','sub_synthetic','ember','active',true,1);
      update client_billing set last_subscription_event_created=2 where client_id='owner';
      update client_billing set membership_program='ignite',last_subscription_event_created=3 where client_id='owner';
      update client_billing set membership_program='ignite',last_subscription_event_created=3 where client_id='owner';
      update client_billing set billing_status='canceled',access_active=false,last_subscription_event_created=4 where client_id='owner';
      update client_billing set billing_status='canceled',access_active=false,last_subscription_event_created=4 where client_id='owner';`)
    assert.deepEqual((await rows(db, 'select event,count(*)::integer as total from analytics_conversion_receipts group by event order by event')).map(row => [row.event,row.total]), [
      ['subscription_activated',1],['subscription_cancelled',1],['subscription_upgraded',1],
    ])
    const properties = await rows(db, 'select properties from analytics_conversion_receipts')
    assert.doesNotMatch(JSON.stringify(properties), /sub_synthetic|email|price|token|payment|assessment/i)
    await db.exec(`insert into clients(client_id) values('pending');insert into client_billing values('pending','sub_guest','tracker','active',true,5);
      update clients set auth_user_id='${owner}' where client_id='pending';`)
    assert.equal((await rows(db, `select count(*)::integer as total from analytics_conversion_receipts where event='subscription_activated'`))[0].total, 2)
  } finally { await db.close() }
})

test('existing successful history cannot be reported as a new first-ever conversion after installing receipts', async () => {
  const db=await database()
  try {
    await db.exec(`insert into recovery_activity_logs(client_id) values('owner');
      insert into workout_logs(client_id,completed) values('owner',true);
      insert into macro_entries(nutrition_log_id,calories) values('${id}',100);
      update clients set onboarding_completed=true where client_id='owner';
      delete from analytics_conversion_receipts;
      set role authenticated;select set_config('request.jwt.claim.sub','${owner}',false);select set_analytics_consent(true);reset role;
      insert into recovery_activity_logs(client_id) values('owner');
      insert into workout_logs(client_id,completed) values('owner',true);
      insert into meal_entries(nutrition_log_id,entry_state) values('${id}','confirmed');
      update clients set onboarding_completed=true where client_id='owner';`)
    assert.equal((await rows(db,'select count(*)::integer as total from analytics_conversion_receipts'))[0].total,0)
  } finally {await db.close()}
})

test('server delivery is test-disabled by default and only sends sanitized, consent-approved leased receipts through an injected transport', async () => {
  const priorKey=process.env.NEXT_PUBLIC_POSTHOG_KEY
  process.env.NEXT_PUBLIC_POSTHOG_KEY='synthetic-test-key'
  const calls=[], receipt={id,user_id:owner,distinct_id:'member_'+createHash('sha256').update(`anastasis-analytics-v1:${owner}`).digest('hex'),event:'subscription_activated',occurred_at:'2026-11-01T12:00:00Z',claim_token:other,
    properties:{tier:'ignite',email:'never-send@example.test',capacity_score:12,token:'secret',source:'cycle_support',$current_url:'https://test/?token=secret'}}
  const admin={async rpc(name,args){calls.push({name,args});return name==='claim_analytics_conversions'?{data:[receipt],error:null}:name==='validate_analytics_delivery'?{data:[receipt.id],error:null}:{error:null}}}
  try {
    assert.equal(await server.deliverPendingConversions(admin), false)
    assert.equal(calls.length,0)
    const bodies=[]
    const transport=async (_url,options)=>{bodies.push(JSON.parse(options.body));return {ok:true}}
    assert.equal(await server.deliverPendingConversions(admin,{allowTest:true,transport}),true)
    const capture=bodies[0].batch[0]
    assert.equal(capture.event,'subscription_activated')
    assert.equal(capture.properties.$insert_id,id)
    assert.equal(capture.properties.$geoip_disable,true)
    assert.equal(capture.properties.analytics_environment,'test')
    assert.equal(capture.properties.distinct_id,'member_'+createHash('sha256').update(`anastasis-analytics-v1:${owner}`).digest('hex'))
    assert.doesNotMatch(JSON.stringify(bodies), /never-send|capacity|cycle_support|current_url|token|secret/)
    assert.equal(calls.at(-1).name,'ack_analytics_conversions')
    assert.equal(await server.deliverPendingConversions(admin,{allowTest:true,transport:async()=>({ok:false})}),false)
    assert.equal(calls.at(-1).name,'validate_analytics_delivery','A failed provider response must not acknowledge success.')
    assert.equal(calls.filter(call=>call.name==='ack_analytics_conversions').length,1)
  } finally { if(priorKey===undefined)delete process.env.NEXT_PUBLIC_POSTHOG_KEY;else process.env.NEXT_PUBLIC_POSTHOG_KEY=priorKey }
})

test('audit and pricing emitters use confirmed success and no assessment-derived event properties', () => {
  const audit=readFileSync('app/audit/page.tsx','utf8')
  assert.match(audit,/trackEvent\('audit_started', \{ page: 'audit' \}\)/)
  assert.doesNotMatch(audit.match(/trackEvent\('audit_page_completed',[\s\S]*?\}\)/)?.[0]||'', /capacity|recommended|audit_id|email/)
  assert.ok(audit.indexOf("if (!response.ok)")<audit.indexOf("trackEvent('audit_page_completed'"))
  for(const tier of ['ignite','phoenix']) {
    for(const suffix of ['page.tsx','cart/page.tsx']) {
      const cart=readFileSync(`app/program/${tier}/${suffix}`,'utf8')
      assert.match(cart,/if \(response.ok && data.url\)/)
      assert.match(cart,/trackEvent\('checkout_started'/)
    }
  }
  assert.match(readFileSync('components/commerce/CartPriceDetails.tsx','utf8'),/price && billing === 'subscription'.*pricing_viewed/)
  const reporting=readFileSync('app/api/aos/analytics/route.ts','utf8')
  assert.match(reporting,/count\(DISTINCT distinct_id\)/)
  assert.match(reporting,/analytics_environment = 'production'/)
  assert.doesNotMatch(reporting,/checkout_completed|audit_submit_clicked|\$utm_source/)
})
