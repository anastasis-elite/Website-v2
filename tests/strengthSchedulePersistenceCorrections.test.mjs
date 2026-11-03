import assert from 'node:assert/strict'
import test, { after, mock } from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import React from 'react'
import ts from 'typescript'
import { importTs } from './typescriptModule.mjs'

const require = createRequire(import.meta.url)
const date = '2026-11-09', owner = 'synthetic-schedule-owner', clientId = 'SYNTHETIC-STRENGTH-SCHEDULE'
const now = Date.parse(`${date}T13:00:00Z`)
mock.timers.enable({ apis: ['Date'], now })
after(() => mock.timers.reset())
const time = await importTs('lib/schedule/time.ts')
const timezone = await importTs('lib/timezone.ts')
const engine = await importTs('lib/schedule/engine.ts')
const actions = await importTs('lib/schedule/actions.ts')
const structure = await importTs('lib/assessment/scheduleStructure.ts')
const { getDailyScheduleState } = await importTs('lib/schedule/service.ts', {
  '@/lib/calendar/service': 'export const importedScheduleEvents = async () => []',
  '@/lib/day/getDailyExecutionPlan': 'export const getDailyExecutionPlan = async () => null',
  '@/lib/dashboard/logic/getProgramLogicForClient': 'export const getProgramLogicForClient = async () => null',
})
const plan = await importTs('app/api/schedule/plan/route.ts', {
  'next/server': 'export const NextResponse = { json: (body, init) => Response.json(body, init) }',
  '@/lib/supabase/server': 'export const createClient = async () => globalThis.strengthSchedulePersistence.db',
  '@/lib/schedule/service': 'export const getDailyScheduleState = args => globalThis.strengthSchedulePersistence.schedule(args.client)',
  '@/lib/dashboard/invalidateDailyPlan': 'export const invalidateDailyPlan = () => { globalThis.strengthSchedulePersistence.invalidations++ }',
})
const clone = value => structuredClone(value)
const strength = { state:'due', label:'Due', period:'2026-11-01', completedAt:null, savedAt:null, assessmentId:null,
  actionLabel:'Start Assessment', href:'/dashboard/assessment/start2?period=2026-11-01', workoutHref:'/dashboard/assessment/start2?period=2026-11-01',
  unavailable:false, previousDraft:null, eligibleDate:date, scheduledDate:date, latestCompletedAt:'2026-08-09T12:00:00Z', eligible:true, isWorkoutDay:true, completedToday:false }
function logic(client) { return { program:'ember', generatedAt:new Date().toISOString(), client:{id:client.client_id, timezone:client.timezone},
  assessments:{dailyCompleted:true,strength}, symptoms:{redFlag:false}, capacityStatus:{status:'high_capacity'}, recoveryStatus:{status:'normal_training_day',reasoning:'Existing recovery guidance.'},
  recoveryCheck:{energy:5,stress:2,soreness:1}, sleep:{hours:8,quality:4},
  hydration:{status:'ready',target:80,consumed:80,remaining:0,percent:100,presentationPacing:{state:'complete'}},
  nutrition:{dataStatus:'known',calories:{percent:100},protein:{percent:100},pacing:{state:'complete'}},
  execution:{workoutComplete:false,nutritionLogged:true,recoveryComplete:true}, workout:{assigned:true,title:'Saved regular workout'},
  workoutDecision:{canTrain:true,assignedWorkout:{workout_state:'training',exercises:[{name:'Squat'}]},adjustmentLevel:'level_0_full_plan',reasonForModification:'Existing saved decision.'} } }
function fixture({ persisted = true, workoutTime = '14:00', conflict = null, changes = {}, unavailableSources = [] } = {}) {
  mock.timers.setTime(now)
  const client = { client_id:clientId, auth_user_id:owner, program:'ember', timezone:'Etc/UTC', access:true, active:true,
    wake_time:'05:00', bed_time:'21:00', preferred_workout_time:workoutTime, current_workout_minutes_per_session:30,
    lunch_window_time:'15:00', daily_structure_reviewed_at:'2026-11-01T12:00:00Z',
    onboarding_data:{ kept:'original', dailyGuide:{date,activities:{schedule:{status:'reviewed'}}}, transitionMinutes:0 } }
  const rows = [client,{...clone(client),client_id:'OTHER-CLIENT',auth_user_id:'other-owner',onboarding_data:{kept:'other'}}]
  const original = { id:'00000000-0000-4000-8000-000000000001', user_id:owner, client_id:clientId,
    title:'Original saved workout', description:'Retained original workout', event_type:'workout', source:'program',
    start_at:`${date}T14:00:00Z`, end_at:`${date}T14:30:00Z`, timezone:'Etc/UTC', all_day:false, status:'scheduled', completed_at:null,
    flexibility_type:'flexible', priority:'high', required:false, movable:true, approval_required:false,
    estimated_duration_minutes:30, earliest_start_at:`${date}T05:00:00Z`, latest_end_at:`${date}T21:30:00Z`,
    adjusted_start_at:null, adjusted_end_at:null, ...changes }
  const records = persisted ? [original] : [], originalRecords = clone(records)
  const state = { rows, records, originalRecords, actor:owner, attempts:0, writes:[], queries:[], invalidations:0, requests:[], conflict,
    async schedule(member = rows[0]) {
      const day = time.getClientDayRange(member,date)
      const scoped = clone(records.filter(event => event.user_id === member.auth_user_id && event.client_id === member.client_id))
      return getDailyScheduleState({ supabase:db,user:{id:member.auth_user_id},client:member,date,logic:logic(member),
        dailyPlan:{date,timezone:member.timezone,timing:{workoutTime:member.preferred_workout_time}},
        sources:{reader:db,userId:member.auth_user_id,clientId:member.client_id,day,persistedEvents:scoped,calendarEvents:[],blocks:[],checkoffs:[],unavailableSources} })
    },
  }
  const db = { auth:{getUser:async()=>({data:{user:state.actor ? {id:state.actor} : null}})}, from(table) {
    assert.equal(table,'clients','Only the existing owner-bound preference writer may mutate; no workout/history writes')
    const filters=[];let mutation
    const q={select(){return q},eq(key,value){filters.push([key,value]);return q},is(key,value){filters.push([key,value]);return q},update(value){mutation=value;return q},
      async maybeSingle(){
        state.queries.push({filters:clone(filters),mutation:mutation&&clone(mutation)})
        if(mutation){state.attempts++;if(state.conflict)state.conflict(rows[0],state.attempts)}
        const row=rows.find(row=>filters.every(([key,value])=>key==='onboarding_data'?value===null?row[key]==null:JSON.stringify(row[key])===value:row[key]===value))
        if(row&&mutation){Object.assign(row,clone(mutation));state.writes.push(clone(mutation))}
        return {data:row?clone(row):null,error:null}
      }}
    return q
  }}
  state.db=db;globalThis.strengthSchedulePersistence=state
  return state
}
const request = body => new Request('https://synthetic.test/api/schedule/plan',{method:'POST',body:JSON.stringify(body)})
const descendants=(tree,predicate)=>Array.isArray(tree)?tree.flatMap(child=>descendants(child,predicate)):!tree||typeof tree!=='object'?[]:[...(predicate(tree)?[tree]:[]),...descendants(tree.props?.children,predicate)]
const text=tree=>typeof tree==='string'?tree:Array.isArray(tree)?tree.map(text).join(''):tree&&typeof tree==='object'?text(tree.props?.children):''
function ui(state,event,suggestion) {
  const module={exports:{}}
  const mocks={react:{...React,useState:initial=>[initial,()=>{}],useEffect:()=>{},useRef:initial=>({current:initial})},'next/link':{__esModule:true,default:'a'},'next/navigation':{useRouter:()=>({refresh(){}})},
    '@/lib/schedule/engine':engine,'@/lib/schedule/actions':actions,'@/lib/schedule/time':time,'@/lib/timezone':timezone,'@/lib/calendar/client':{announceCalendarChange(){}},'@/lib/assessment/scheduleStructure':structure}
  const compiled=ts.transpileModule(readFileSync('components/ScheduleEventActions.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText
  runInNewContext(compiled,{module,exports:module.exports,require:name=>mocks[name]||require(name),fetch:(url,options)=>{
    const response=plan.POST(new Request('https://synthetic.test'+url,options));state.requests.push({url,options:clone(options),response});return response
  }})
  return module.exports.default({event,timezone:'Etc/UTC',program:'ember',suggestion})
}
async function click(state,tree,label) {
  const button=descendants(tree,node=>node.type==='button'&&text(node.props.children).startsWith(label))[0]
  assert.ok(button,`Missing ${label} button`);button.props.onClick()
  assert.equal(state.requests.length,1);const response=await state.requests[0].response
  await new Promise(resolve=>setImmediate(resolve));return response
}
const move={action:'move',start_at:`${date}T19:00:00.000Z`,end_at:`${date}T19:30:00.000Z`}

test('persisted assessment move uses its actual UI route, retains CAS preferences, reloads held, and blocks an overlapping move',async()=>{
  const state=fixture({conflict:(row,attempt)=>{if(attempt===1)row.onboarding_data={...row.onboarding_data,otherDevice:'retained'}}})
  const before=clone(state.rows[1]),initial=await state.schedule(),event=initial.events.find(event=>event.id===state.records[0].id)
  assert.equal(event.title,'Strength assessment');assert.equal(event.virtual,true)
  const response=await click(state,ui(state,event,{suggested_start_at:move.start_at,suggested_end_at:move.end_at,applied:false}),'Accept ')
  assert.equal(response.status,200);assert.equal(state.requests[0].url,'/api/schedule/plan');assert.equal(state.requests[0].options.method,'POST')
  assert.equal(state.attempts,2);assert.equal(state.rows[0].onboarding_data.otherDevice,'retained');assert.equal(state.rows[0].onboarding_data.kept,'original')
  for(const query of state.queries.filter(item=>item.mutation)){
    assert.ok(query.filters.some(([key,value])=>key==='client_id'&&value===clientId))
    assert.ok(query.filters.some(([key,value])=>key==='auth_user_id'&&value===owner))
    assert.ok(query.filters.some(([key])=>key==='onboarding_data'))
    assert.deepEqual(Object.keys(query.mutation),['onboarding_data'])
  }
  assert.deepEqual(state.rows[1],before);assert.deepEqual(state.records,state.originalRecords)
  const reloaded=await state.schedule(),saved=reloaded.events.find(item=>item.id===event.id)
  assert.equal(saved.adjusted_start_at,move.start_at);assert.equal(saved.suggested,false);assert.equal(saved.busy,true)
  assert.equal(reloaded.todayViewModel.today.activities.find(item=>item.id==='workout').status,'deferred')
  assert.equal(reloaded.todayViewModel.today.activities.find(item=>item.id==='workout').deferredUntil,move.start_at)
  assert.notEqual(reloaded.dailyRecommendation.primary.category,'workout');assert.ok(!reloaded.dailyRecommendation.supporting.some(item=>item.category==='workout'))
  const writes=state.writes.length
  const overlap=await plan.POST(request({eventId:`virtual-midday-${date}`,action:'move',start_at:`${date}T19:10:00Z`,end_at:`${date}T19:40:00Z`}))
  assert.equal(overlap.status,400);assert.match((await overlap.json()).error,/overlaps Strength assessment/);assert.equal(state.writes.length,writes)
})

test('persisted assessment skip follows its actual route and stays skipped after fresh reload without touching original workout history',async()=>{
  const state=fixture(),initial=await state.schedule(),event=initial.events.find(item=>item.id===state.records[0].id)
  assert.equal((await click(state,ui(state,event),'Skip today')).status,200)
  assert.equal(state.requests[0].url,'/api/schedule/plan')
  const reloaded=await state.schedule()
  assert.equal(reloaded.events.find(item=>item.id===event.id).status,'skipped')
  assert.equal(reloaded.todayViewModel.today.activities.find(item=>item.id==='workout').status,'skipped')
  assert.notEqual(reloaded.dailyRecommendation.primary.category,'workout')
  assert.deepEqual(state.records,state.originalRecords)
  assert.equal((await plan.POST(request({eventId:event.id,action:'skip'}))).status,409)
  assert.equal(state.writes.length,1)
})

test('generated virtual assessment accepts and retains its timing and subsequent skip through the same existing writer',async()=>{
  const state=fixture({persisted:false}),initial=await state.schedule(),event=initial.events.find(item=>item.title==='Strength assessment')
  assert.equal(event.virtual,true);assert.equal(event.suggested,true)
  assert.equal((await plan.POST(request({eventId:event.id,...move}))).status,200)
  let reloaded=await state.schedule(),saved=reloaded.events.find(item=>item.id===event.id)
  assert.equal(saved.adjusted_start_at,move.start_at);assert.equal(saved.suggested,false);assert.equal(saved.busy,true)
  assert.equal((await plan.POST(request({eventId:event.id,action:'skip'}))).status,200)
  reloaded=await state.schedule();assert.equal(reloaded.events.find(item=>item.id===event.id).status,'skipped')
  assert.equal(state.records.length,0)
})

test('a genuinely untimed assessment stays nonblocking rather than occupying the whole day',async()=>{
  const state=fixture({persisted:false,workoutTime:null}),initial=await state.schedule(),event=initial.events.find(item=>item.title==='Strength assessment')
  assert.equal(event.all_day,true);assert.equal(event.busy,false);assert.equal(event.estimated_duration_minutes,null)
  const response=await plan.POST(request({eventId:`virtual-midday-${date}`,action:'move',start_at:`${date}T19:10:00Z`,end_at:`${date}T19:40:00Z`}))
  assert.equal(response.status,200);assert.equal(state.writes.length,1)
})

test('the unchanged owner-scoped CAS writer rejects stale retries and foreign/anonymous mutation attempts',async()=>{
  let state=fixture({conflict:(row,attempt)=>{row.onboarding_data={...row.onboarding_data,version:attempt}}})
  const event=(await state.schedule()).events.find(item=>item.title==='Strength assessment')
  assert.equal((await plan.POST(request({eventId:event.id,...move}))).status,409)
  assert.equal(state.attempts,3);assert.equal(state.writes.length,0);assert.equal(state.invalidations,0)
  state=fixture();const before=clone(state.rows[0]);state.actor='other-owner'
  assert.equal((await plan.POST(request({eventId:event.id,action:'skip',clientId,owner}))).status,404)
  assert.deepEqual(state.rows[0],before);assert.equal(state.writes.length,0)
  state.actor=null;assert.equal((await plan.POST(request({eventId:event.id,...move}))).status,401)
  assert.equal(state.writes.length,0)
})

test('projection retains approval/fixed-event controls and unavailable-source move rejection',async()=>{
  for(const changes of [{flexibility_type:'fixed',movable:false,approval_required:true},{flexibility_type:'flexible',movable:false,approval_required:true}]){
    const state=fixture({changes}),event=(await state.schedule()).events.find(item=>item.title==='Strength assessment')
    assert.equal((await plan.POST(request({eventId:event.id,...move}))).status,400)
    assert.equal((await plan.POST(request({eventId:event.id,action:'skip'}))).status,400)
    assert.equal(state.writes.length,0)
  }
  const state=fixture({unavailableSources:['calendar']}),event=(await state.schedule()).events.find(item=>item.title==='Strength assessment')
  assert.equal((await plan.POST(request({eventId:event.id,...move}))).status,503);assert.equal(state.writes.length,0)
})
