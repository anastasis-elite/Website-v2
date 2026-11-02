import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { importTs } from './typescriptModule.mjs'

const { hasActiveMembership, membershipCan } = await importTs('lib/membership/policy.ts')
const expiryMigration = readFileSync('supabase/migrations/20261101145900_membership_exact_expiry.sql', 'utf8')
const commerceMigration = readFileSync('supabase/migrations/20261101150000_launch_commerce_foundation.sql', 'utf8')
const capabilitySource = readFileSync('supabase/migrations/20261101160000_membership_capabilities.sql', 'utf8')
const capabilityDefinitions = capabilitySource.slice(capabilitySource.indexOf('create schema if not exists membership_private'), capabilitySource.indexOf('-- Extend only single-column program checks'))
const protectDefinitions = capabilitySource.slice(capabilitySource.indexOf('create or replace function public.protect_member_entitlements()'), capabilitySource.indexOf('create or replace function public.enroll_free_community'))
const owner = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'

async function fixture() {
 const db = new PGlite()
 await db.exec(`
  create role anon; create role authenticated; create role service_role bypassrls;
  create schema auth;
  create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  grant usage on schema public,auth to anon,authenticated,service_role;
  grant execute on function auth.uid() to anon,authenticated,service_role;
  create table clients(client_id text primary key,email text,full_name text,program text,auth_user_id uuid,login_email text,
   timezone text,state text,onboarding_data jsonb default '{}',onboarding_completed boolean default false,
   verified_purchase boolean default false,access boolean default false,active boolean default false,subscription_status text,
   subscription_started_at date,subscription_ends_at date,updated_at timestamptz default now());
  create table client_billing(client_id text references clients(client_id),stripe_customer_id text,stripe_subscription_id text,billing_type text,billing_status text,
   current_period_start timestamptz,current_period_end timestamptz,last_payment_date timestamptz,next_payment_date timestamptz,
   access_active boolean,cancel_at_period_end boolean,updated_at timestamptz);
  grant select,insert,update,delete on clients to service_role;
  grant select,update on clients to authenticated;
  alter table clients enable row level security;
  create policy owner_profile on clients for all to authenticated using(auth_user_id=auth.uid()) with check(auth_user_id=auth.uid());
  insert into auth.users values('${owner}','owner@synthetic.invalid',now()),('${other}','other@synthetic.invalid',now());
  insert into clients(client_id,email,program,auth_user_id,timezone,access,active,verified_purchase,subscription_ends_at)
   values('OWN','owner@synthetic.invalid','ember','${owner}','America/Los_Angeles',true,true,true,'2000-01-01'),
         ('OTHER','other@synthetic.invalid','ignite','${other}','America/Chicago',true,true,true,'2035-01-01');
 `)
 await db.exec(expiryMigration)
 await db.exec(commerceMigration)
 await db.exec(capabilityDefinitions)
 await db.exec(protectDefinitions)
 return db
}
async function identity(db, role, id = '') {
 await db.exec('reset role')
 await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id])
 await db.exec(`set role ${role}`)
}
const rpc = async (db, name, args) => (await db.query(`select ${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) result`, args)).rows[0].result
const grant = patch => ({ session_id:'cs_expiry_date',program:'ember',email:'owner@synthetic.invalid',bound_client_id:'OWN',bound_user_id:owner,
 customer_id:'cus_synthetic',subscription_id:'sub_exact',billing_type:'subscription',billing_status:'active',access_active:true,
 period_start:'2035-06-12T17:43:21.123Z',period_end:'2035-07-12T17:43:21.123Z',purchased_at:'2035-06-12T17:43:21.123Z',livemode:false,...patch })

test('production DATE schema preserves legacy day and exact provider expiry before, at and after a non-midnight instant', async t => {
 const db=await fixture();t.after(()=>db.close())
 assert.equal((await db.query("select membership_expires_at from clients where client_id='OWN'")).rows[0].membership_expires_at,null,'no timestamp backfill')
 await identity(db,'service_role')
 await rpc(db,'fulfill_checkout_purchase',[grant()])
 const row=(await db.query("select to_jsonb(c) record from clients c where client_id='OWN'")).rows[0].record
 assert.equal(row.subscription_ends_at,'2000-01-01','provider grant must not overwrite the legacy DATE')
 assert.equal(new Date(row.membership_expires_at).toISOString(),'2035-07-12T17:43:21.123Z')
 const stored=(await db.query("select current_period_end from client_billing where client_id='OWN'")).rows[0]
 assert.equal(stored.current_period_end.toISOString(),new Date(row.membership_expires_at).toISOString())
 for(const [instant,expected] of [['2035-07-12T17:43:21.122Z',true],['2035-07-12T17:43:21.123Z',false],['2035-07-12T17:43:21.124Z',false]]) {
  assert.equal(hasActiveMembership(row,new Date(instant)),expected)
  assert.equal(await rpc(db,'membership_private.expiry_is_current',[row,instant]),expected)
 }
 const columns=(await db.query("select column_name,data_type from information_schema.columns where table_name='clients' and column_name in ('subscription_ends_at','membership_expires_at')")).rows
 assert.deepEqual(columns.map(row=>[row.column_name,row.data_type]).sort(),[['membership_expires_at','timestamp with time zone'],['subscription_ends_at','date']])
})

test('legacy DATE fallback preserves UTC-midnight cutoff without a member-local extension; exact expiry takes precedence', async t => {
 const db=await fixture();t.after(()=>db.close())
 const legacy={program:'ember',access:true,active:true,verified_purchase:true,subscription_ends_at:'2035-07-12',timezone:'America/Los_Angeles'}
 for(const [instant,expected] of [['2035-07-11T23:59:59.999Z',true],['2035-07-12T00:00:00.000Z',false],['2035-07-12T00:00:00.001Z',false],['2035-07-12T18:00:00Z',false]]) {
  assert.equal(hasActiveMembership(legacy,new Date(instant)),expected)
  assert.equal(await rpc(db,'membership_private.expiry_is_current',[legacy,instant]),expected)
 }
 for(const timezone of ['America/Los_Angeles','Asia/Tokyo','invalid-zone']) {
  const record={...legacy,timezone,state:'CA'}
  assert.equal(hasActiveMembership(record,new Date('2035-07-12T00:00:00Z')),false)
  assert.equal(await rpc(db,'membership_private.expiry_is_current',[record,'2035-07-12T00:00:00Z']),false)
 }
 const renewing={...legacy,membership_expires_at:'2035-07-12T17:43:21.123Z'}
 for(const [instant,expected] of [['2035-07-12T17:43:21.122Z',true],['2035-07-12T17:43:21.123Z',false],['2035-07-12T17:43:21.124Z',false]]) {
  assert.equal(hasActiveMembership(renewing,new Date(instant)),expected)
  assert.equal(await rpc(db,'membership_private.expiry_is_current',[renewing,instant]),expected)
 }
 assert.equal(hasActiveMembership({...legacy,membership_expires_at:'invalid'},new Date('2035-07-11T18:00:00Z')),false)
})

test('atomic sync preserves provider precision and terminal cancellation; canonical authorization stays owner-bound and cannot self-extend', async t => {
 const db=await fixture();t.after(()=>db.close())
 await identity(db,'service_role')
 await rpc(db,'fulfill_checkout_purchase',[grant()])
 const current={program:'ignite',price_id:'price_igniteSynthetic',status:'active',access:true,start:'2035-07-12T17:43:21.123Z',end:'2035-08-12T21:14:15.321Z',event_created:100,cancelAtPeriodEnd:false}
 await rpc(db,'sync_member_subscription_v3',['sub_exact',current])
 let row=(await db.query("select to_jsonb(c) record from clients c where client_id='OWN'")).rows[0].record
 assert.equal(new Date(row.membership_expires_at).toISOString(),current.end);assert.equal(row.subscription_ends_at,'2000-01-01');assert.equal(row.program,'ignite')
 await identity(db,'authenticated',owner)
 assert.equal(await rpc(db,'member_has_capability',['OWN','workoutLogging']),true)
 assert.equal(await rpc(db,'member_has_capability',['OTHER','workoutLogging']),false)
 await assert.rejects(db.query("update clients set membership_expires_at='2099-01-01T12:00Z' where client_id='OWN'"),/entitlement/)
 await identity(db,'service_role')
 await rpc(db,'sync_member_subscription_v3',['sub_exact',{...current,status:'canceled',access:false,event_created:101}])
 await rpc(db,'sync_member_subscription_v3',['sub_exact',{...current,event_created:102}])
 row=(await db.query("select to_jsonb(c) record from clients c where client_id='OWN'")).rows[0].record
 assert.equal(row.subscription_status,'canceled');assert.equal(row.access,false);assert.equal(new Date(row.membership_expires_at).toISOString(),current.end)
 assert.equal(hasActiveMembership(row),false)
 await identity(db,'authenticated',owner)
 assert.equal(await rpc(db,'member_has_capability',['OWN','workoutLogging']),false)
 await identity(db,'service_role')
 await db.exec("update clients set program='unknown',access=true,active=true where client_id='OWN'")
 row=(await db.query("select to_jsonb(c) record from clients c where client_id='OWN'")).rows[0].record
 assert.equal(membershipCan(row,'accountData'),false)
 await identity(db,'authenticated',owner)
 assert.equal(await rpc(db,'member_has_capability',['OWN','accountData']),false)
})

test('explicit protected client projections include authoritative expiry and timezone inputs', () => {
 const paths=['middleware.ts','lib/community/server.ts','lib/nutrition/mealLoggingAccess.ts','lib/nutrition/createMealEntry.ts','app/api/program/workout/route.ts',
  'app/api/nutrition-log/route.ts','app/api/recovery/activity/route.ts','app/api/nutrition/route.ts','app/api/nutrition/recurring-foods/route.ts',
  'app/api/nutrition/photo-estimate/route.ts','app/api/nutrition/nutrient-insights/route.ts','app/api/nutrition/custom-food/route.ts','app/api/nutrition/barcode/route.ts','app/api/nutrition/add-macros/route.ts']
 for(const path of paths) {
  for(const line of readFileSync(path,'utf8').split('\n').filter(line=>line.includes('subscription_ends_at'))) {
   assert.match(line,/membership_expires_at/,path);assert.match(line,/timezone/,path);assert.match(line,/state/,path)
  }
 }
})
