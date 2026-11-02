import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import { importTs } from './typescriptModule.mjs'

const server=await importTs('lib/analytics/server.ts')
const context=await importTs('lib/analytics/checkoutContext.ts')
const user='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222'
const browser='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',journey='anonymous_'+browser
const stamp='2026-11-01T15:00:00.000Z'
const hash=id=>'member_'+createHash('sha256').update(`anastasis-analytics-v1:${id}`).digest('hex')
async function database(){
  const db=new PGlite()
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated,service_role;
    create table clients(client_id text primary key,auth_user_id uuid,onboarding_completed boolean default false);
    create table workout_logs(id uuid default gen_random_uuid(),client_id text,completed boolean default false);
    create table recovery_activity_logs(id uuid default gen_random_uuid(),client_id text);
    create table nutrition_logs(id uuid primary key,client_id text);
    create table meal_entries(id uuid default gen_random_uuid(),nutrition_log_id uuid,entry_state text);
    create table macro_entries(id uuid default gen_random_uuid(),nutrition_log_id uuid,calories numeric,protein_g numeric,carbs_g numeric,fat_g numeric);
    create table client_billing(client_id text,stripe_subscription_id text,membership_program text,billing_status text,access_active boolean,last_subscription_event_created bigint default 0);
    create table checkout_purchases(session_id text primary key,client_id text,purchased_at timestamptz,fulfilled_at timestamptz default now());
    insert into auth.users values('${user}'),('${other}');insert into clients(client_id) values('pending');`)
  for(const path of ['20261101152000_analytics_conversion_receipts.sql','20261101153000_analytics_consent_attribution.sql'])await db.exec(readFileSync('supabase/migrations/'+path,'utf8'))
  return db
}
const rows=(db,sql,args)=>db.query(sql,args).then(result=>result.rows)
const consent=(db,accepted,revision,userId=null,client=browser,trip=journey)=>db.query('select record_analytics_consent_v2($1::uuid,$2,$3::bigint,$4::uuid,$5)',[userId,accepted,revision,client,accepted?trip:null])
const saveContext=(db,session='cs_test_guest',accepted=true,revision=100)=>db.query('select save_checkout_analytics_context($1,$2::uuid,$3::bigint,$4,$5)',[session,browser,revision,accepted?journey:null,accepted])

test('a later withdrawal wins reordered accept requests at browser and member boundaries',async()=>{
  const db=await database()
  try{
    await consent(db,false,102,user)
    await consent(db,true,101,user)
    await consent(db,true,102,user)
    assert.deepEqual(await rows(db,'select accepted,revision::integer as revision from analytics_browser_consent'),[{accepted:false,revision:102}])
    assert.deepEqual(await rows(db,'select accepted,revision::integer as revision from analytics_member_consent'),[{accepted:false,revision:102}])
    await consent(db,true,103,user)
    assert.equal((await rows(db,'select accepted from analytics_member_consent'))[0].accepted,true)
    await db.exec('set role authenticated;')
    await assert.rejects(db.query('select record_analytics_consent_v2($1::uuid,true,104,$2::uuid,$3)',[other,browser,journey]),/permission denied/)
    await assert.rejects(db.query('select set_analytics_consent(true)'),/permission denied/)
  }finally{await db.close()}
})

test('a consented paid guest is captured without a return page and first verified binding preserves activation identity',async()=>{
  const db=await database()
  try{
    await consent(db,true,100)
    await saveContext(db)
    await db.exec(`insert into client_billing values('pending','sub_guest','ignite','active',true,1);
      insert into checkout_purchases(session_id,client_id,purchased_at) values('cs_test_guest','pending',now()-interval '1 minute');`)
    const before=(await rows(db,"select * from analytics_conversion_receipts where event='subscription_activated'"))[0]
    assert.equal(before.user_id,null);assert.equal(before.distinct_id,journey);assert.equal(before.eligible,true)
    await db.exec(`update clients set auth_user_id='${user}' where client_id='pending';`)
    const after=(await rows(db,"select * from analytics_conversion_receipts where event='subscription_activated'"))[0]
    assert.equal(after.user_id,user);assert.equal(after.id,before.id);assert.equal(after.distinct_id,before.distinct_id);assert.deepEqual(after.occurred_at,before.occurred_at)
    assert.equal((await rows(db,'select accepted from analytics_member_consent'))[0].accepted,true)
    const link=(await rows(db,"select * from analytics_conversion_receipts where event='analytics_identity_linked'"))[0]
    assert.equal(link.distinct_id,hash(user));assert.equal(link.journey_id,journey)
    await db.exec(`update client_billing set last_subscription_event_created=2 where client_id='pending';`)
    assert.equal((await rows(db,"select count(*)::integer as total from analytics_conversion_receipts where event='subscription_activated'"))[0].total,1)
    await db.exec('set role service_role;')
    assert.equal((await rows(db,'select * from claim_analytics_conversions(null,10)')).length,2)
  }finally{await db.close()}
})

test('declined or absent guest consent never becomes a retroactive activation during later signup',async()=>{
  for(const mode of ['declined','absent','withdrawn']){
    const db=await database()
    try{
      if(mode!=='absent'){await consent(db,mode==='withdrawn',100);await saveContext(db,'cs_test_guest',mode==='withdrawn')}
      if(mode==='withdrawn')await consent(db,false,101)
      await db.exec(`insert into client_billing values('pending','sub_guest','ember','active',true,1);
        insert into checkout_purchases(session_id,client_id,purchased_at) values('cs_test_guest','pending',now()-interval '1 minute');`)
      const fresh='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
      await consent(db,true,102,user,fresh,'anonymous_'+fresh)
      await db.exec(`update clients set auth_user_id='${user}' where client_id='pending';`)
      const activation=(await rows(db,"select * from analytics_conversion_receipts where event='subscription_activated'"))[0]
      assert.equal(activation.eligible,false,mode)
      await db.exec('set role service_role;')
      assert.equal((await rows(db,'select * from claim_analytics_conversions(null,10)')).some(row=>row.event==='subscription_activated'),false,mode)
    }finally{await db.close()}
  }
})

test('withdrawal after payment blocks an in-flight receipt; journey ownership cannot bridge another account',async()=>{
  const db=await database()
  try{
    await consent(db,true,100)
    await saveContext(db)
    await db.exec(`insert into client_billing values('pending','sub_guest','ember','active',true,1);
      insert into checkout_purchases(session_id,client_id,purchased_at) values('cs_test_guest','pending',now()-interval '1 minute');set role service_role;`)
    const claimed=await rows(db,'select * from claim_analytics_conversions(null,10)')
    assert.equal(claimed.length,1)
    await db.exec('reset role;')
    await consent(db,false,101)
    await db.exec('set role service_role;')
    assert.deepEqual((await db.query('select validate_analytics_delivery($1::uuid[],$2::uuid) as allowed',[[claimed[0].id],claimed[0].claim_token])).rows[0].allowed,[])
    await db.query('select ack_analytics_conversions($1::uuid[],$2::uuid)',[[claimed[0].id],claimed[0].claim_token])
    assert.equal((await rows(db,'select delivered_at from analytics_conversion_receipts'))[0].delivered_at,null)
    await db.exec('reset role;')
    await consent(db,true,102,user)
    assert.equal((await consent(db,true,103,other)).rows[0].record_analytics_consent_v2,false)
    assert.equal((await rows(db,'select user_id from analytics_journeys'))[0].user_id,user)
  }finally{await db.close()}
})

test('ingestion retries reuse top-level uuid, distinct_id, event and original timestamp after a lost acknowledgement',async()=>{
  const oldKey=process.env.NEXT_PUBLIC_POSTHOG_KEY;process.env.NEXT_PUBLIC_POSTHOG_KEY='synthetic-only'
  const receipt={id:browser,event:'subscription_activated',occurred_at:stamp,distinct_id:journey,journey_id:journey,user_id:null,claim_token:user,properties:{tier:'ignite'}}
  const payloads=[]
  const admin={async rpc(name){return name==='claim_analytics_conversions'?{data:[receipt],error:null}:name==='validate_analytics_delivery'?{data:[receipt.id],error:null}:{error:{message:'Lost acknowledgement'}}}}
  const transport=async(_url,options)=>{payloads.push(JSON.parse(options.body).batch[0]);return{ok:true}}
  try{
    await server.deliverPendingConversions(admin,{allowTest:true,transport});await server.deliverPendingConversions(admin,{allowTest:true,transport})
    assert.equal(payloads.length,2)
    for(const field of ['uuid','distinct_id','event','timestamp'])assert.deepEqual(payloads[0][field],payloads[1][field])
    assert.equal(payloads[0].uuid,browser);assert.equal(payloads[0].distinct_id,journey);assert.equal(payloads[0].timestamp,stamp)
    assert.equal(payloads[0].properties.journey_id,journey)
  }finally{if(oldKey===undefined)delete process.env.NEXT_PUBLIC_POSTHOG_KEY;else process.env.NEXT_PUBLIC_POSTHOG_KEY=oldKey}
})

test('a withdrawal between claiming and transport prevents provider capture',async()=>{
  const oldKey=process.env.NEXT_PUBLIC_POSTHOG_KEY;process.env.NEXT_PUBLIC_POSTHOG_KEY='synthetic-only'
  const receipt={id:browser,event:'subscription_activated',occurred_at:stamp,distinct_id:journey,journey_id:journey,user_id:null,claim_token:user,properties:{tier:'ignite'}}
  let sends=0
  const admin={async rpc(name){return name==='claim_analytics_conversions'?{data:[receipt],error:null}:{data:[],error:null}}}
  try{assert.equal(await server.deliverPendingConversions(admin,{allowTest:true,transport:async()=>{sends++;return{ok:true}}}),false);assert.equal(sends,0)}
  finally{if(oldKey===undefined)delete process.env.NEXT_PUBLIC_POSTHOG_KEY;else process.env.NEXT_PUBLIC_POSTHOG_KEY=oldKey}
})

test('checkout and verified binding context contains only validated consent and pseudonymous correlation fields',async()=>{
  const calls=[];const admin={async rpc(name,args){calls.push({name,args});return{data:true,error:null}}}
  const value={accepted:true,revision:100,clientId:browser,journeyId:journey,email:'excluded@example.test',answers:'excluded'}
  const request=new Request('https://local.test',{headers:{cookie:'analytics_context='+encodeURIComponent(JSON.stringify(value))}})
  await context.saveCheckoutAnalytics(admin,request,'cs_test_synthetic')
  await context.bindAnalyticsOwner(admin,request,user)
  assert.equal(calls[0].name,'record_analytics_consent_v2');assert.equal(calls[1].name,'save_checkout_analytics_context')
  assert.equal(calls[2].args.p_user_id,user)
  assert.doesNotMatch(JSON.stringify(calls),/excluded|answers|email/)
  assert.equal(context.validateAnalyticsContext({...value,revision:NaN}),null)
  assert.equal(context.validateAnalyticsContext({...value,journeyId:'member_'+user}),null)
})
