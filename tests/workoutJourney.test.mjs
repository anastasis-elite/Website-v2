import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

const activity = await importTs('lib/workout/activity.ts')
const session = await importTs('lib/workout/session.ts')
const { getDailyTraining } = await importTs('lib/dashboard/dailyTraining.ts')
const engines = await importTs('lib/dashboard/logic/engines.ts')
const workout = await importTs('app/api/workout-log/route.ts', {
  'next/server': 'export const NextResponse = { json: (body, init) => Response.json(body, init) }',
  '@/lib/supabase/server': 'export const createClient = async () => globalThis.workoutJourneyDb',
  '@/lib/dashboard/invalidateDailyPlan': 'export const invalidateDailyPlan = () => { globalThis.workoutJourneyRefreshes = (globalThis.workoutJourneyRefreshes || 0) + 1 }',
})

function database() {
  const state = { user: { id: 'fresh-ember-test-user' }, rows: [], writes: 0 }
  const client = { client_id: 'fresh-ember-test-customer', auth_user_id: state.user.id, program: 'ember', timezone: 'America/Chicago' }
  globalThis.workoutJourneyDb = {
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    from(table) {
      const filters = []
      const q = { select(){return q}, eq(key,value){filters.push(row => row[key] === value);return q}, gte(key,value){filters.push(row => row[key] >= value);return q}, lt(key,value){filters.push(row => row[key] < value);return q}, order(){return q}, limit(){return q}, maybeSingle:async()=>({data:filters.every(f=>f(client))?client:null,error:null}), then(done){return Promise.resolve({data: table==='workout_logs'?state.rows.filter(row=>filters.every(f=>f(row))).toReversed():[],error:null}).then(done)} }
      return q
    },
    async rpc(name,args) {
      assert.equal(name,'save_daily_workout'); state.writes++
      const payload={...structuredClone(args.p_payload),workout_started_at:args.p_payload.workout_date,workout_date:args.p_payload.workout_local_date}, keys=session.workoutSessionKeys(args.p_payload.exercise_logs)
      let existing=state.rows.find(row=>row.day_name===payload.day_name&&row.workout_source===payload.workout_source&&session.matchingWorkoutPlan(row.exercise_logs,keys))
      if(existing) Object.assign(existing,payload)
      else {existing={id:`session-${state.rows.length+1}`,...payload};state.rows.push(existing)}
      return {data:structuredClone(existing),error:null}
    },
  }
  return {state,client}
}
const request = body => new Request('https://local-test.invalid/api/workout-log',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
function payload(client,logs,source='recommended') { return {client_id:client.client_id,program:client.program,day_name:'First useful workout',workout_source:source,workout_date:new Date().toISOString(),planned_exercises:logs.map(({completed,...exercise})=>exercise),exercise_logs:logs,completed:true} }
const confirmedAt = () => new Date().toISOString()

test('real recovery exercises use time, breaths or completion and totals never treat them as strength volume',()=>{
  const exercises=[{exercise:'Walking',duration_label:'10 minutes'}, {exercise:'90/90 breathing',duration_label:'5 slow breaths',recommended_reps:5}, {exercise:'Cat-cow',exercise_category:'recovery',reps:8}, {exercise:'Mobility flow',duration_seconds:30}, {exercise:'Walking lunge',exercise_category:'strength',sets:2,reps:8,load_type:'bodyweight',recommended_weight:20}]
  assert.deepEqual(exercises.map(e=>activity.activityDose(e).metric),['minutes','breaths','completion','seconds','reps'])
  assert.equal(activity.activityDose(exercises.at(-1)).weight,0)
  assert.deepEqual(activity.summarizeActivityUnits(exercises),{sets:2,reps:16,minutes:10.5,breaths:5,activities:1})
})

test('server reload beats stale browser data, newer unsaved drafts survive, and legacy arrays get safe defaults',()=>{
  const initial=session.initialWorkoutLogs([{id:'squat',exercise:'Squat',sets:2,reps:8}])
  const server={updated_at:'2026-10-12T15:00:00Z',exercise_logs:[{...initial[0],completed:true,set_logs:[{reps:8,weight:0}]}]}
  const stale={logs:initial,draft:[{amount:8,weight:0}],dirty:false,modifiedAt:'2026-10-12T14:00:00Z'}
  assert.equal(session.resumeWorkoutSession(initial,stale,server).logs[0].completed,true)
  const dirty={...stale,dirty:true,modifiedAt:'2026-10-12T16:00:00Z'}
  assert.equal(session.resumeWorkoutSession(initial,dirty,server).logs[0].completed,false)
  assert.equal(session.resumeWorkoutSession(initial,dirty,server).dirty,true)
  assert.deepEqual(session.resumeWorkoutSession(initial,null,{exercise_logs:[{id:'squat',exercise:'Squat'}]}).logs[0].set_logs,[])
})

test('owned fresh EMBER activity save → server reload → new session preserves units and progress',async()=>{
  const {state,client}=database(), now=confirmedAt()
  const logs=session.initialWorkoutLogs([{id:'squat',exercise:'Squat',sets:1,reps:8,load_type:'bodyweight'}, {id:'walk',exercise:'Walking',duration_label:'10 minutes'}, {id:'breath',exercise:'90/90 breathing',duration_label:'5 slow breaths',reps:5}, {id:'mobility',exercise:'Cat-cow',exercise_category:'recovery'}])
  Object.assign(logs[0],{completed:true,set_logs:[{reps:8,weight:0,weight_unit:'lb',completed_at:now}]})
  Object.assign(logs[1],{completed:true,actual_duration:10,duration_unit:'minutes',confirmed_at:now})
  Object.assign(logs[2],{completed:true,actual_breaths:5,actual_reps:0,confirmed_at:now})
  Object.assign(logs[3],{completed:true,activity_completed:true,confirmed_at:now})
  const saved=await workout.POST(request(payload(client,logs)))
  assert.equal(saved.status,200);assert.equal((await saved.json()).completed,true)
  const keys=encodeURIComponent(JSON.stringify(session.workoutSessionKeys(logs)))
  const reload=()=>workout.GET(new Request(`https://local-test.invalid/api/workout-log?clientId=${client.client_id}&dayName=First%20useful%20workout&planKeys=${keys}`))
  let loaded=await reload();assert.equal(loaded.status,200);assert.match(loaded.headers.get('Cache-Control'),/no-store/)
  const row=(await loaded.json()).session
  assert.equal(row.completed,true);assert.equal(row.exercise_logs[2].actual_breaths,5);assert.equal(row.exercise_logs[0].actual_total_reps,8)
  assert.deepEqual(activity.summarizeActivityUnits(row.exercise_logs,true),{sets:1,reps:8,minutes:10,breaths:5,activities:1})
  // A fresh browser has no localStorage; server progress is still recovered.
  assert.equal(session.resumeWorkoutSession(session.initialWorkoutLogs(logs),null,row).logs[0].completed,true)
  assert.ok(globalThis.workoutJourneyRefreshes>0)
  state.user={id:'different-user'};assert.equal((await reload()).status,404)
  state.user=null;assert.equal((await reload()).status,401)
})

test('manual workouts complete independently of the preserved recommended plan; malformed units and false confirmations fail',async()=>{
  const {state,client}=database(), now=confirmedAt()
  const logs=[{id:'squat',exercise:'Squat',sets:1,completed:true,set_logs:[{reps:8,weight:0,weight_unit:'lb',completed_at:now}]}]
  const body={...payload(client,logs,'manual'),planned_exercises:[{exercise:'Original squat'},{exercise:'Original row'},{exercise:'Original press'}]}
  assert.equal((await workout.POST(request(body))).status,200);assert.equal(state.rows[0].completed,true);assert.equal(state.rows[0].planned_exercises.length,3)
  const walk={exercise:'Walking',duration_minutes:10,completed:true,actual_duration:10,duration_unit:'reps',confirmed_at:now}
  assert.equal((await workout.POST(request(payload(client,[walk])))).status,400)
  assert.equal((await workout.POST(request(payload(client,[{exercise:'Breathing',completed:true,actual_breaths:2.5,confirmed_at:now}])))).status,400)
  assert.equal((await workout.POST(request({...body,exercise_logs:[{...logs[0],skipped:true}]}))).status,400)
  assert.equal((await workout.POST(request({...body,workout_date:'2000-01-01T12:00:00Z'}))).status,400)
  assert.equal(state.writes,1)
})

test('daily training distinguishes normal/reduced/recovery and missing/partial inputs honestly',()=>{
  const base={workoutDecision:{canTrain:true,adjustmentLevel:'level_0_full_plan',reasonForModification:'Assigned plan'},symptoms:{redFlag:false},assessments:{dailyCompleted:false},recoveryCheck:{energy:null,stress:null,soreness:null},sleep:{hours:null,quality:null}}
  assert.equal(getDailyTraining(base).mode,'normal_training');assert.equal(getDailyTraining(base).readiness,'not_logged')
  assert.match(getDailyTraining(base).readinessNote,/not confirmed/)
  assert.equal(getDailyTraining({...base,assessments:{dailyCompleted:true},recoveryCheck:{energy:7}}).readiness,'partial')
  assert.equal(getDailyTraining({...base,workoutDecision:{...base.workoutDecision,adjustmentLevel:'level_2_moderate_modify'}}).mode,'reduced_capacity')
  assert.equal(getDailyTraining({...base,workoutDecision:{...base.workoutDecision,canTrain:false}}).mode,'recovery_only')
})

test('EMBER meal guidance leaves intake unknown without imposing an unavailable meal-logging requirement',()=>{
  const macros={target:100,consumed:0,percent:0,remaining:100},blocks={morning:{calories:30,protein:30,carbs:30,fats:30},midday:{calories:40,protein:40,carbs:40,fats:40},evening:{calories:30,protein:30,carbs:30,fats:30}}
  const nutrition={dataStatus:'needs_input',calories:macros,protein:macros,carbs:macros,fats:macros,blockTargets:blocks,blockConsumed:{},postWorkoutPriority:'Review meal guidance'}
  const result=engines.runFuelReadinessEngine({program:'ember',client:{timezone:'America/Chicago'},mealEntries:[]},{percent:0},nutrition,{status:'normal_training_day'})
  assert.equal(result.status,'guidance_only');assert.equal(result.confidence,'low');assert.equal(result.currentBlockOnTrack,false)
  assert.doesNotMatch(result.preWorkoutAction,/log/i);assert.match(result.reasoning,/not confirmed/)
})

test('workout history SQL preserves changed same-day plans and historical dates while enforcing ownership',async()=>{
  const db=new PGlite(),owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222'
  try {
    await db.exec(`create role anon;create role authenticated;create schema auth;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
      create table clients(client_id text primary key,auth_user_id uuid not null,program text not null);
      create table workout_logs(id uuid primary key default gen_random_uuid(),client_id text not null,auth_user_id uuid not null,program text,day_name text,workout_source text,workout_date timestamptz,planned_exercises jsonb,exercise_logs jsonb,completed boolean,updated_at timestamptz);
      alter table clients enable row level security;alter table workout_logs enable row level security;
      create policy client_owner on clients to authenticated using(auth_user_id=auth.uid()) with check(auth_user_id=auth.uid());
      create policy workout_owner on workout_logs to authenticated using(auth_user_id=auth.uid()) with check(auth_user_id=auth.uid());
      grant select,update on clients to authenticated;grant select,insert,update on workout_logs to authenticated;`)
    await db.query('insert into clients values($1,$2,$3)',['ember-test',owner,'ember'])
    const migration = readFileSync('supabase/migrations/20261012173013_member_program_ownership_and_workout_history.sql','utf8')
    await db.exec(migration.slice(migration.indexOf('-- Additive replacement;')))
    await db.exec(`set role authenticated;set request.jwt.claim.sub='${owner}'`)
    const save=async(logs,date='2026-11-01T18:00:00Z',start='2026-11-01T05:00:00Z',end='2026-11-02T06:00:00Z')=>{
      const value={program:'ember',day_name:'Sunday',workout_source:'recommended',workout_date:date,exercise_logs:logs,planned_exercises:logs,completed:false}
      return (await db.query('select save_daily_workout($1,$2,$3,$4::jsonb) as session',['ember-test',start,end,JSON.stringify(value)])).rows[0].session
    }
    const first=await save([{id:'squat',session_key:'squat:0',actual_reps:8}])
    const changed=await save([{id:'walk',session_key:'walk:0',actual_duration:10,duration_unit:'minutes'}])
    assert.notEqual(first.id,changed.id)
    assert.equal((await db.query('select exercise_logs from workout_logs where id=$1',[first.id])).rows[0].exercise_logs[0].actual_reps,8)
    const updated=await save([{id:'walk',session_key:'walk:0',actual_duration:15,duration_unit:'minutes'}])
    assert.equal(updated.id,changed.id);assert.equal((await db.query('select * from workout_logs')).rows.length,2)
    // Chicago's spring day has 23 hours; the SQL accepts correct civil bounds.
    await save([{id:'walk',session_key:'walk:0',actual_duration:5}],'2026-03-08T18:00:00Z','2026-03-08T06:00:00Z','2026-03-09T05:00:00Z')
    assert.equal((await db.query('select * from workout_logs')).rows.length,3)
    await assert.rejects(save([{id:'walk'}],'2026-11-02T06:00:00Z'),/outside local day/)
    await db.exec(`set request.jwt.claim.sub='${other}'`)
    assert.equal((await db.query('select * from workout_logs')).rows.length,0)
    await assert.rejects(save([{id:'squat'}]),/Client not found/)
  } finally { await db.close() }
})
