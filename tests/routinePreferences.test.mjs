import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'
const { saveRoutinePreferences } = await importTs('lib/assessment/routinePreferences.ts')
const route = await importTs('app/api/daily-structure/routine/route.ts', {
  'next/server': 'export const NextResponse={json:(value,init)=>Response.json(value,init)}',
  '@/lib/supabase/server': 'export const createClient=async()=>globalThis.routineFixture.db',
  '@/lib/dashboard/invalidateDailyPlan': 'export const invalidateDailyPlan=()=>{globalThis.routineFixture.invalidations++}',
})
const answers={execution_style:'flow',carousel_style:'section',wake_time:'07:00',bed_time:'22:00',workout_days_available:0}
function fixture() {
  const original={scheduleStructureAssessments:{1:{'standalone:2026-10':{submittedAt:'2026-10-01T12:00Z',answers:{kept:true}}}},scheduleOverrides:{'routine-day-one':{status:'completed'}},kept:'existing'}
  const row={client_id:'QA-ROUTINE',auth_user_id:'qa-owner',onboarding_data:structuredClone(original),daily_structure_reviewed_at:'2026-10-01T12:00Z'}
  const f={row,original,writes:0,invalidations:0,signedIn:true,fail:false}
  f.db={auth:{getUser:async()=>({data:{user:f.signedIn?{id:'qa-owner'}:null},error:null})},from(table){
    assert.equal(table,'clients');const filters=[];let change
    const q={select(){return q},eq(k,v){filters.push([k,v]);return q},is(k,v){filters.push([k,v]);return q},update(v){change=v;return q},async maybeSingle(){
      if(!filters.every(([k,v])=>k==='onboarding_data'&&typeof v==='string'?JSON.stringify(row[k])===v:row[k]===v))return {data:null,error:null}
      if(change&&f.fail)return {data:null,error:{message:'unavailable'}}
      if(change){f.writes++;Object.assign(row,structuredClone(change))}
      return {data:structuredClone(row),error:null}
    }};return q
  }};globalThis.routineFixture=f;return f
}
const request=body=>new Request('https://local-qa.invalid',{method:'POST',body:JSON.stringify(body)})
test('routine edit updates profile and revision atomically without replacing assessments, outcomes, or reviewed-at',async()=>{
  const f=fixture();const result=await saveRoutinePreferences({supabase:f.db,userId:'qa-owner',clientId:f.row.client_id,expectedRevision:0,answers})
  assert.equal(result.saved,true);assert.equal(result.routine.revision,1);assert.equal(f.row.wake_time,'07:00')
  assert.deepEqual(f.row.onboarding_data.scheduleStructureAssessments,f.original.scheduleStructureAssessments)
  assert.deepEqual(f.row.onboarding_data.scheduleOverrides,f.original.scheduleOverrides)
  assert.equal(f.row.daily_structure_reviewed_at,'2026-10-01T12:00Z');assert.equal(f.writes,1)
  const stale=await saveRoutinePreferences({supabase:f.db,userId:'qa-owner',clientId:f.row.client_id,expectedRevision:0,answers:{...answers,wake_time:'08:00'}})
  assert.deepEqual(stale,{saved:false,status:409});assert.equal(f.row.wake_time,'07:00');assert.equal(f.writes,1)
})
test('routine API verifies identity, owner, answers, revision and persisted response before confirming',async()=>{
  const f=fixture(), body={client_id:f.row.client_id,expected_revision:0,...answers}
  f.signedIn=false;assert.equal((await route.POST(request(body))).status,401);f.signedIn=true
  assert.equal((await route.POST(request({...body,client_id:'someone-else'}))).status,404)
  assert.equal((await route.POST(request({...body,wake_time:'invalid'}))).status,400)
  assert.equal((await route.POST(request({...body,expected_revision:-1}))).status,400)
  f.fail=true;assert.equal((await route.POST(request(body))).status,500);assert.equal(f.invalidations,0);assert.equal(f.writes,0)
  f.fail=false;const response=await route.POST(request(body));assert.equal(response.status,200)
  assert.equal((await response.json()).routine.revision,1);assert.equal(f.invalidations,1)
  assert.equal((await route.POST(request(body))).status,409);assert.equal(f.writes,1)
})
