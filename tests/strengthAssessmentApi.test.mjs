import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { importTs } from './typescriptModule.mjs'
const mocks = {
  'next/server': 'export const NextResponse = { json: (body, init) => Response.json(body, init) }',
  '@/lib/supabase/server': 'export const createClient = async () => globalThis.strengthApiDb',
  '@/lib/dashboard/invalidateDailyPlan': 'export const invalidateDailyPlan = () => {}',
}
for(const [,path] of readFileSync('lib/program/generateProgram.ts','utf8').matchAll(/from '(@\/[^']+\.json)'/g)) mocks[path]=`export default ${readFileSync(path.slice(2),'utf8')}`
const route=await importTs('app/api/assessment-strength/route.ts',mocks)
const owner='qa-owner', clientId='QA-STRENGTH'
function database({signedIn=true,failTable=null}={}) {
  const period=new Date().toLocaleDateString('en-CA',{timeZone:'America/Chicago'}).slice(0,7)+'-01'
  const tables={clients:[{client_id:clientId,auth_user_id:owner,timezone:'America/Chicago',program:'ember'}],assessments:[],strength_assessment_sessions:[],client_current_profiles:[]}
  const calls=[]
  const db={tables,calls,period,auth:{getUser:async()=>({data:{user:signedIn?{id:owner}:null},error:null})},from(table){
    const filters=[];let sort,size
    const q={select(){return q},eq(k,v){filters.push(r=>r[k]===v);return q},lt(k,v){filters.push(r=>r[k]<v);return q},order(k,{ascending=true}={}){sort=[k,ascending];return q},limit(v){size=v;return q},or(expression){
      const [periodValue]=expression.match(/assessment_period\.eq\.([^,]+)/).slice(1)
      const start=expression.match(/submitted_at\.gte\.([^,]+)/)[1],end=expression.match(/submitted_at\.lt\.([^)]*)/)[1]
      filters.push(r=>r.assessment_period===periodValue || !r.assessment_period&&r.submitted_at>=start&&r.submitted_at<end);return q
    },single:async()=>run(true),maybeSingle:async()=>run(true),then(resolve){return Promise.resolve(run()).then(resolve)}}
    function run(single=false){if(table===failTable)return{data:null,error:{message:'private SQL details'}};let rows=(tables[table]||[]).filter(r=>filters.every(f=>f(r)));if(sort){const[k,a]=sort;rows=[...rows].sort((x,y)=>String(x[k]).localeCompare(String(y[k]))*(a?1:-1))}if(size)rows=rows.slice(0,size);return{data:single?rows[0]||null:rows,error:null}}
    return q
  },async rpc(name,args){calls.push({name,args});return{data:{success:true,assessment:{period:args.p_period,status:'draft',values:args.p_values,revision:args.p_expected_revision+1,saved_at:'2026-10-16T18:00:00Z',completed_at:null,assessment_id:null}},error:null}}}
  globalThis.strengthApiDb=db;return db
}
const get=(query='')=>new Request(`http://qa.test/api/assessment-strength${query}`)
const put=body=>new Request('http://qa.test/api/assessment-strength',{method:'PUT',body:JSON.stringify(body)})

test('authenticated draft save preserves raw strings and returns confirmed persistence only',async()=>{
  const db=database(),values={weight:'',squat_weight:'12.',squat_reps:'',plank_time:'0'}
  const response=await route.PUT(put({period:db.period,revision:0,expectedClientId:clientId,values}))
  assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store')
  const payload=await response.json();assert.equal(payload.success,true);assert.equal(payload.assessment.status,'draft');assert.equal(payload.assessment.savedAt,'2026-10-16T18:00:00Z')
  assert.deepEqual(db.calls[0].args.p_values,values);assert.equal(db.calls[0].args.p_complete,false)
})
test('new envelope and stale legacy form reject account switches before any write',async()=>{
  const db=database()
  for(const body of [{period:db.period,revision:0,expectedClientId:'OTHER',values:{weight:'150'}},{client_id:'OTHER',weight:'150',height_in:'67'}]){
    const response=await route.PUT(put(body));assert.equal(response.status,409);assert.equal((await response.json()).code,'account_changed')
  }
  assert.equal(db.calls.length,0)
})
test('unauthenticated and unavailable loads expose safe separate errors',async()=>{
  database({signedIn:false});assert.equal((await route.GET(get())).status,401)
  database({failTable:'strength_assessment_sessions'});const response=await route.GET(get());assert.equal(response.status,503);const payload=await response.json();assert.equal(payload.code,'load_failed');assert.ok(!JSON.stringify(payload).includes('private SQL'))
})
test('legacy duplicates preserve original date and every selected immutable result remains recoverable',async()=>{
  const db=database(),stamp=db.period.slice(0,7)
  db.tables.assessments.push({id:'first',client_id:clientId,auth_user_id:owner,assessment_type:'strength',submitted_at:`${stamp}-15T12:00:00Z`,data:{weight:'150',height_in:'67'}},{id:'retry',client_id:clientId,auth_user_id:owner,assessment_type:'strength',submitted_at:`${stamp}-15T13:00:00Z`,data:{weight:'151',height_in:'67'}},{id:'foreign',client_id:'OTHER',auth_user_id:'other',assessment_type:'strength',submitted_at:`${stamp}-15T10:00:00Z`,data:{weight:'999'}})
  const initial=await (await route.GET(get())).json();assert.equal(initial.assessment.status,'completed');assert.equal(initial.assessment.assessmentId,'first');assert.equal(initial.assessment.values.weight,'150');assert.equal(initial.history.length,2)
  const selected=await (await route.GET(get('?assessmentId=retry'))).json();assert.equal(selected.assessment.values.weight,'151');assert.equal(selected.assessment.assessmentId,'retry')
  assert.equal((await route.GET(get('?assessmentId=foreign'))).status,404)
  assert.equal(db.calls.length,0);assert.equal(db.tables.assessments.length,3)
})
test('explicit previous-month completion never makes current period complete',async()=>{
  const db=database(),stamp=db.period.slice(0,7)
  db.tables.assessments.push({id:'late-prior',client_id:clientId,auth_user_id:owner,assessment_type:'strength',submitted_at:`${stamp}-15T12:00:00Z`,assessment_period:'2025-01-01',data:{weight:'150',height_in:'67'}})
  assert.equal((await (await route.GET(get())).json()).assessment,null)
  const selected=await (await route.GET(get('?assessmentId=late-prior'))).json();assert.equal(selected.period,'2025-01-01');assert.equal(selected.history[0].period,'2025-01-01')
})
test('cross-session conflicts return a safe conflict and never report successful persistence',async()=>{
  const db=database();db.rpc=async()=>({data:{success:false,status:409,code:'conflict',assessment:{status:'draft',period:db.period,revision:3,saved_at:'2026-10-16T18:00:00Z',values:{weight:'155'},completed_at:null}},error:null})
  const response=await route.PUT(put({expectedClientId:clientId,period:db.period,revision:1,values:{weight:'150'}}));assert.equal(response.status,409);const payload=await response.json();assert.equal(payload.success,undefined);assert.equal(payload.assessment.revision,3)
})

test('a concurrent legacy completion opens deliberate review instead of an endless generic retry',async()=>{
  const db=database();db.rpc=async()=>({data:{success:false,status:409,code:'already_completed'},error:null})
  const response=await route.PUT(put({expectedClientId:clientId,period:db.period,revision:0,values:{weight:'150'}}))
  assert.equal(response.status,409);assert.equal((await response.json()).code,'conflict')
})
