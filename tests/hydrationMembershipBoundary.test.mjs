import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'

const mocks = {
  'next/server': 'export const NextResponse={json:(body,init)=>Response.json(body,init)}',
  '@/lib/supabase/server': 'export const createClient=async()=>globalThis.hydrationBoundary.db',
  '@/lib/timezone': 'export const getClientLocalDate=()=>"2026-11-01"',
  '@/lib/dashboard/invalidateDailyPlan': 'export const invalidateDailyPlan=()=>{}',
  '@/lib/nutrition/targetService': `
    export const calculateClientNutritionTargets=async()=>{globalThis.hydrationBoundary.targetCalls++;return {water:96,target:{calories:1800,protein:120,carbs:180,fats:60},weightLbs:160}};
    export const normalizeCyclePhase=value=>value;
    export const nutritionLogAuditFields=()=>({});`,
}
const hydration = await importTs('app/api/nutrition/hydration/route.ts', mocks)
const water = await importTs('app/api/nutrition/add-water/route.ts', mocks)
const { capabilityForPath, membershipCan } = await importTs('lib/membership/policy.ts')
const day = '2026-11-01', owner = 'synthetic-owner'
const submissionId = '60000000-0000-4000-8000-000000000001'
const get = clientId => hydration.GET(new Request(`https://synthetic.invalid/api/nutrition/hydration?clientId=${clientId || 'owned'}&logDate=${day}`))
const add = () => water.POST(new Request('https://synthetic.invalid/api/nutrition/add-water', { method:'POST', body:JSON.stringify({clientId:'owned',logDate:day,ounces:8,submissionId}) }))

function fixture(program, { expired=false, saved=true, signedIn=true, foreign=false, target=88 }={}) {
  const client = { client_id:'owned',auth_user_id:foreign?'another-owner':owner,program,access:true,active:true,membership_expires_at:expired?'2020-01-01T00:00:00Z':'2035-01-01T17:45:30Z',timezone:'Etc/UTC' }
  const log = { id:'owned-log',client_id:'owned',auth_user_id:owner,log_date:day,water_oz:target,water_consumed_oz:16,updated_at:'2026-11-01T10:00:00Z',
    calories:1800,protein:120,carbs:200,fats:55,meals:[{name:'stored premium meal'}],sodium_target_mg:2000,iron:12,nutrition_calculation:{bmi:23},coaching:'stored recommendation' }
  const state = { targetCalls:0,reads:[],rpcCalls:[],writes:0,client,log }
  const receipts = new Set()
  state.db = {
    auth:{getUser:async()=>({data:{user:signedIn?{id:owner,email_confirmed_at:'2026-01-01T00:00:00Z'}:null},error:null})},
    from(table) {
      const filters = [], call = {table,columns:null,filters:[]}; state.reads.push(call)
      const query = {
        select(columns) { call.columns=columns; return query },
        eq(key,value) { call.filters.push([key,value]);filters.push(row=>row[key]===value);return query },
        maybeSingle:async()=>({data:(table==='clients'?[client]:table==='nutrition_logs'&&saved?[log]:[]).filter(row=>filters.every(filter=>filter(row)))[0]||null,error:null}),
      }
      return query
    },
    async rpc(name,args) {
      state.rpcCalls.push({name,args})
      assert.ok(['record_tracker_nutrition','add_daily_water'].includes(name))
      const requestId=args.p_request_id||args.p_submission_id
      if(!receipts.has(requestId)) { receipts.add(requestId);log.water_consumed_oz+=args.p_values?.waterOz||args.p_ounces;state.writes++ }
      return {data:structuredClone(log),error:null}
    },
  }
  globalThis.hydrationBoundary=state
  return state
}

test('Tracker, Free, expired and unknown callers cannot obtain or generate personalized hydration targets',async()=>{
  for(const [program,expired] of [['tracker',false],['free',false],['ember',true],['tracker',true],[null,false],['unknown',false]]) {
    for(const saved of [true,false]) {
      const state=fixture(program,{expired,saved}),response=await get(),body=await response.json()
      assert.equal(response.status,403)
      assert.deepEqual(Object.keys(body),['error'])
      assert.equal(state.targetCalls,0);assert.equal(state.reads.some(read=>read.table==='nutrition_logs'),false);assert.equal(state.writes,0)
      assert.equal(response.headers.get('cache-control'),'private, no-store')
    }
  }
})

test('hydration targets remain authenticated and bound to the actual client owner',async()=>{
  for(const [options,status] of [[{signedIn:false},401],[{foreign:true},404]]) {
    const state=fixture('ignite',options),response=await get()
    assert.equal(response.status,status);assert.equal(state.targetCalls,0);assert.equal(state.rpcCalls.length,0)
  }
})

test('all paid tiers retain saved targets and read-only first-day target generation',async()=>{
  for(const tier of ['ember','ignite','phoenix']) {
    for(const saved of [true,false]) {
      const state=fixture(tier,{saved}),response=await get(),body=await response.json()
      assert.equal(response.status,200)
      assert.deepEqual(body,{clientId:'owned',logDate:day,target:saved?88:96,consumed:saved?16:0})
      assert.equal(state.targetCalls,saved?0:1);assert.equal(state.writes,0)
      assert.deepEqual(state.reads[0].filters,[['client_id','owned'],['auth_user_id',owner]])
    }
  }
})

test('Tracker water saves and retries preserve manual actuals without target-engine calls or coaching output',async()=>{
  const state=fixture('tracker')
  for(let attempt=0;attempt<2;attempt++) {
    const response=await add(),body=await response.json()
    assert.equal(response.status,200);assert.equal(body.success,true)
    assert.deepEqual(body.nutritionLog,{id:'owned-log',client_id:'owned',log_date:day,water_consumed_oz:24,updated_at:'2026-11-01T10:00:00Z'})
    assert.equal(state.targetCalls,0)
    assert.deepEqual(state.rpcCalls[attempt],{name:'record_tracker_nutrition',args:{p_client_id:'owned',p_request_id:submissionId,p_log_date:day,p_values:{waterOz:8}}})
  }
  assert.equal(state.writes,1)
  assert.equal(state.reads.every(read=>read.table==='clients'),true)
})

test('Free, expired and unknown water writes stop before any RPC or coaching calculation',async()=>{
  for(const [program,expired] of [['free',false],['tracker',true],['ignite',true],[null,false],['unknown',false]]) {
    const state=fixture(program,{expired}),response=await add(),body=await response.json()
    assert.equal(response.status,403);assert.deepEqual(Object.keys(body),['error'])
    assert.equal(state.rpcCalls.length,0);assert.equal(state.targetCalls,0);assert.equal(state.writes,0)
  }
})

test('paid water saves retain their existing targets and use the paid save RPC',async()=>{
  for(const tier of ['ember','ignite','phoenix']) {
    const state=fixture(tier),response=await add(),body=await response.json()
    assert.equal(response.status,200);assert.equal(body.nutritionLog.water_oz,88);assert.equal(body.nutritionLog.water_consumed_oz,24)
    assert.equal(state.rpcCalls[0].name,'add_daily_water');assert.equal(state.targetCalls,0)
  }
})

test('the target read and manual water write have distinct middleware capability requirements',()=>{
  const tracker=fixture('tracker').client
  assert.equal(capabilityForPath('/api/nutrition/hydration'),'generatedCoaching')
  assert.equal(membershipCan(tracker,capabilityForPath('/api/nutrition/hydration')),false)
  assert.equal(capabilityForPath('/api/nutrition/add-water','POST'),'nutritionTracking')
  assert.equal(membershipCan(tracker,capabilityForPath('/api/nutrition/add-water','POST')),true)
})
