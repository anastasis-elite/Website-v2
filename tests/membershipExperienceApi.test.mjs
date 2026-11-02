import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'

const helper = await importTs('lib/membership/experience.ts')
const policy = await importTs('lib/membership/policy.ts')
const route = await importTs('app/api/membership/experience/route.ts', {
  'next/server': 'export const NextResponse={json:(body,options)=>Response.json(body,options)}',
  '@/lib/supabase/server': 'export const createClient=async()=>globalThis.experienceDb',
})
const milestoneId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',requestId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const answer={rating:3,continuation:'do_not_continue',comment:'A synthetic membership comment.'}
const milestone = patch => ({id:milestoneId,months:6,due_at:'2026-11-01T12:00:00Z',reminder_due_at:'2026-11-01T12:00:00Z',status:'open',can_respond:true,...patch})
const request = body => new Request('https://experience.test/api/membership/experience',{method:'POST',headers:{Origin:'https://experience.test'},body:JSON.stringify(body)})
function fixture({tier='ignite',expired=false,signedIn=true,eligible=true}={}) {
  const client={client_id:'OWN',auth_user_id:'owner',program:tier,access:true,active:true,verified_purchase:true,membership_expires_at:expired?'2025-01-01T00:00:00Z':'2099-01-01T00:00:00Z'}
  const state={client,lookups:[],rpcCalls:[],eligible,rows:[milestone()],error:null,saved:null,reply:null}
  globalThis.experienceDb={auth:{getUser:async()=>({data:{user:signedIn?{id:'owner',email_confirmed_at:'2026-01-01'}:null}})},from(table){assert.equal(table,'clients');return{select(){return this},eq(key,value){state.lookups.push([key,value]);return this},maybeSingle:async()=>({data:client,error:null}),update(){throw Error('Feedback must never update membership')},insert(){throw Error('Feedback must use its owner RPC')}}},
    async rpc(name,args){state.rpcCalls.push({name,args:structuredClone(args)});if(state.error)return{error:state.error};if(name==='get_membership_milestones')return{data:{eligible:state.eligible,milestones:state.rows},error:null};assert.equal(name,'submit_membership_milestone_feedback');if(state.reply)return{data:state.reply,error:null};if(state.saved)assert.deepEqual(args,state.saved.args);else state.saved={args:structuredClone(args)};return{data:milestone({status:'completed',can_respond:false,feedback:{response:args.p_response,submitted_at:'2026-11-01T12:10:00Z'}}),error:null}}
  }
  return state
}

test('experience validation allowlists answers and projects no billing, identity or secret metadata',()=>{
  assert.deepEqual(helper.experienceResponse({...answer,comment:'  A thought  '}),{...answer,comment:'A thought'})
  for(const value of [null,[],{...answer,rating:0},{...answer,rating:'3'},{...answer,continuation:'cancel_now'},{...answer,comment:'x'.repeat(2001)},{...answer,email:'not-allowed@example.test'}])assert.equal(helper.experienceResponse(value),null)
  const projected=helper.experienceMilestone(milestone({stripe_subscription_id:'forbidden',email:'hidden@example.test',token:'hidden'}))
  assert.ok(projected);assert.doesNotMatch(JSON.stringify(projected),/forbidden|hidden|subscription|token|email/)
  assert.equal(helper.experienceMilestone(milestone({months:8})),null)
})

test('authenticated state is owner-bound, private, unarmed when unknown, and retains expired history',async()=>{
  fixture({signedIn:false});assert.equal((await route.GET()).status,401)
  fixture({tier:'legacy-unknown'});assert.equal((await route.GET()).status,403)
  const state=fixture({expired:true,eligible:false});state.rows=[milestone({status:'completed',can_respond:false,feedback:{response:answer,submitted_at:'2026-11-01T12:10:00Z'},stripe_subscription_id:'never-return'})]
  const result=await route.GET();assert.equal(result.status,200);assert.equal(result.headers.get('cache-control'),'private, no-store')
  const data=await result.json();assert.equal(data.eligible,false);assert.deepEqual(data.milestones[0].feedback.response,answer);assert.doesNotMatch(JSON.stringify(data),/never-return/)
  assert.deepEqual(state.lookups,[['auth_user_id','owner']]);assert.equal(state.rpcCalls[0].name,'get_membership_milestones')
  state.rows=[];assert.deepEqual((await (await route.GET()).json()).milestones,[],'An unarmed anchor does not invent dates or due cards')
})

test('feedback rejects inactive, Free, foreign-origin and caller-granted fields before submitting',async()=>{
  const body={milestoneId,requestId,response:answer}
  for(const options of [{signedIn:false},{tier:'free'},{expired:true},{tier:'unknown'}]){
    const state=fixture(options);assert.ok([401,403].includes((await route.POST(request(body))).status));assert.equal(state.rpcCalls.length,0)
  }
  let state=fixture();const foreign=new Request('https://experience.test/api/membership/experience',{method:'POST',headers:{Origin:'https://foreign.test'},body:JSON.stringify(body)})
  assert.equal((await route.POST(foreign)).status,403);assert.equal(state.lookups.length,0)
  for(const patch of [{program:'phoenix'},{clientId:'FOREIGN'},{requestId:'not-a-uuid'},{response:{...answer,cancelSubscription:true}}]){
    state=fixture();assert.equal((await route.POST(request({...body,...patch}))).status,400);assert.equal(state.rpcCalls.length,0)
  }
})

test('confirmed feedback retries use the one owner RPC and never change subscription or access facts',async()=>{
  const state=fixture();const before=structuredClone(state.client),body={milestoneId,requestId,response:answer}
  const first=await route.POST(request(body));assert.equal(first.status,200);assert.equal(first.headers.get('cache-control'),'private, no-store')
  assert.equal((await first.json()).success,true)
  assert.equal((await route.POST(request(body))).status,200)
  assert.deepEqual(state.rpcCalls[0],state.rpcCalls[1]);assert.deepEqual(state.rpcCalls[0].args,{p_milestone_id:milestoneId,p_request_id:requestId,p_response:answer})
  assert.deepEqual(state.client,before)
  assert.equal(policy.capabilityForPath('/api/membership/experience','POST'),'accountData')
  assert.equal(policy.capabilityForPath('/dashboard/experience','GET'),'accountData')
})

test('failed, ineligible or mismatched feedback replies never report a confirmed save or expose raw errors',async()=>{
  const state=fixture(),body={milestoneId,requestId,response:answer},before=structuredClone(state.client)
  state.error={code:'42501',message:'Raw private answer must not escape'}
  let result=await route.POST(request(body));assert.equal(result.status,403);assert.doesNotMatch(JSON.stringify(await result.json()),/Raw private answer/)
  state.error={message:'Provider or transport failure'};assert.equal((await route.POST(request(body))).status,503)
  state.error=null
  for(const reply of [milestone(),milestone({status:'completed',can_respond:false}),milestone({status:'completed',can_respond:false,feedback:{response:{...answer,rating:1},submitted_at:'2026-11-01T12:10:00Z'}})]){
    state.reply=reply;result=await route.POST(request(body));assert.equal(result.status,503);assert.notEqual((await result.json()).success,true)
  }
  assert.deepEqual(state.client,before)
})
