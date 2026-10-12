import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'
const mocks={
 'next/server': 'export const NextResponse = { json: (body, init) => Response.json(body, init) }',
 '@/lib/supabase/server':'export const createClient = async () => globalThis.dashboardTestDb',
 '@/lib/dashboard/getDashboardContext':'export const getDashboardContext = async () => globalThis.dashboardTestContext',
 '@/lib/dashboard/invalidateDailyPlan':'export const invalidateDailyPlan = () => { globalThis.dashboardInvalidations = (globalThis.dashboardInvalidations || 0) + 1 }',
 '@/lib/schedule/service':'export const getDailyScheduleState = async () => globalThis.dashboardTestSchedule',
}
const workout=await importTs('app/api/workout-log/route.ts',mocks)
const manualWorkout=await importTs('app/api/workout-set-log/route.ts',mocks)
const {dashboardApiError}=await importTs('lib/dashboard/apiError.ts',mocks)
const preferences=await importTs('app/api/dashboard/preferences/route.ts',mocks)
const schedulePatch=await importTs('app/api/schedule/[id]/route.ts',mocks)
const scheduleComplete=await importTs('app/api/schedule/[id]/complete/route.ts',mocks)
const scheduleDefer=await importTs('app/api/schedule/[id]/defer/route.ts',mocks)
const schedulePlan=await importTs('app/api/schedule/plan/route.ts',mocks)
const owner='qa-user',clientId='QA-ONLY'
function database({signedIn=true, eventType='workout',fixed=false}={}) {
 const client={client_id:clientId,auth_user_id:owner,program:'ignite',timezone:'America/Chicago',execution_style:'hybrid',carousel_style:'section',onboarding_data:{timezone:'America/Chicago',kept:'existing'}}
 const event={id:'qa-event',client_id:clientId,user_id:owner,event_type:eventType,status:'scheduled',flexibility_type:fixed?'fixed':'flexible',movable:!fixed,approval_required:fixed}
 const writes=[]
 const db={auth:{getUser:async()=>({data:{user:signedIn?{id:owner}:null}})},writes,client,event,
 from(table){const filters=[];let mutation=null;const q={select(){return q},eq(key,value){filters.push([key,value]);return q},gte(){return q},lt(){return q},order(){return q},limit(){return q},update(value){mutation=value;return q},insert(value){mutation=value;return q},maybeSingle:async()=>resolve(),single:async()=>resolve(),then(done){return Promise.resolve(resolve()).then(done)}}
 function resolve(){const row=table==='clients'?client:table==='anastasis_schedule_events'?event:null;const data=row&&filters.every(([key,value])=>row[key]===value)?row:null;if(mutation&&data)writes.push({table,mutation});return {data,error:null}}return q},
 rpc:async(name,args)=>{writes.push({rpc:name,args});return {data:{id:'qa-workout'},error:null}}}
 globalThis.dashboardTestDb=db;globalThis.dashboardTestContext={supabase:db,user:{id:owner},client}
 return db
}
const req=(body)=>new Request('http://qa.test',{method:'POST',body:JSON.stringify(body)})
test('workout API denies anonymous users, ownership mismatch and program mismatch',async()=>{
 database({signedIn:false});assert.equal((await workout.POST(req({}))).status,401)
 const db=database();assert.equal((await workout.POST(req({client_id:'OTHER'}))).status,404)
 assert.equal((await workout.POST(req({client_id:clientId,program:'phoenix'}))).status,403);assert.equal(db.writes.length,0)
})
test('confirmed sets are required; partial save is honest and invalidates daily recommendations',async()=>{
 const db=database(),base={client_id:clientId,program:'ignite',day_name:'QA strength',planned_exercises:[{exercise:'Squat',sets:2,reps:8}],workout_date:new Date().toISOString(),completed:true}
 const falseClaim=await workout.POST(req({...base,exercise_logs:[{exercise:'Squat',sets:2,completed:true,actual_reps:0,set_logs:[]}]}))
 assert.equal(falseClaim.status,400)
 const result=await workout.POST(req({...base,exercise_logs:[{exercise:'Squat',sets:2,completed:false,actual_reps:8,set_logs:[{reps:8,weight:15,completed_at:new Date().toISOString()}]}]}))
 assert.equal(result.status,200);assert.equal((await result.json()).completed,false)
 assert.equal(db.writes[0].rpc,'save_daily_workout');assert.equal(db.writes[0].args.p_payload.completed,false);assert.ok(globalThis.dashboardInvalidations>0)
})
test('manual set API keeps one set partial and requires an explicit exercise finish',async()=>{
 const db=database(),writes=[]
 db.from=table=>{
  let mutation=null
  const q={select(){return q},eq(){return q},gte(){return q},lt(){return q},order(){return q},limit(){return q},insert(value){mutation=value;return q},update(value){mutation=value;return q},upsert(value){mutation=value;return q},maybeSingle:async()=>resolve(),single:async()=>resolve()}
  function resolve(){if(mutation)writes.push({table,mutation});return {data:table==='clients'?db.client:table==='workout_logs'?(mutation?{id:'manual-workout'}:null):{id:'manual-exercise-session'},error:null}}
  return q
 }
 const set={weight:15,reps:8,weight_unit:'lb',completed_at:new Date().toISOString()}
 const base={client_id:clientId,program:'ignite',exercise:{id:'squat',exercise:'Squat',sets:2},planned_exercises:[{exercise:'Squat',sets:2}],exercise_logs:[{id:'squat',exercise:'Squat',sets:2,actual_reps:8,completed:true}],sets:[set]}
 assert.equal((await manualWorkout.POST(req(base))).status,200)
 assert.equal(writes.find(write=>write.table==='workout_logs').mutation.completed,false)
 assert.equal(writes.find(write=>write.table==='workout_logs').mutation.exercise_logs[0].completed,false)
 writes.length=0
 assert.equal((await manualWorkout.POST(req({...base,sets:[set,set],exercise_finished_at:new Date().toISOString()}))).status,200)
 assert.equal(writes.find(write=>write.table==='workout_logs').mutation.completed,true)
 assert.equal((await manualWorkout.POST(req({...base,sets:[{...set,reps:0}]}))).status,400)
})
test('dashboard API auth/setup redirects remain clear authorization errors',()=>{
 assert.equal(dashboardApiError({digest:'NEXT_REDIRECT;replace;/login;307;'},'Failed').status,401)
 assert.equal(dashboardApiError({digest:'NEXT_REDIRECT;replace;/onboarding;307;'},'Failed').status,403)
})
test('display preferences preserve onboarding and unspecified existing choices',async()=>{
 const db=database();const response=await preferences.PATCH(req({carouselStyle:'step',transitionMinutes:15}))
 assert.equal(response.status,200)
 const saved=db.writes[0].mutation;assert.equal(saved.carousel_style,'step');assert.equal(saved.execution_style,undefined);assert.deepEqual(saved.onboarding_data,{timezone:'America/Chicago',kept:'existing',transitionMinutes:15})
 assert.equal((await preferences.PATCH(req({executionStyle:'invented'}))).status,400)
})
test('both schedule endpoints reject fabricated health completion; personal actions can complete',async()=>{
 let db=database();const params={params:Promise.resolve({id:'qa-event'})}
 assert.equal((await schedulePatch.PATCH(req({status:'completed'}),params)).status,409)
 assert.equal((await scheduleComplete.POST(req({}),params)).status,409);assert.equal(db.writes.length,0)
 db=database({eventType:'personal'});assert.equal((await scheduleComplete.POST(req({}),params)).status,200);assert.equal(db.writes[0].mutation.status,'completed')
})
test('skip dismisses without completion and cannot change a fixed commitment',async()=>{
 let db=database({eventType:'personal'});const params={params:Promise.resolve({id:'qa-event'})}
 assert.equal((await schedulePatch.PATCH(req({status:'skipped'}),params)).status,200);assert.equal(db.writes[0].mutation.status,'skipped');assert.equal(db.writes[0].mutation.completed_at,undefined)
 db=database({eventType:'work',fixed:true});assert.equal((await schedulePatch.PATCH(req({status:'skipped'}),params)).status,409);assert.equal(db.writes.length,0)
})
test('virtual move records a suggested time separately and refuses overlap; skip persists',async()=>{
 const db=database(),now=new Date(),date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(now)
 const event={id:'virtual-qa',virtual:true,event_type:'workout',status:'scheduled',flexibility_type:'flexible',movable:true,start_at:new Date(now.getTime()+60000).toISOString(),end_at:new Date(now.getTime()+120000).toISOString()}
 globalThis.dashboardTestSchedule={date,timezone:'America/Chicago',events:[event],preferences:{transitionMinutes:10}}
 assert.equal((await schedulePlan.POST(req({eventId:event.id,action:'skip'}))).status,200)
 const saved=db.writes[0].mutation.onboarding_data.scheduleOverrides[event.id];assert.equal(saved.status,'skipped');assert.equal(saved.completed_at,null)
 const start=new Date(now.getTime()+3600000),end=new Date(now.getTime()+5400000)
 const moved=await schedulePlan.POST(req({eventId:event.id,action:'move',start_at:start.toISOString(),end_at:end.toISOString()}))
 // Run time can fall near midnight; valid windows must remain on the selected day.
 if(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(start)===date) {assert.equal(moved.status,200);assert.equal(db.writes.at(-1).mutation.onboarding_data.scheduleOverrides[event.id].adjusted_start_at,start.toISOString())}
 else assert.equal(moved.status,400)
})

test('schedule activity types cannot be relabeled to bypass real completion logging',async()=>{
 const params={params:Promise.resolve({id:'qa-event'})}
 let db=database({eventType:'workout'})
 assert.equal((await schedulePatch.PATCH(req({event_type:'custom'}),params)).status,409)
 assert.equal(db.writes.length,0)
 db=database({eventType:'custom'})
 assert.equal((await schedulePatch.PATCH(req({event_type:'workout',status:'completed'}),params)).status,409)
 assert.equal(db.writes.length,0)
})

test('approved commitments and finished events reject unsupported skip/move/completion transitions',async()=>{
 const params={params:Promise.resolve({id:'qa-event'})}
 let db=database({eventType:'personal'});db.event.approval_required=true
 assert.equal((await schedulePatch.PATCH(req({status:'skipped'}),params)).status,409)
 assert.equal(db.writes.length,0)
 db=database({eventType:'personal'});db.event.status='cancelled'
 assert.equal((await scheduleComplete.POST(req({}),params)).status,409)
 assert.equal((await scheduleDefer.POST(req({start_at:'2030-06-18T14:00:00Z',end_at:'2030-06-18T14:30:00Z'}),params)).status,409)
 assert.equal(db.writes.length,0)
 db.event.status='completed'
 assert.equal((await scheduleComplete.POST(req({}),params)).status,200)
 assert.equal(db.writes.length,0)
 globalThis.dashboardTestSchedule={events:[{id:'virtual-done',virtual:true,status:'completed'}]}
 assert.equal((await schedulePlan.POST(req({eventId:'virtual-done',action:'skip'}))).status,409)
 assert.equal(db.writes.length,0)
})
