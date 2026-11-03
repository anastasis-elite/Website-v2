import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { importTs } from './typescriptModule.mjs'

const route = await importTs('app/api/health/apple-export/route.ts', {
  'next/server': 'export const NextResponse={json:(body,options)=>Response.json(body,options)}',
  '@/lib/supabase/server': 'export const createClient=async()=>globalThis.appleExportDb',
})
const date='2026-11-01', timezone='America/New_York'
const record={metric:'heart_rate',value:72,unit:'count/min',startAt:'2026-11-01T05:30:00.000Z',endAt:'2026-11-01T05:30:00.000Z',creationAt:'2026-11-01T07:00:00.000Z',sourceName:'Synthetic Watch',sourceVersion:'1',sourceDevice:'Synthetic device'}
const body=patch=>({date,timezone,records:[structuredClone(record)],...patch})
const headers={origin:'https://anastasis.test','content-type':'application/json','sec-fetch-site':'same-origin','x-expected-client-id':'OWN','x-expected-user-id':'owner'}
const post=(value=body(),patch={})=>new Request('https://anastasis.test/api/health/apple-export',{method:'POST',headers:{...headers,...patch},body:typeof value==='string'?value:JSON.stringify(value)})
const get=(query=`date=${date}&timezone=${encodeURIComponent(timezone)}`,patch={})=>new Request('https://anastasis.test/api/health/apple-export?'+query,{headers:{...headers,...patch}})
function fixture({program='ignite',expired=false,signedIn=true,verified=true,foreign=false}={}){
  const client={client_id:'OWN',auth_user_id:foreign?'other':'owner',program,access:true,active:true,verified_purchase:true,membership_expires_at:expired?'2020-01-01T00:00:00Z':'2099-01-01T00:00:00Z'}
  const state={lookups:[],calls:[],rows:new Map(),receipts:new Map(),error:null,reply:null,client}
  globalThis.appleExportDb={auth:{getUser:async()=>({data:{user:signedIn?{id:'owner',email_confirmed_at:verified?'2026-01-01':null}:null},error:null})},from(table){assert.equal(table,'clients');return{select(){return this},eq(key,value){state.lookups.push([key,value]);return this},maybeSingle:async()=>({data:client,error:null})}},async rpc(name,args){
    state.calls.push({name,args:structuredClone(args)});if(state.error)return{error:state.error};if(state.reply)return{data:state.reply,error:null}
    if(name==='import_health_export_review_batch'){
      let imported=0;for(const value of args.p_records){const key=JSON.stringify(value);if(!state.rows.has(key)){state.rows.set(key,{...value,importedAt:'2026-11-02T00:00:00Z'});imported++}}
      const key=JSON.stringify([args.p_date,args.p_timezone,args.p_records]),replayed=state.receipts.has(key)
      if(!replayed)state.receipts.set(key,{id:'11111111-1111-4111-8111-111111111111',date:args.p_date,timezone:args.p_timezone,inputCount:args.p_records.length,imported,alreadyPresent:args.p_records.length-imported,confirmedAt:'2026-11-02T00:00:00Z'})
      return{data:{imported,alreadyPresent:args.p_records.length-imported,replayed,receipt:state.receipts.get(key)},error:null}
    }
    assert.equal(name,'get_health_export_review_day');const rows=[...state.rows.values()],counts={heart_rate:rows.filter(row=>row.metric==='heart_rate').length,resting_heart_rate:rows.filter(row=>row.metric==='resting_heart_rate').length}
    return{data:{records:rows.slice(args.p_offset,args.p_offset+100),total:rows.length,counts,range:rows.length?{startAt:rows[0].startAt,endAt:rows.at(-1).endAt}:null,receipts:[...state.receipts.values()].slice(-10)},error:null}
  }};return state
}

test('health export mutations and reads derive a verified active owner, with Tracker permitted and Free/unknown/expired/foreign denied',async()=>{
  for(const options of [{signedIn:false},{verified:false},{program:'free'},{program:'unknown'},{expired:true},{foreign:true}]){
    const state=fixture(options);assert.ok([401,403].includes((await route.POST(post())).status));assert.equal(state.calls.length,0)
    assert.ok([401,403].includes((await route.GET(get())).status));assert.equal(state.calls.length,0)
  }
  for(const program of ['tracker','ember','ignite','phoenix']){
    const state=fixture({program});const result=await route.POST(post());assert.equal(result.status,200)
    const data=await result.json();assert.equal(data.success,true);assert.equal(data.imported,1);assert.equal(data.alreadyPresent,0);assert.equal(data.replayed,false);assert.equal(data.receipt.imported,1)
    assert.deepEqual(state.lookups,[['auth_user_id','owner']]);assert.equal(state.calls[0].args.p_client_id,'OWN')
    assert.equal(result.headers.get('cache-control'),'private, no-store')
  }
})

test('same-origin JSON and preview account binding reject CSRF and stale account changes before any mutation',async()=>{
  for(const patch of [{origin:'https://foreign.test'},{origin:''},{'sec-fetch-site':'cross-site'},{'sec-fetch-site':'same-site'}]){
    const state=fixture();assert.equal((await route.POST(post(body(),patch))).status,403);assert.equal(state.lookups.length,0);assert.equal(state.calls.length,0)
  }
  let state=fixture();assert.equal((await route.POST(post(body(),{'content-type':'text/plain'}))).status,415);assert.equal(state.calls.length,0)
  for(const patch of [{'x-expected-client-id':'OTHER'},{'x-expected-user-id':'other'},{'x-expected-client-id':''}]){
    state=fixture();let result=await route.POST(post(body(),patch));assert.equal(result.status,409);assert.equal((await result.json()).code,'ACCOUNT_CHANGED');assert.equal(state.calls.length,0)
    result=await route.GET(get(undefined,patch));assert.equal(result.status,409);assert.equal(state.calls.length,0)
  }
})

test('only exact preview records are accepted, without owner/provenance/metric/unit/date or arbitrary metadata injection',async()=>{
  const invalid=[body({clientId:'OTHER'}),body({userId:'other'}),body({provenance:'verified'}),body({date:'2026-02-30'}),body({timezone:'bad/zone'}),body({records:[]}),body({records:Array.from({length:101},()=>record)})]
  for(const patch of [{user_id:'other'},{dedupe_key:'forged'},{provider:'apple_health'},{metadata:{verified:true}},{metric:'steps'},{unit:'bpm'},{value:0},{value:-1},{value:null},{value:Number.MAX_VALUE},{sourceName:''},{sourceDevice:'x'.repeat(1001)},{startAt:'2026-11-02T05:00:00.000Z'},{startAt:'2026-11-01T01:30:00'},{endAt:'2026-11-01T05:29:00.000Z'}]) invalid.push(body({records:[{...record,...patch}]}))
  for(const value of invalid){const state=fixture();assert.equal((await route.POST(post(value))).status,400);assert.equal(state.calls.length,0)}
})

test('actual streamed byte limits reject oversized batches even without a declared length, and malformed bodies never write',async()=>{
  let state=fixture();let result=await route.POST(post('x'.repeat(131073)));assert.equal(result.status,413);assert.equal(state.calls.length,0)
  state=fixture();result=await route.POST(post(body(),{'content-length':'131073'}));assert.equal(result.status,413);assert.equal(state.calls.length,0)
  for(const text of ['null','[]','{','{"date":"2026-11-01","timezone":"UTC","records":[{"value":1e999}]}']){state=fixture();assert.equal((await route.POST(post(text))).status,400);assert.equal(state.calls.length,0)}
})

test('confirmed bounded batches retry idempotently, expose counts after reload and never call native integration/aggregate paths',async()=>{
  const state=fixture(),before=structuredClone(state.client)
  assert.equal((await route.POST(post())).status,200)
  const replay=await route.POST(post());const repeated=await replay.json();assert.equal(repeated.imported,0);assert.equal(repeated.alreadyPresent,1);assert.equal(repeated.replayed,true);assert.equal(repeated.receipt.imported,1);assert.equal(repeated.receipt.alreadyPresent,0)
  const second={...record,startAt:'2026-11-01T06:30:00.000Z',endAt:'2026-11-01T06:30:00.000Z'}
  await route.POST(post(body({records:[second]})))
  const saved=await route.GET(get());assert.equal(saved.status,200);const payload=await saved.json()
  assert.equal(payload.total,2);assert.deepEqual(payload.counts,{heart_rate:2,resting_heart_rate:0});assert.equal(payload.records.length,2)
  assert.equal(payload.provenance,'Apple Health export; user imported');assert.equal(payload.nextCursor,null);assert.equal(payload.receipts.length,2);assert.equal(payload.receipts[0].imported,1)
  assert.ok(state.calls.every(call=>['get_health_export_review_day','import_health_export_review_batch'].includes(call.name)))
  assert.deepEqual(state.client,before)
  const source=readFileSync('app/api/health/apple-export/route.ts','utf8')
  assert.doesNotMatch(source,/health_samples|daily_health_metrics|completeHealthSync|upsertHealthIntegration|console\.|trackEvent|recordConversion/)
})

test('failed and unconfirmed saves remain explicit and retryable without leaking provider/database details',async()=>{
  const state=fixture();state.error={message:'Synthetic private SQL data'}
  let response=await route.POST(post());assert.equal(response.status,503);let payload=await response.json();assert.match(payload.error,/not confirmed/);assert.doesNotMatch(payload.error,/private SQL/)
  state.error=null;state.reply={imported:1,alreadyPresent:1};assert.equal((await route.POST(post())).status,503)
  state.reply={imported:-1,alreadyPresent:2};assert.equal((await route.POST(post())).status,503)
  state.reply=null;state.error={code:'42501',message:'raw permission details'};assert.equal((await route.POST(post())).status,403)
  response=await route.GET(get());assert.equal(response.status,503);assert.doesNotMatch(JSON.stringify(await response.json()),/raw permission/)
})

test('review pagination is bounded and rejects caller-selected owners or invalid response records',async()=>{
  const state=fixture();for(const query of ['date=2026-11-01&timezone=UTC&userId=other','date=2026-11-01&date=2026-11-02&timezone=UTC','date=2026-11-01&timezone=UTC&cursor=-1','date=2026-11-01&timezone=UTC&cursor=1000001'])assert.equal((await route.GET(get(query))).status,400)
  assert.equal(state.calls.length,0)
  state.reply={receipts:[],total:101,counts:{heart_rate:101,resting_heart_rate:0},range:{startAt:record.startAt,endAt:record.endAt},records:Array.from({length:100},()=>({...record,importedAt:'2026-11-02T00:00:00Z'}))}
  let result=await route.GET(get());assert.equal(result.status,200);assert.equal((await result.json()).nextCursor,'100')
  state.reply.records[0].metadata={never:'return'};assert.equal((await route.GET(get())).status,503)
})
