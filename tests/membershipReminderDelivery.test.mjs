import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const require=createRequire(import.meta.url)
const milestone='11111111-1111-4111-8111-111111111111',owner='22222222-2222-4222-8222-222222222222',lease='33333333-3333-4333-8333-333333333333'
const origin='https://app.example.test'
const load=(path,mocks={},env={NODE_ENV:'test'})=>{
  const module={exports:{}}
  const compiled=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText
  runInNewContext(compiled,{module,exports:module.exports,process:{env},URL,Date,Error,require:name=>name==='server-only'?{}:mocks[name]||require(name)})
  return module.exports
}
const service=load('lib/commerce/experienceReminderDelivery.ts')

function fixture(){
  const state={now:Date.parse('2026-11-01T12:00:00Z'),status:'pending',firstAttempt:null,leaseUntil:0,completed:false,cancelled:false,ineligible:false,changedOwner:false,providerFailure:false,ackFailure:false,
    claims:[],checks:[],finishes:[],messages:[],provider:new Map(),refreshes:0,billing:{subscription:'synthetic-only',access:true,status:'active'},afterClaim:null}
  const job=()=>({milestone_id:milestone,lease_token:lease,user_id:owner,email:'verified-owner@example.test',first_attempt_at:state.firstAttempt,months:6,feedback:'FEEDBACK-DO-NOT-EXPOSE',rating:1,comment:'PRIVATE-ANSWER-DO-NOT-EXPOSE'})
  const eligible=()=>!state.completed&&!state.cancelled&&!state.ineligible&&!state.changedOwner
  const supabase={async rpc(name,args){
    if(name==='refresh_membership_milestones'){state.refreshes++;return{data:{refreshed:1,queued:1},error:null}}
    if(name==='claim_membership_milestone_reminder'){
      state.claims.push(args)
      if(['sent','suppressed','manual_recovery'].includes(state.status)||state.status==='leased'&&state.leaseUntil>state.now)return{data:null,error:null}
      if(!eligible()){state.status='suppressed';return{data:null,error:null}}
      state.firstAttempt ||= new Date(state.now).toISOString();state.status='leased';state.leaseUntil=state.now+120000
      state.afterClaim?.()
      return{data:job(),error:null}
    }
    if(name==='recheck_membership_milestone_reminder'){
      state.checks.push(args)
      if(!eligible()){state.status='suppressed';return{data:null,error:null}}
      if(state.now-Date.parse(state.firstAttempt)>=23*3600000){state.status='manual_recovery';return{data:null,error:null}}
      return{data:job(),error:null}
    }
    assert.equal(name,'finish_membership_milestone_reminder');state.finishes.push(args)
    if(state.ackFailure&&args.p_delivered)return{data:false,error:{message:'Synthetic lost acknowledgment'}}
    if(!eligible()){state.status='suppressed';return{data:false,error:null}}
    state.status=args.p_delivered?'sent':'pending';state.leaseUntil=0
    return{data:true,error:null}
  },from(table){
    assert.equal(table,'membership_milestone_reminders')
    const query={select(){return query},in(){return query},lte(){return query},or(){return query},order(){return query},async limit(count){assert.equal(count,10);return{data:['pending','leased'].includes(state.status)?[{milestone_id:milestone}]:[],error:null}}}
    return query
  }}
  const send=async(message,options)=>{
    state.messages.push({message,options})
    // The provider may accept before a connection fails; retries reuse this key.
    if(!state.provider.has(options.idempotencyKey))state.provider.set(options.idempotencyKey,{id:'synthetic-message'})
    if(state.providerFailure)throw new Error('Synthetic ambiguous provider response')
    return{data:state.provider.get(options.idempotencyKey),error:null}
  }
  const options={allowTest:true,send,now:()=>new Date(state.now)}
  return{state,supabase,options,run:()=>service.deliverMembershipReminder(supabase,milestone,origin,options)}
}

test('reminders use neutral content, a canonical verified recipient and one immutable milestone provider key',async()=>{
  const f=fixture(),before=structuredClone(f.state.billing)
  assert.equal(await f.run(),true)
  assert.equal(f.state.checks.length,1)
  assert.equal(f.state.messages.length,1)
  const {message,options}=f.state.messages[0]
  assert.equal(message.to,'verified-owner@example.test')
  assert.equal(options.idempotencyKey,`membership-milestone-reminder:${milestone}`)
  assert.equal(message.subject,'Your Anastasis check-in')
  assert.match(message.html,/https:\/\/app\.example\.test\/dashboard\/experience/)
  assert.doesNotMatch(message.subject+message.html+message.text,/FEEDBACK|PRIVATE-ANSWER|rating|comment|subscription|billing|months|token=|email=|\?/i)
  assert.equal(await f.run(),false)
  assert.equal(f.state.messages.length,1)
  assert.deepEqual(f.state.billing,before)
})

test('completion or cancellation between claim and send permanently suppresses delivery without changing billing',async()=>{
  for(const flag of ['completed','cancelled','ineligible','changedOwner']){
    const f=fixture(),before=structuredClone(f.state.billing)
    f.state.afterClaim=()=>{f.state[flag]=true}
    assert.equal(await f.run(),false,flag)
    assert.equal(f.state.messages.length,0,flag)
    assert.equal(f.state.status,'suppressed',flag)
    f.state[flag]=false;f.state.afterClaim=null
    assert.equal(await f.run(),false,'Later login or restored eligibility cannot revive the stale job.')
    assert.equal(f.state.messages.length,0)
    assert.deepEqual(f.state.billing,before)
  }
})

test('ambiguous sends and lost acknowledgements retry safely within the provider window without duplicate messages',async()=>{
  const f=fixture();f.state.providerFailure=true
  await assert.rejects(f.run(),/could not be confirmed/)
  assert.equal(f.state.status,'pending')
  f.state.providerFailure=false;f.state.now+=5*60000
  assert.equal(await f.run(),true)
  assert.equal(f.state.messages.length,2)
  assert.equal(f.state.provider.size,1)
  assert.deepEqual(f.state.messages[1],f.state.messages[0])
  const uncertain=fixture();uncertain.state.ackFailure=true
  await assert.rejects(uncertain.run(),/could not be confirmed/)
  assert.equal(uncertain.state.status,'leased')
  assert.equal(uncertain.state.finishes.some(value=>value.p_delivered===false),false)
  uncertain.state.now+=3*60000;uncertain.state.ackFailure=false
  assert.equal(await uncertain.run(),true)
  assert.equal(uncertain.state.provider.size,1)
})

test('jobs beyond the bounded provider idempotency window never produce a new automatic send',async()=>{
  const f=fixture();f.state.providerFailure=true
  await assert.rejects(f.run())
  f.state.providerFailure=false;f.state.now+=23*3600000
  assert.equal(await f.run(),false)
  assert.equal(f.state.messages.length,1)
  assert.equal(f.state.status,'manual_recovery')
})

test('the existing worker materializes reminders without an app visit and drains a bounded queue with a mocked sender',async()=>{
  const f=fixture()
  const result=await service.drainMembershipReminders(f.supabase,origin,f.options)
  assert.equal(f.state.refreshes,1)
  assert.deepEqual(JSON.parse(JSON.stringify(result)),{delivered:1,failed:0,skipped:0,configured:true})
  const second=await service.drainMembershipReminders(f.supabase,origin,f.options)
  assert.equal(second.delivered,0)
  assert.equal(f.state.messages.length,1)
})

test('default test execution cannot send externally, and reminder URLs contain no account, response or authentication data',async()=>{
  const f=fixture()
  assert.equal(await service.deliverMembershipReminder(f.supabase,milestone,origin),false)
  assert.equal(f.state.claims.length,0)
  const queued=await service.drainMembershipReminders(f.supabase,origin)
  assert.equal(f.state.refreshes,1);assert.equal(queued.configured,false)
  const message=service.membershipReminderMessage('verified-owner@example.test',origin+'/private?email=excluded#answer')
  assert.match(message.text,/https:\/\/app\.example\.test\/dashboard\/experience$/)
  assert.doesNotMatch(message.html,/private|excluded|email=|token=/)
  assert.throws(()=>service.membershipReminderMessage('owner@example.test','https://secret:credential@app.example.test'),/not configured/)
})

test('the existing commerce cron authenticates before any invitation, analytics or milestone work',async()=>{
  const calls=[]
  const route=load('app/api/commerce/invitations/cron/route.ts',{
    'next/server':{NextResponse:{json:(body,init)=>Response.json(body,init)}},
    '@/lib/supabase/admin':{createAdminClient(){calls.push('admin');return{}}},
    '@/lib/commerce/invitationDelivery':{async drainPurchaseInvitations(){calls.push('invitations');return{delivered:0,failed:0}}},
    '@/lib/analytics/server':{async deliverPendingConversions(){calls.push('analytics')}},
    '@/lib/commerce/experienceReminderDelivery':{async drainMembershipReminders(){calls.push('reminders');return{delivered:1,failed:0,skipped:0,configured:true}}},
  },{CRON_SECRET:'synthetic-cron',NEXT_PUBLIC_APP_URL:origin})
  assert.equal((await route.GET(new Request(origin+'/cron'))).status,401)
  assert.deepEqual(calls,[])
  const response=await route.GET(new Request(origin+'/cron',{headers:{authorization:'Bearer synthetic-cron'}}))
  assert.equal(response.status,200)
  assert.deepEqual(calls,['admin','invitations','analytics','reminders'])
  assert.deepEqual(await response.json(),{delivered:0,failed:0,reminders:{delivered:1,failed:0,skipped:0,configured:true}})
})
