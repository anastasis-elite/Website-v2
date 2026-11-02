import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'
import { PGlite } from '@electric-sql/pglite'

const require = createRequire(import.meta.url)
const start = '2026-01-01T00:00:00Z', end = '2035-01-01T15:45:30Z'
const state = patch => ({ program: 'ember', price_id: 'price_emberSynthetic', status: 'incomplete', access: false, start, end, event_created: 100, cancelAtPeriodEnd: false, ...patch })
const provider = (status = 'active', price = 'price_igniteSynthetic') => ({ id: 'sub_reconciliation', status, cancel_at_period_end: false,
  current_period_start: Date.parse(start) / 1000, current_period_end: Date.parse(end) / 1000,
  items: { data: [{ quantity: 1, price: { id: price, type: 'recurring', recurring: { interval: 'month', interval_count: 1 } } }] } })
async function database() {
  const db = new PGlite()
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
    create table auth.users(id uuid primary key,email text);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;
    create table clients(client_id text primary key,email text,full_name text,program text,auth_user_id uuid,login_email text,
      onboarding_completed boolean default false,verified_purchase boolean default false,access boolean default false,active boolean default false,
      subscription_status text,subscription_started_at date,subscription_ends_at date,updated_at timestamptz default now());
    create table client_billing(id uuid primary key default gen_random_uuid(),client_id text references clients(client_id),stripe_customer_id text,stripe_subscription_id text,
      billing_type text,billing_status text,current_period_start timestamptz,current_period_end timestamptz,last_payment_date timestamptz,
      next_payment_date timestamptz,access_active boolean default false,cancel_at_period_end boolean default false,updated_at timestamptz default now());
    grant select,insert,update,delete on clients to service_role;
    insert into clients(client_id,program,auth_user_id,access,active) values('RECONCILE','ember','11111111-1111-4111-8111-111111111111',false,false);`)
  for (const file of ['20261101150000_launch_commerce_foundation.sql','20261101170500_subscription_reconciliation.sql']) await db.exec(readFileSync('supabase/migrations/' + file, 'utf8'))
  await db.exec(`insert into client_billing(client_id,stripe_subscription_id,billing_status,access_active) values('RECONCILE','sub_reconciliation','incomplete',false);set role service_role;`)
  return db
}
const rpc = (db, name, values) => db.query(`select ${name}(${values.map((_, i) => '$' + (i + 1)).join(',')}) result`, values).then(result => result.rows[0].result)
const sync = (db, value) => rpc(db,'sync_member_subscription_v3',['sub_reconciliation',value])
const claim = db => rpc(db,'claim_subscription_reconciliation',['sub_reconciliation'])
const commit = (db, lease, value) => rpc(db,'reconcile_member_subscription',['sub_reconciliation',lease.lease_token,lease.revision,value])
const snapshot = db => db.query("select c.program,c.access,c.subscription_status,c.membership_expires_at,b.last_subscription_event_created,b.subscription_sync_conflicted from clients c join client_billing b using(client_id) where c.client_id='RECONCILE'").then(result => result.rows[0])

test('fenced fresh same-second reconciliation converges, while busy/CAS/expired leases cannot grant and terminal/unknown states stay safe', async t => {
  const db = await database(); t.after(() => db.close())
  await sync(db,state({}))
  assert.equal((await sync(db,state({status:'active',access:true,program:'ignite',price_id:'price_igniteSynthetic'}))).conflict,true)
  const lease = await claim(db)
  assert.equal((await claim(db)).retry,true)
  // Another same-second delivery modifies the durable conflict after the read
  // fence was acquired. Its earlier provider snapshot must not pass CAS.
  await sync(db,state({status:'active',access:true}))
  assert.equal((await commit(db,lease,state({status:'active',access:true}))).retry,true)
  assert.equal((await snapshot(db)).access,false)
  const expired = await claim(db)
  await db.query("update subscription_reconciliation_leases set expires_at=clock_timestamp()-interval '1 second'")
  const renewed = await claim(db)
  assert.notEqual(renewed.lease_token,expired.lease_token)
  assert.equal((await commit(db,expired,state({status:'active',access:true}))).retry,true)
  assert.equal((await commit(db,renewed,state({status:'active',access:true,program:'ignite',price_id:'price_igniteSynthetic'}))).reconciled,true)
  const accepted = await snapshot(db)
  assert.equal(accepted.program,'ignite');assert.equal(accepted.access,true);assert.equal(accepted.subscription_sync_conflicted,false)
  assert.equal(Number(accepted.last_subscription_event_created),100,'Reconciliation must not manufacture a later event timestamp.')
  assert.equal(new Date(accepted.membership_expires_at).toISOString(),'2035-01-01T15:45:30.000Z')
  await sync(db,state({status:'active',access:true}))
  const unknown = await claim(db)
  await commit(db,unknown,state({status:'active',access:false,program:null,price_id:'price_unmapped'}))
  assert.equal((await snapshot(db)).access,false);assert.equal((await snapshot(db)).program,'ignite')
  await sync(db,state({status:'active',access:true,program:'phoenix',price_id:'price_phoenixSynthetic'}))
  const staleBeforeCancel = await claim(db)
  await sync(db,state({status:'canceled',access:false,event_created:101}))
  assert.equal((await commit(db,staleBeforeCancel,state({status:'active',access:true}))).retry,true)
  assert.equal((await snapshot(db)).subscription_status,'canceled');assert.equal((await snapshot(db)).access,false)
  assert.equal((await sync(db,state({status:'active',access:true,event_created:102}))).accepted,false)
  await db.exec('reset role;set role authenticated;')
  await assert.rejects(claim(db),/permission denied/)
  await assert.rejects(db.query('select * from subscription_reconciliation_leases'),/permission denied/)
})

function load(path, mocks, env) {
  const module = {exports:{}}
  const code = ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText
  vm.runInNewContext(code,{module,exports:module.exports,require:name=>name==='server-only'?{}:mocks[name]??require(name),process:{env},Date,Buffer,URL,Request,Response,console:{error(){}}})
  return module.exports
}
async function handlerFixture() {
  const db = await database()
  await sync(db,state({}))
  const env = {STRIPE_SECRET_KEY:'sk_test_synthetic',STRIPE_WEBHOOK_SECRET:'whsec_synthetic',PAYMENT_TEST_DATABASE_ISOLATED:'true',EMBER_SUB_PRICE:'price_emberSynthetic',IGNITE_SUB_PRICE:'price_igniteSynthetic',PHOENIX_SUB_PRICE:'price_phoenixSynthetic'}
  let releaseLedger
  const ledgerWritten = new Promise(resolve=>{releaseLedger=resolve})
  const seen = {order:[],reads:0,insertAttempts:0,initialLookups:0,read:async()=>provider(),lookupBarrier:null,injectCommit:null}
  class Stripe {
    webhooks={constructEvent(payload,signature){if(signature!=='valid')throw Error('Signature');return JSON.parse(payload)}}
    subscriptions={retrieve:async()=>{seen.order.push('provider');return seen.read(++seen.reads)}}
  }
  const admin = {from(table){
    assert.equal(table,'stripe_webhook_events');let id
    return {select(){return this},eq(_key,value){id=value;return this},async maybeSingle(){
      const found=(await db.query('select event_id from stripe_webhook_events where event_id=$1',[id])).rows[0]||null
      if(seen.lookupBarrier)await seen.lookupBarrier(++seen.initialLookups)
      return {data:found,error:null}
    },async insert(row){seen.insertAttempts++
      const result=await db.query('insert into stripe_webhook_events(event_id,event_type,payload) values($1,$2,$3) on conflict do nothing returning event_id',[row.event_id,row.event_type,row.payload])
      releaseLedger();return {error:result.rows.length?null:{code:'23505'}}
    }}
  },async rpc(name,args){
    seen.order.push(name)
    if(name==='reconcile_member_subscription'&&seen.injectCommit)await seen.injectCommit()
    const values=name==='sync_member_subscription_v3'?[args.p_subscription_id,args.p_state]
      :name==='claim_subscription_reconciliation'?[args.p_subscription_id]
      :name==='reconcile_member_subscription'?[args.p_subscription_id,args.p_lease_token,args.p_expected_revision,args.p_state]
      :name==='release_subscription_reconciliation'?[args.p_subscription_id,args.p_lease_token]:null
    assert.ok(values,'Unexpected reconciliation RPC')
    try{return {data:await rpc(db,name,values),error:null}}catch(error){return {data:null,error:{message:error.message}}}
  }}
  const catalog=load('lib/commerce/catalog.ts',{},env)
  const fulfillment=load('lib/commerce/fulfillment.ts',{'@/lib/commerce/catalog':catalog},env)
  const route=load('app/api/webhooks/stripe/route.ts',{
    stripe:Stripe,'next/server':{NextResponse:{json:(data,init)=>Response.json(data,init)}},
    '@/lib/supabase/admin':{createAdminClient:()=>admin},'@/lib/commerce/fulfillment':fulfillment,
    '@/lib/commerce/environment':load('lib/commerce/environment.ts',{},env),
    '@/lib/commerce/invitationDelivery':{deliverPurchaseInvitation:async()=>assert.fail('No purchase invitation in subscription reconciliation')},
  },env)
  const event={id:'evt_same_second',type:'customer.subscription.updated',livemode:false,created:100,data:{object:{id:'sub_reconciliation'}}}
  const send=()=>route.POST(new Request('https://synthetic.test/webhook',{method:'POST',headers:{'stripe-signature':'valid'},body:JSON.stringify(event)}))
  return {db,seen,send,ledgerWritten}
}

test('the actual webhook fetches after the lease and commits current equal-second tier/status without an unrelated event',async t=>{
  const f=await handlerFixture();t.after(()=>f.db.close())
  f.seen.read=async count=>count===1?provider('active','price_igniteSynthetic'):provider('active','price_phoenixSynthetic')
  assert.equal((await f.send()).status,200)
  const saved=await snapshot(f.db)
  assert.equal(saved.program,'phoenix');assert.equal(saved.subscription_status,'active');assert.equal(saved.access,true)
  assert.equal(Number(saved.last_subscription_event_created),100)
  assert.ok(f.seen.order.indexOf('claim_subscription_reconciliation')<f.seen.order.lastIndexOf('provider'))
  assert.equal(f.seen.reads,2);assert.equal(f.seen.insertAttempts,1)
  assert.equal((await f.send()).status,200)
  assert.equal(f.seen.reads,2,'An already reconciled duplicate does not fetch the provider again.')
})

test('same-ID concurrent success plus conflicting failed retrieval remains repairable through the processed-event retry',async t=>{
  const f=await handlerFixture();t.after(()=>f.db.close())
  let releaseLookups
  const bothLooked=new Promise(resolve=>{releaseLookups=resolve})
  f.seen.lookupBarrier=async count=>{if(count===2)releaseLookups();await bothLooked}
  f.seen.read=async count=>{
    if(count===1)return provider('incomplete','price_emberSynthetic')
    if(count===3){await f.ledgerWritten;throw Error('Synthetic provider failure during fresh reconciliation')}
    return provider('active','price_igniteSynthetic')
  }
  const responses=await Promise.all([f.send(),f.send()])
  assert.deepEqual(responses.map(response=>response.status).sort(),[200,500])
  assert.equal(f.seen.insertAttempts,1,'The failed delivery must not acknowledge its conflicting state.')
  assert.equal((await snapshot(f.db)).subscription_sync_conflicted,true)
  assert.equal((await snapshot(f.db)).access,false)
  const retried=await f.send()
  assert.equal(retried.status,200);assert.equal((await retried.json()).duplicate,true)
  const repaired=await snapshot(f.db)
  assert.equal(repaired.subscription_status,'active');assert.equal(repaired.program,'ignite');assert.equal(repaired.access,true)
  assert.equal(repaired.subscription_sync_conflicted,false)
  assert.equal(Number(repaired.last_subscription_event_created),100)
  assert.equal((await f.db.query('select count(*)::int n from stripe_webhook_events')).rows[0].n,1)
  assert.equal(f.seen.insertAttempts,1);assert.equal(f.seen.reads,4)
})

test('a changed CAS fence returns a retryable webhook response before ledger success and the same event can recover',async t=>{
  const f=await handlerFixture();t.after(()=>f.db.close())
  f.seen.injectCommit=async()=>{f.seen.injectCommit=null;await sync(f.db,state({status:'past_due',access:false,event_created:101}))}
  assert.equal((await f.send()).status,500)
  assert.equal(f.seen.insertAttempts,0)
  assert.equal((await snapshot(f.db)).access,false)
  // The provider remains active; a retry reads that current state, while the
  // actual recorded event high-water remains101 rather than a fabricated value.
  const retryEventState=await snapshot(f.db)
  assert.equal(Number(retryEventState.last_subscription_event_created),101)
  assert.equal((await f.send()).status,200)
  assert.equal((await snapshot(f.db)).access,true)
  assert.equal(Number((await snapshot(f.db)).last_subscription_event_created),101)
})
