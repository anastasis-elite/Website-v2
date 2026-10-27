import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'
const {memberAssessmentStatusFromRecords:status,getMonthlyAssessmentStatus:load}=await importTs('lib/assessment/getMonthlyAssessmentStatus.ts')
const {memberSelections,validMemberSelections}=await importTs('lib/assessment/memberSelections.ts')
const {addCalendarMonths}=await importTs('lib/body-assessment/schedule.ts')
const owner={client_id:'fixture-client',auth_user_id:'fixture-user',timezone:'UTC',program:'ember',full_name:'Fixture Member',email:'fixture@example.invalid',birthdate:'1990-06-15'}
const choices={trainingDays:'3',experienceLevel:'consistent',equipmentAccess:'commercial-gym',primaryFocus:'strength',currentLimitations:'none',recoveryCapacity:'moderate',sleepQuality:'decent',stressLevel:'low',cardioPreference:'walking',notes:'Saved note'}
const full=(date,data=choices)=>({id:'full',submitted_at:date+'T12:00:00Z',assessment_type:'monthly',source:'dashboard-assessment',client_id:owner.client_id,auth_user_id:owner.auth_user_id,data})
const review=(date,data=choices)=>({...full(date,data),id:'review',source:'monthly-review'})

test('quarterly uses three calendar months after full completion, including month-end and leap-year edges',()=>{
  const calculate=(completed,today)=>status({client:owner,full:full(completed),review:null,now:new Date(today+'T18:00:00Z')})
  assert.equal(calculate('2026-01-31','2026-04-29').nextFullDueDate,'2026-04-30')
  assert.equal(calculate('2026-01-31','2026-04-29').dueKind,'review')
  assert.equal(calculate('2026-01-31','2026-04-30').dueKind,'quarterly')
  assert.equal(calculate('2023-11-30','2024-02-28').nextFullDueDate,'2024-02-29')
  assert.equal(calculate('2023-11-30','2024-02-29').dueKind,'quarterly')
  assert.equal(calculate('2026-09-15','2026-10-01').dueKind,null,'A calendar-quarter boundary must not reopen a recent full assessment')
})

test('monthly confirmation/edit timestamps remain independent and full due suppresses the review',()=>{
  const input={client:owner,full:full('2026-01-31'),review:review('2026-03-25',{...choices,trainingDays:'4'}),now:new Date('2026-04-24T18:00:00Z')}
  let value=status(input);assert.equal(value.lastCompletedAt,'2026-01-31T12:00:00Z');assert.equal(value.lastReviewCompletedAt,'2026-03-25T12:00:00Z')
  assert.equal(value.nextFullDueDate,'2026-04-30');assert.equal(value.nextReviewDueDate,'2026-04-25');assert.equal(value.dueKind,null);assert.equal(value.savedAnswers.trainingDays,'4')
  value=status({...input,now:new Date('2026-04-30T18:00:00Z')});assert.equal(value.dueKind,'quarterly')
  value=status({...input,full:full('2026-04-30'),now:new Date('2026-05-01T18:00:00Z')});assert.equal(value.nextFullDueDate,'2026-07-30');assert.equal(value.nextReviewDueDate,'2026-05-30');assert.equal(value.savedAnswers.trainingDays,'3')
  assert.equal(status({client:owner,full:full('2026-01-31'),review:null,now:new Date('2026-02-28T18:00:00Z')}).dueKind,'review')
})

test('cadence uses the member local date and unavailable history never confirms completion',()=>{
  const value=status({client:{...owner,timezone:'America/Los_Angeles'},full:{...full('2026-01-31'),submitted_at:'2026-02-01T03:00:00Z'},review:null,now:new Date('2026-05-01T02:00:00Z')})
  assert.equal(value.nextFullDueDate,'2026-04-30');assert.equal(value.dueKind,'quarterly')
  assert.equal(status({client:owner,full:null,review:null,now:new Date('2026-10-27')}).dueKind,'quarterly')
  assert.equal(status({client:owner,full:{submitted_at:'bad'},review:null,now:new Date('2026-10-27')}).unavailable,true)
  assert.equal(status({client:owner,full:null,review:null,unavailable:true}).dueKind,null)
})

function db(initial=[],fail=false){
  const original=structuredClone(initial),rows=structuredClone(initial),inserted=[],profiles=[],reads=[]
  const database={rows,inserted,profiles,reads,auth:{getUser:async()=>({data:{user:{id:owner.auth_user_id,email:owner.email}},error:null})},from(table){
    if(table==='clients')return{select(){return this},eq(key,value){assert.equal(key,'auth_user_id');assert.equal(value,owner.auth_user_id);return this},single:async()=>({data:owner,error:null})}
    if(table==='client_current_profiles')return{upsert:async(row)=>{profiles.push(row);return{error:null}}}
    assert.equal(table,'assessments');const filters=[],orders=[];let maximum
    reads.push(filters)
    const q={select(){return q},eq(key,value){filters.push(['eq',key,value]);return q},in(key,value){filters.push(['in',key,value]);return q},or(value){assert.equal(value,'source.is.null,source.neq.monthly-review');filters.push(['source']);return q},lte(key,value){filters.push(['lte',key,value]);return q},order(key,{ascending}){orders.push([key,ascending]);return q},limit(n){maximum=n;return q},maybeSingle:async()=>{
      if(fail)return{data:null,error:{message:'Fixture unavailable'}}
      const selected=rows.filter(row=>filters.every(([op,key,value])=>op==='source'?row.source==null||row.source!=='monthly-review':op==='eq'?row[key]===value:op==='in'?value.includes(row[key]):row[key]<=value)).sort((a,b)=>{for(const[key,ascending]of orders){if(a[key]!==b[key])return(a[key]<b[key]?-1:1)*(ascending?1:-1)}return 0}).slice(0,maximum)
      return{data:selected[0]||null,error:null}
    },insert:async(row)=>{inserted.push(row);rows.push({...row,id:'new-'+inserted.length});return{error:null}}};return q
  },verify(){assert.deepEqual(rows.slice(0,original.length),original,'Existing assessments must remain unchanged');for(const filters of reads.filter(filters=>filters.length)){assert.ok(filters.some(([op,key,value])=>op==='eq'&&key==='client_id'&&value===owner.client_id));assert.ok(filters.some(([op,key,value])=>op==='eq'&&key==='auth_user_id'&&value===owner.auth_user_id))}}}
  return database
}

test('reader separates legacy full forms, initial baselines and explicit reviews without changing storage/schema',async()=>{
  const source=[{...full('2026-07-15'),assessment_type:'initial',source:null},full('2026-08-15'),review('2026-09-15',{...choices,trainingDays:'4'}),{...full('2026-10-20'),auth_user_id:'other-user'},full('2026-12-01')]
  const fixture=db(source),value=await load(fixture,owner,new Date('2026-10-27T18:00:00Z'))
  assert.equal(value.lastCompletedAt,'2026-08-15T12:00:00Z');assert.equal(value.lastReviewCompletedAt,'2026-09-15T12:00:00Z');assert.equal(value.dueKind,'review');assert.equal(value.savedAnswers.trainingDays,'4');assert.equal(fixture.inserted.length,0);fixture.verify()
  assert.equal((await load(db([],true),owner)).unavailable,true)
  assert.equal((await load(db(),{client_id:owner.client_id})).unavailable,true)
})

test('saved selections preserve every answer and notes while identity stays profile-owned',()=>{
  const value=memberSelections(owner,{...choices,client_id:'other',email:'other@example.invalid',notes:'Preserve this'})
  assert.equal(value.client_id,owner.client_id);assert.equal(value.email,owner.email);assert.equal(value.notes,'Preserve this');assert.ok(validMemberSelections(value))
  assert.equal(memberSelections(owner,{}).sleepQuality,'');assert.equal(validMemberSelections(memberSelections(owner,{})),false)
})

const route=await importTs('app/api/assessment/route.ts',{
  'next/server':'export const NextResponse = {json:(value,options)=>Response.json(value,options)}',
  '@/lib/supabase/server':'export async function createClient(){return globalThis.__memberAssessmentFixture}',
  '@/lib/aos/isAOSAdmin':'export function isAOSAdmin(){return false}',
  '@/lib/dashboard/invalidateDailyPlan':'export function invalidateDailyPlan(){}',
})
async function submit(fixture,kind,answers=choices){globalThis.__memberAssessmentFixture=fixture;try{return await route.POST(new Request('http://fixture.invalid/api/assessment',{method:'POST',body:JSON.stringify({...answers,assessmentType:kind,client_id:'spoof',source:'spoof',assessmentKind:'spoof',submitted_at:'2000-01-01'})}))}finally{delete globalThis.__memberAssessmentFixture}}
const today=new Date().toISOString().slice(0,10),twoMonthsAgo=addCalendarMonths(today,-2),fourMonthsAgo=addCalendarMonths(today,-4)

test('confirming and editing a monthly review append only review records and never reset full completion',async()=>{
  for(const changes of [choices,{...choices,trainingDays:'4',notes:'Changed note'}]){
    const fixture=db([full(twoMonthsAgo)]),response=await submit(fixture,'review',changes)
    assert.equal(response.status,200);assert.equal(fixture.inserted.length,1)
    assert.equal(fixture.inserted[0].assessment_type,'monthly');assert.equal(fixture.inserted[0].source,'monthly-review');assert.equal(fixture.inserted[0].data.assessmentKind,'review');assert.equal(fixture.inserted[0].client_id,owner.client_id)
    assert.equal(fixture.inserted[0].data.trainingDays,changes.trainingDays);assert.equal(fixture.inserted[0].data.notes,changes.notes)
    const value=await load(fixture,owner);assert.equal(value.lastCompletedAt,full(twoMonthsAgo).submitted_at);assert.equal(value.dueKind,null);assert.equal(value.nextFullDueDate,addCalendarMonths(twoMonthsAgo,3));fixture.verify()
  }
})

test('full due rejects a duplicate monthly review; quarterly submission advances only the full history',async()=>{
  const fixture=db([full(fourMonthsAgo),review(twoMonthsAgo)])
  assert.equal((await submit(fixture,'review')).status,409);assert.equal(fixture.inserted.length,0)
  const response=await submit(fixture,'quarterly');assert.equal(response.status,200);assert.equal(fixture.inserted[0].source,'dashboard-assessment');assert.equal(fixture.inserted[0].data.assessmentKind,'quarterly')
  const value=await load(fixture,owner);assert.equal(value.lastReviewCompletedAt,review(twoMonthsAgo).submitted_at);assert.equal(value.dueKind,null);fixture.verify()
  assert.equal((await submit(fixture,'initial')).status,409,'Initial submission cannot bypass the rolling full-assessment gate')
})

test('not-due, unavailable and invalid submissions cannot append or alter records',async()=>{
  const fixture=db([full(today)]);assert.equal((await submit(fixture,'quarterly')).status,409);assert.equal((await submit(fixture,'review')).status,409);assert.equal(fixture.inserted.length,0);fixture.verify()
  const failed=db([],true);assert.equal((await submit(failed,'quarterly')).status,503);assert.equal(failed.inserted.length,0)
  const invalid=db([full(twoMonthsAgo)]);assert.equal((await submit(invalid,'review',{...choices,sleepQuality:''})).status,400);assert.equal(invalid.inserted.length,0)
})

test('initial onboarding and legacy monthly full submissions retain their existing routes and record types',async()=>{
  const first=db(),response=await submit(first,'initial');assert.equal(response.status,200);assert.equal((await response.json()).redirect,'/dashboard/assessment/start2');assert.equal(first.inserted[0].assessment_type,'initial');first.verify()
  const legacy=db([full(fourMonthsAgo)]),updated=await submit(legacy,'monthly');assert.equal(updated.status,200);assert.equal(legacy.inserted[0].assessment_type,'monthly');assert.equal(legacy.inserted[0].source,'dashboard-assessment');assert.equal(legacy.inserted[0].data.assessmentKind,'quarterly');legacy.verify()
})
