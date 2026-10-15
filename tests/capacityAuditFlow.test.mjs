import assert from 'node:assert/strict'
import test from 'node:test'
import {importTs} from './typescriptModule.mjs'
const {normalizeCapacityAudit}=await importTs('lib/capacityAudit.ts')
const body={fullName:' QA member ',email:'QA@EXAMPLE.TEST',agreement:true,energy_level:'thriving',overwhelm_level:'almost_never',time_available:'more_than_1_hour',support_level:'strong',current_season:'performing',capacity_score:25,recommended_program:'phoenix',timestamp:'1999-01-01'}
const saved=[]
globalThis.auditDb={from(){return {insert(payload){saved.push(payload);return this},select(){return this},single:async()=>({data:{id:'qa-audit'},error:null})}}}
const {POST}=await importTs('app/api/apply/route.ts',{'next/server':'export const NextResponse={json:(data,init)=>Response.json(data,init)}','@/lib/supabase/admin':'export const createAdminClient=()=>globalThis.auditDb'})
test('public audit computes recommendation from five allowed answers, ignoring browser scores',()=>{const result=normalizeCapacityAudit(body);assert.equal(result.score,5);assert.equal(result.recommendedProgram,'ember');assert.equal(result.email,'qa@example.test')})
test('public audit rejects missing, invalid choices, invalid email and absent agreement',()=>{for(const patch of [{energy_level:null},{time_available:'invented'},{email:'invalid'},{agreement:'true'}])assert.throws(()=>normalizeCapacityAudit({...body,...patch}))})
test('public audit persists canonical completion, generates result route and server time',async()=>{const response=await POST(new Request('http://local/api/apply',{method:'POST',body:JSON.stringify(body)}));assert.equal(response.status,200);const data=await response.json();assert.equal(data.redirect,'/audit/results/qa-audit');assert.equal(data.recommendedProgram,'ember');assert.equal(saved.at(-1).capacity_score,5);assert.equal(saved.at(-1).submitted,'capacity_audit');assert.notEqual(saved.at(-1).submitted_at,body.timestamp);assert.equal(saved.at(-1).application_data.recommended_program,'ember')})
test('failed audit persistence never reports completion',async()=>{globalThis.auditDb={from(){return {insert(){return this},select(){return this},single:async()=>({data:null,error:{message:'failure'}})}}};assert.equal((await POST(new Request('http://local/api/apply',{method:'POST',body:JSON.stringify(body)}))).status,500)})
test('malformed submissions do not require a database or report saved completion',async()=>{assert.equal((await POST(new Request('http://local/api/apply',{method:'POST',body:'invalid'}))).status,400)})
