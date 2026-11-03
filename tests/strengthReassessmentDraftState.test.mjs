import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'
const { StrengthDraftSession, StrengthRequestError }=await importTs('lib/assessments/strengthDraftSession.ts')
const defaults={weight:'',height_in:'',squat_weight:'',squat_reps:''}
const result=(assessment=null,extra={})=>({period:'2026-11-01',currentPeriod:'2026-11-01',clientId:'OWN',assessment,...extra})
const draft=values=>({status:'draft',values,revision:1,savedAt:'2026-11-03T12:00:00Z',completedAt:null,assessmentDate:null})

test('ineligible reassessment restores and saves exact draft strings without inventing completion; a fresh eligible load enables completion',async()=>{
  let stored=draft({...defaults,squat_weight:'12.'}),eligible=false
  const session=new StrengthDraftSession(defaults,async(method,body)=>{
    if(method==='PUT')stored=draft(body.values)
    return result(stored,{success:true,eligibleDate:'2026-12-01',canComplete:eligible})
  },'OWN')
  await session.load();assert.equal(session.getSnapshot().canComplete,false)
  session.change('squat_reps','0');await session.save()
  assert.equal(session.getSnapshot().values.squat_weight,'12.');assert.equal(session.getSnapshot().values.squat_reps,'0')
  assert.equal(session.getSnapshot().canComplete,false);assert.equal(session.getSnapshot().status,'draft')
  eligible=true;await session.load();assert.equal(session.getSnapshot().canComplete,true)
  assert.deepEqual(session.getSnapshot().values,stored.values)
})

test('a concurrent final can close eligibility without losing local values, cloud timestamps or restoration guards',async()=>{
  const session=new StrengthDraftSession(defaults,async(method)=>{
    if(method==='POST')throw new StrengthRequestError('not_eligible',{eligibleDate:'2027-02-03'})
    return result(draft({...defaults,weight:'150'}),{canComplete:true})
  },'OWN')
  await session.load();session.change('squat_weight','45.')
  assert.equal(await session.submit(),false)
  const state=session.getSnapshot()
  assert.equal(state.values.squat_weight,'45.');assert.equal(state.savedAt,'2026-11-03T12:00:00Z')
  assert.equal(state.canComplete,false);assert.equal(state.eligibleDate,'2027-02-03');assert.equal(state.unsaved,true)
  assert.match(state.submitError,/not eligible yet/);assert.equal(state.conflict,false)
  assert.equal(await session.load(),false,'Automatic reads cannot replace the unsaved form')
})
