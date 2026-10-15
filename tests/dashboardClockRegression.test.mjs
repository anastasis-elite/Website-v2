import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'
const {nextScheduleBoundary}=await importTs('lib/schedule/refresh.ts')
const {getGreeting,localDateKey}=await importTs('lib/timezone.ts')
const {buildDailyRecommendation}=await importTs('lib/dashboard/dailyRecommendation.ts')
const timezone='America/Chicago'
const logic=()=>({program:'ignite',nutrition:{dataStatus:'needs_input',calories:{percent:0},protein:{percent:0}},hydration:{status:'needs_input',remaining:100},assessments:{dailyCompleted:false},execution:{workoutComplete:false},workout:{assigned:false},workoutDecision:{canTrain:true},symptoms:{redFlag:false},recoveryStatus:{reasoning:'Recovery guidance available.'}})
test('idle dashboards refresh through noon and evening, keeping greetings and next steps current',()=>{
 for(const [instant,expected] of [['2026-10-12T16:59:59Z','Good Afternoon'],['2026-10-12T21:59:59Z','Good Evening']]) {
  const now=Date.parse(instant),boundary=nextScheduleBoundary({date:'2026-10-12',timezone,events:[]},now)
  assert.ok(boundary-now<=60000,'idle dashboard must refresh at the greeting transition')
  assert.equal(getGreeting(new Date(boundary),timezone),expected)
 }
})
test('event boundaries, local midnight, DST folds and clock skew never leave an unbounded stale card',()=>{
 for(const [instant,zone] of [['2026-11-01T22:59:59Z',timezone],['2026-03-08T21:59:59Z',timezone],['2026-10-12T09:59:59Z','Pacific/Honolulu'],['2026-10-12T10:59:59Z','Pacific/Auckland']]) {
  const now=Date.parse(instant),date=localDateKey(new Date(now),zone)
  const boundary=nextScheduleBoundary({date,timezone:zone,events:[]},now)
  assert.ok(boundary>now&&boundary-now<=60000)
 }
 const now=Date.parse('2026-10-12T13:00:00Z')
 assert.equal(nextScheduleBoundary({date:'2026-10-12',timezone,events:[{status:'scheduled',start_at:'2026-10-12T13:00:05Z',end_at:'2026-10-12T14:00:00Z'}]},now),now+5000)
 assert.equal(nextScheduleBoundary({date:'2026-10-11',timezone,events:[]},now),now)
})
test('daily check-in is the first entry while commitments and other actions stay available',()=>{
 const current=logic(),schedule={date:'2026-10-12',timezone,now:'2026-10-12T15:00:00Z',events:[{id:'work',title:'Work block',event_type:'work',flexibility_type:'fixed',status:'scheduled',start_at:'2026-10-12T14:00:00Z',end_at:'2026-10-12T22:00:00Z'}]}
 const plan=buildDailyRecommendation(current,schedule)
 assert.equal(plan.primary.id,'check-in')
 assert.ok(plan.supporting.some(action=>action.id==='work'))
 assert.ok(plan.supporting.some(action=>action.category==='nutrition'))
 current.workoutDecision.canTrain=false
 assert.equal(buildDailyRecommendation(current,schedule).primary.id,'check-in')
 current.workoutDecision.canTrain=true
 current.assessments.dailyCompleted=true
 assert.equal(buildDailyRecommendation(current,schedule).primary.id,'work')
 current.symptoms.redFlag=true
 assert.equal(buildDailyRecommendation(current,schedule).primary.id,'safety')
})
