import assert from 'node:assert/strict'
import test, { after, mock } from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { importTs } from './typescriptModule.mjs'

const now = Date.parse('2026-10-15T19:51:00Z'), date = '2026-10-15'
mock.timers.enable({ apis: ['Date'], now })
after(() => mock.timers.reset())
const mocks = {
  'next/server': 'export const NextResponse = { json: (value, init) => Response.json(value, init) }',
  '@/lib/dashboard/getDashboardContext': `export const getDashboardContext = async () => {
    const f = globalThis.resolutionFixture;
    if (!f.signedIn) throw { digest: 'NEXT_REDIRECT;replace;/login;307;' };
    return { supabase: f.db, user: {id: 'qa-owner'}, client: structuredClone(f.client) };
  }`,
  '@/lib/mobile/auth': `export const createMobileRequestContext = async () => {
    const f=globalThis.resolutionFixture; return {supabase:f.db,user:{id:'qa-owner'},client:structuredClone(f.client)};
  }`,
  '@/lib/calendar/service': 'export const importedScheduleEvents = async () => structuredClone(globalThis.resolutionFixture.calendar)',
  '@/lib/day/getDailyExecutionPlan': `export const getDailyExecutionPlan = async () => ({date:'${date}',timezone:'America/Chicago',timing:{},completedDailyTasks:[]})`,
  '@/lib/dashboard/logic/getProgramLogicForClient': 'export const getProgramLogicForClient = async () => globalThis.resolutionFixture.logic',
  '@/lib/dashboard/invalidateDailyPlan': 'export const invalidateDailyPlan = () => { globalThis.resolutionFixture.invalidations++ }',
}
const complete = await importTs('app/api/schedule/[id]/complete/route.ts', mocks)
const patch = await importTs('app/api/schedule/[id]/route.ts', mocks)
const defer = await importTs('app/api/schedule/[id]/defer/route.ts', mocks)
const plan = await importTs('app/api/schedule/plan/route.ts', mocks)
const dismiss = await importTs('app/api/schedule/dismiss/route.ts', mocks)
const mobileComplete = await importTs('app/api/mobile/schedule/[id]/complete/route.ts', mocks)
const { getDailyScheduleState } = await importTs('lib/schedule/service.ts', mocks)
const { scheduleEventVersion } = await importTs('lib/schedule/actions.ts')
const request = body => new Request('http://qa.invalid', {method:'POST',body:JSON.stringify(body)})
const params = id => ({params:Promise.resolve({id})})
const event = (overrides = {}) => ({id:'qa-task',user_id:'qa-owner',client_id:'QA-SCHEDULE-ONLY',title:'Review school notes',
  event_type:'custom',source:'manual',status:'scheduled',completed_at:null,start_at:'2026-10-15T13:00:00Z',end_at:'2026-10-15T13:30:00Z',
  timezone:'America/Chicago',all_day:false,priority:'medium',required:true,flexibility_type:'flexible',movable:true,approval_required:false,
  reschedule_allowed:true,reschedule_requires_approval:false,adjusted_start_at:null,adjusted_end_at:null,estimated_duration_minutes:30,
  updated_at:'2026-10-15T12:00:00Z',...overrides})
function fixture({events=[event()], school=false, calendar=[], tier='ember'} = {}) {
  mock.timers.setTime(now)
  const client={client_id:'QA-SCHEDULE-ONLY',auth_user_id:'qa-owner',program:tier,timezone:'America/Chicago',
    ...(school ? {school_dropoff_time:'08:00'} : {}), daily_structure_reviewed_at:'2026-10-15T12:00:00Z',
    onboarding_data:{kept:'existing',transitionMinutes:10}}
  const logic={program:tier,client:{id:client.client_id},nutrition:{dataStatus:'confirmed',calories:{percent:100},protein:{percent:100}},
    hydration:{status:'complete',target:80,remaining:0,consumed:80},assessments:{dailyCompleted:true},
    execution:{nutritionLogged:true,workoutComplete:false,recoveryComplete:true},workout:{assigned:false},workoutDecision:{canTrain:true},
    symptoms:{redFlag:false},recoveryStatus:{reasoning:'Existing guidance'},flameState:{streak:5,streakEligible:true,requirements:{requiredItems:{dailyCheckIn:true,hydration:true}}}}
  const f={client,logic,calendar,events:structuredClone(events),writes:[],invalidations:0,signedIn:true,failWrites:false}
  f.db={from(table) {
    const filters=[];let change
    function result() {
      const rows=table==='clients'?[client]:table==='anastasis_schedule_events'?f.events:[]
      const found=rows.filter(row=>filters.every(([key,value])=>key==='onboarding_data'&&typeof value==='string'?JSON.stringify(row[key])===value:row[key]==null&&value==null?true:row[key]===value))
      if(change&&f.failWrites)return {data:null,error:{message:'private storage failure'}}
      if(change) for(const row of found){f.writes.push({table,filters:structuredClone(filters),change:structuredClone(change)});Object.assign(row,structuredClone(change))}
      return {data:structuredClone(found),error:null}
    }
    const q={select(){return q},eq(k,v){filters.push([k,v]);return q},is(k,v){filters.push([k,v]);return q},or(){return q},
      update(value){change=value;return q},async order(){return result()},async maybeSingle(){const r=result();return {...r,data:r.data?.[0]||null}},then(resolve,reject){return Promise.resolve(result()).then(resolve,reject)}}
    return q
  }}
  globalThis.resolutionFixture=f
  return f
}
const load=f=>getDailyScheduleState({supabase:f.db,user:{id:'qa-owner'},client:structuredClone(f.client),date})

test('EMBER overdue completion saves once, advances, survives a fresh reader and updates shared required progress',async()=>{
  const f=fixture(),before=await load(f),streak=structuredClone(f.logic.flameState)
  assert.equal(before.dailyRecommendation.primary.eventId,'qa-task')
  const response=await complete.POST(request({}),params('qa-task'));assert.equal(response.status,200)
  const body=await response.json();assert.equal(body.event.status,'completed');assert.ok(body.event.completed_at)
  assert.notEqual(body.schedule.dailyRecommendation.primary.eventId,'qa-task')
  for(let i=0;i<2;i++){
    const state=await load(f);assert.equal(state.events.find(e=>e.id==='qa-task').status,'completed')
    assert.equal(state.todayActivities.completed,before.todayActivities.completed+1)
    assert.equal(state.todayActivities.total,before.todayActivities.total)
    assert.equal(state.overdueEvents.some(e=>e.id==='qa-task'),false)
  }
  assert.deepEqual(f.logic.flameState,streak)
  assert.equal((await complete.POST(request({}),params('qa-task'))).status,200)
  assert.equal(f.writes.filter(w=>w.table==='anastasis_schedule_events').length,1)
})

test('skip preserves history without completion or streak credit and cannot be overwritten by mobile completion',async()=>{
  const f=fixture(),before=await load(f)
  assert.equal((await patch.PATCH(request({status:'skipped'}),params('qa-task'))).status,200)
  const state=await load(f);assert.equal(state.events[0].status,'skipped');assert.equal(state.events[0].completed_at,null)
  assert.equal(state.todayActivities.completed,before.todayActivities.completed);assert.equal(state.todayActivities.total,before.todayActivities.total)
  assert.equal(state.nextActionableEvent,null)
  assert.equal((await mobileComplete.POST(request({}),params('qa-task'))).status,409)
  assert.equal(f.events[0].status,'skipped')
})

test('eligible rescheduling saves adjusted time, retains original time, and rejects stale and conflicting requests',async()=>{
  const f=fixture(),original=structuredClone(f.events[0]),version=scheduleEventVersion(original)
  const body={start_at:'2026-10-15T22:00:00Z',end_at:'2026-10-15T22:30:00Z',expected_version:version}
  assert.equal((await defer.POST(request(body),params('qa-task'))).status,200)
  const state=await load(f),saved=state.events.find(e=>e.id==='qa-task')
  assert.equal(saved.start_at,original.start_at);assert.equal(saved.adjusted_start_at,new Date(body.start_at).toISOString())
  assert.equal(saved.status,'scheduled');assert.equal(state.overdueEvents.length,0)
  assert.equal((await complete.POST(request({expected_version:version}),params('qa-task'))).status,409)
  f.events.push(event({id:'busy',start_at:'2026-10-15T23:00:00Z',end_at:'2026-10-15T23:30:00Z'}))
  assert.equal((await defer.POST(request({start_at:'2026-10-15T23:00:00Z',end_at:'2026-10-15T23:30:00Z'}),params('qa-task'))).status,409)
})

test('informational dismissal persists locally while source event, status, required progress, and busy time stay intact',async()=>{
  const info=event({id:'calendar:qa:occurrence',source:'external_calendar',calendar_event_id:'qa-provider',external_calendar_source:'Google',title:'Calendar notice'})
  const f=fixture({events:[],calendar:[info]}),before=await load(f),original=structuredClone(f.calendar)
  const response=await dismiss.POST(request({eventId:info.id,date}));assert.equal(response.status,200)
  const state=await load(f);assert.equal(state.events[0].dismissed_from_today,date)
  assert.equal(state.events[0].status,'scheduled');assert.equal(state.completedEvents.length,0)
  assert.equal(state.nextActionableEvent,null);assert.equal(state.todayActivities.total,before.todayActivities.total)
  assert.deepEqual(f.calendar,original);assert.ok(f.writes.every(w=>w.table==='clients'))
  assert.equal((await dismiss.POST(request({eventId:info.id,date}))).status,200)
  const external=fixture({events:[{...info,id:'qa-external'}]})
  for(const route of [complete,defer])assert.equal((await route.POST(request({start_at:'2026-10-15T22:00:00Z',end_at:'2026-10-15T22:30:00Z'}),params('qa-external'))).status,409)
  assert.equal(external.writes.length,0)
})

test('generated School drop-off and recurring commitments save per-occurrence outcomes without editing their templates',async()=>{
  const f=fixture({events:[],school:true}),before=await load(f),id=`virtual-school-dropoff-${date}`
  assert.equal(before.dailyRecommendation.primary.eventId,id)
  assert.equal((await plan.POST(request({eventId:id,date,action:'complete'}))).status,200)
  const state=await load(f);assert.equal(state.events.find(e=>e.id===id).status,'completed')
  assert.equal(state.todayActivities.completed,before.todayActivities.completed+1)
  assert.equal(f.client.school_dropoff_time,'08:00');assert.equal(f.client.onboarding_data.kept,'existing')
  f.client.school_dropoff_time=null
  const history=await load(f);assert.equal(history.events.find(e=>e.id===id).title,'School drop-off')
  assert.equal(history.events.find(e=>e.id===id).status,'completed')
  assert.equal((await plan.POST(request({eventId:id,date,action:'skip'}))).status,409)
})

test('new request contexts retain saved outcomes across sign-out/sign-in simulation; unauthenticated requests cannot save',async()=>{
  const f=fixture();assert.equal((await complete.POST(request({}),params('qa-task'))).status,200)
  f.signedIn=false;assert.equal((await patch.PATCH(request({status:'skipped'}),params('qa-task'))).status,401)
  f.signedIn=true;assert.equal((await load(f)).events[0].status,'completed')
  // This verifies persistence across request identities, not a live auth session.
})

test('all tiers retain real health completion requirements and owner/client scoping',async()=>{
  for(const tier of ['ember','ignite','phoenix']){
    const f=fixture({tier,events:[event({event_type:'check_in'})]})
    f.logic.assessments.dailyCompleted=false
    assert.equal((await complete.POST(request({}),params('qa-task'))).status,409)
    assert.equal(f.logic.assessments.dailyCompleted,false);assert.equal(f.writes.length,0)
    f.events[0]=event({client_id:'OTHER-CLIENT'})
    assert.equal((await complete.POST(request({}),params('qa-task'))).status,404)
    f.events[0]=event({user_id:'OTHER-OWNER'})
    assert.equal((await complete.POST(request({}),params('qa-task'))).status,404)
  }
})

test('two rapid conflicting saved and virtual actions have exactly one winning outcome',async()=>{
  let f=fixture()
  const responses=await Promise.all([complete.POST(request({}),params('qa-task')),patch.PATCH(request({status:'skipped'}),params('qa-task'))])
  assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);assert.equal(f.writes.filter(w=>w.table==='anastasis_schedule_events').length,1)
  f=fixture({events:[],school:true})
  const id=`virtual-school-dropoff-${date}`
  const virtual=await Promise.all(['complete','skip'].map(action=>plan.POST(request({eventId:id,date,action}))))
  assert.deepEqual(virtual.map(r=>r.status).sort(),[200,409]);assert.equal(f.writes.length,1)
  assert.equal((await load(f)).events.find(e=>e.id===id).status,f.client.onboarding_data.scheduleOverrides[id].status)
})

test('failed writes retain unresolved state; retry saves without false progress',async()=>{
  const f=fixture(),before=await load(f);f.failWrites=true
  assert.equal((await complete.POST(request({}),params('qa-task'))).status,503)
  assert.equal((await load(f)).todayActivities.completed,before.todayActivities.completed)
  assert.equal(f.invalidations,0);f.failWrites=false
  assert.equal((await complete.POST(request({}),params('qa-task'))).status,200)
  assert.equal(f.invalidations,1)
})

test('Postgres conditional status writes cannot store conflicting outcomes',async()=>{
  const db=new PGlite()
  try{
    await db.exec("create table events(id text primary key,user_id text,client_id text,status text,updated_at int); insert into events values('task','owner','client','scheduled',1)")
    const sql='update events set status=$1,updated_at=2 where id=$2 and user_id=$3 and client_id=$4 and status=$5 and updated_at=1 returning status'
    const results=await Promise.all(['completed','skipped'].map(status=>db.query(sql,[status,'task','owner','client','scheduled'])))
    assert.equal(results.reduce((n,r)=>n+r.rows.length,0),1)
    const result=await db.query('select status from events');assert.equal(result.rows[0].status,'completed')
  } finally {await db.close()}
})


test('moved virtual health activities keep authoritative activity completion over an earlier schedule snapshot',async()=>{
  const f=fixture({events:[]})
  f.client.preferred_workout_time='16:00'
  const first=await load(f),id=`virtual-workout-${date}`,workout=first.events.find(e=>e.id===id)
  f.client.onboarding_data.scheduleOverrides={[id]:{status:'scheduled',adjusted_start_at:'2026-10-15T22:00:00Z',adjusted_end_at:'2026-10-15T22:30:00Z',event_snapshot:workout}}
  f.logic.execution.workoutComplete=true
  // The daily execution plan is the completion source for virtual workouts.
  const loaded=await getDailyScheduleState({supabase:f.db,user:{id:'qa-owner'},client:structuredClone(f.client),date,
    dailyPlan:{date,timezone:'America/Chicago',timing:{workoutTime:'16:00'},workoutCompleted:true,completedWorkoutAt:'2026-10-15T21:00:00Z',completedDailyTasks:[]},logic:f.logic})
  assert.equal(loaded.events.find(e=>e.id===id).status,'completed')
  assert.equal(loaded.overdueEvents.some(e=>e.id===id),false)
})

test('matching health logs never complete an informational calendar event or remove its dismissal action',async()=>{
  const info=event({id:'calendar:health:occurrence',source:'external_calendar',calendar_event_id:'provider-workout',event_type:'workout'})
  const f=fixture({events:[],calendar:[info]});f.logic.execution.workoutComplete=true
  const state=await load(f)
  assert.equal(state.events.find(e=>e.id===info.id).status,'scheduled')
  assert.equal(state.completedEvents.some(e=>e.id===info.id),false)
  assert.equal((await dismiss.POST(request({eventId:info.id,date}))).status,200)
  assert.equal(f.calendar[0].status,'scheduled')
})
