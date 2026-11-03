import assert from 'node:assert/strict'
import test, { after, mock } from 'node:test'
import { importTs } from './typescriptModule.mjs'

mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-11-03T15:00:00Z') })
after(() => mock.timers.reset())
const route = await importTs('app/api/workout-log/route.ts', {
  'next/server': 'export const NextResponse = { json: (body, init) => Response.json(body, init) }',
  '@/lib/supabase/server': 'export const createClient = async () => globalThis.manualFinishApi.db',
  '@/lib/analytics/server': 'export const recordConversion = async () => { throw new Error("Read summary must not emit conversion events") }',
  '@/lib/dashboard/invalidateDailyPlan': 'export const invalidateDailyPlan = () => { throw new Error("Read summary must not invalidate/write") }',
})
const { createManualCardioExercise } = await importTs('lib/workout/manualCardio.ts')
const { manualExerciseSignature } = await importTs('lib/workout/manualFinish.ts')
const day = '2026-11-03', stamp = '2026-11-03T14:00:00Z'
const owner = 'manual-owner', other = 'other-owner'
const client = { client_id: 'MANUAL-OWN', auth_user_id: owner, program: 'ignite', timezone: 'America/Chicago', access: true, active: true }
const clone = value => structuredClone(value)
function sets(count) { return Array.from({ length: count }, (_, index) => ({ id: `set-${index + 1}`, set_number: index + 1, reps: 8, weight: 17.5, weight_unit: 'kg', completed_at: stamp })) }
function strength(count = 2, patch = {}) { return { id: 'owned-occurrence', exercise: 'Dumbbell press', exercise_category: 'strength', selected_variant_id: 'variant-dumbbell', selected_equipment: 'dumbbell', sets: 4, planned_sets: 4, user_intent: { desired_set_count: 1 }, completed: count >= 4, set_logs: sets(count), ...patch } }
function saved(logs = [strength()], patch = {}) { return { id: 'saved-strength', client_id: client.client_id, auth_user_id: owner, program: client.program, workout_source: 'manual', day_name: 'Manual Workout', workout_date: day, workout_started_at: '2026-11-03T13:00:00Z', updated_at: stamp, completed: true, exercise_logs: logs, planned_exercises: [{ sets: 1 }], ...patch } }
function fixture(rows = [], { actor = owner, fail = null } = {}) {
  const stored = clone(rows), initial = clone(rows), reads = [], mutations = []
  const clients = [client, { ...client, client_id: 'MANUAL-OTHER', auth_user_id: other }]
  const db = { auth: { getUser: async () => ({ data: { user: actor ? { id: actor } : null } }) }, from(table) {
    assert.ok(['clients','workout_logs'].includes(table), `Unexpected table: ${table}`)
    const filters = []; let sorting, maximum
    const q = { select(){return q},eq(key,value){filters.push(['eq',key,value]);return q},gte(key,value){filters.push(['gte',key,value]);return q},lt(key,value){filters.push(['lt',key,value]);return q},
      order(key,options){sorting=[key,options?.ascending !== false];return q},limit(value){maximum=value;return q},
      insert(value){mutations.push(value);throw new Error('No insert allowed')},update(value){mutations.push(value);throw new Error('No update allowed')},upsert(value){mutations.push(value);throw new Error('No upsert allowed')},
      maybeSingle:async()=>result(true),then(resolve,reject){return Promise.resolve().then(()=>result(false)).then(resolve,reject)},
    }
    function result(single) {
      reads.push({table,filters:clone(filters),maximum})
      if(fail===table)return {data:null,error:{message:'private-health-answer / synthetic database detail'}}
      let values=(table==='clients'?clients:stored).filter(row=>filters.every(([op,key,value])=>{
        if(op==='eq')return row[key]===value
        if(row[key]==null)return false
        const a=key.endsWith('_at')?Date.parse(row[key]):row[key],b=key.endsWith('_at')?Date.parse(value):value
        return op==='gte'?a>=b:a<b
      }))
      if(sorting){const [key,ascending]=sorting;values.sort((a,b)=>String(a[key]).localeCompare(String(b[key]))*(ascending?1:-1))}
      if(maximum)values=values.slice(0,maximum)
      return {data:single?clone(values[0]||null):clone(values),error:null}
    }
    return q
  },rpc(){throw new Error('Read summary must not call a write RPC')}}
  const state={db,stored,reads,mutations,verify(){assert.deepEqual(stored,initial);assert.deepEqual(mutations,[])}}
  globalThis.manualFinishApi=state;return state
}
const request = (patch = {}) => new Request('https://manual.test/api/workout-log?' + new URLSearchParams({clientId:client.client_id,manualSummary:'1',date:day,program:client.program,...patch}))
const read = patch => route.GET(request(patch))

test('confirmed saved manual strength summary keeps original denominator and exact actual units without generating or writing',async()=>{
  const log=strength(2,{notes:'private-health-answer',prescription:{private:'private-health-answer'},baseline_weight:999})
  const row=saved([log],{private_metadata:'private-health-answer'}),state=fixture([row])
  const response=await read(),summary=await response.json()
  assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store')
  assert.deepEqual({version:summary.version,clientId:summary.clientId,authUserId:summary.authUserId,program:summary.program,date:summary.date},{version:1,clientId:client.client_id,authUserId:owner,program:client.program,date:day})
  assert.equal(summary.sessions.length,1);assert.equal(summary.sessions[0].id,row.id)
  assert.deepEqual(summary.sessions[0].progress,{completedSets:2,totalSets:4,requiredSets:2});assert.equal(summary.completed,true)
  const actual=summary.sessions[0].exercises[0]
  assert.equal(actual.plannedSets,4);assert.equal(actual.completed,false,'Exercise full prescription remains distinct from workout half threshold')
  assert.deepEqual(actual.setLogs.map(({reps,weight,unit})=>({reps,weight,unit})),[{reps:8,weight:17.5,unit:'kg'},{reps:8,weight:17.5,unit:'kg'}])
  assert.equal(actual.signature,manualExerciseSignature(log));assert.doesNotMatch(JSON.stringify(summary),/private-health-answer|baseline_weight|prescription|onboarding_data/)
  for(const query of state.reads.filter(row=>row.table==='workout_logs')){
    assert.ok(query.filters.some(([op,key,value])=>op==='eq'&&key==='client_id'&&value===client.client_id))
    assert.ok(query.filters.some(([op,key,value])=>op==='eq'&&key==='auth_user_id'&&value===owner))
    assert.ok(query.filters.some(([op,key,value])=>op==='eq'&&key==='day_name'&&['Manual Workout','Manual Cardio'].includes(value)))
  }
  state.verify()
})

test('below-half saved work remains partial even if stored or local-looking completed flags claim complete',async()=>{
  const state=fixture([saved([strength(1,{completed:true})],{completed:true})])
  const summary=await (await read()).json()
  assert.equal(summary.completed,false);assert.equal(summary.sessions[0].completed,false)
  assert.deepEqual(summary.sessions[0].progress,{completedSets:1,totalSets:4,requiredSets:2})
  assert.equal(summary.sessions[0].exercises[0].plannedSets,4);state.verify()
})

test('manual cardio summary preserves confirmed actual duration and stable identity without strength-set invention',async()=>{
  const plan=createManualCardioExercise('cycling','seconds','12345678-1234-4234-8234-123456789abc')
  const log={...plan,actual_duration:75,completed:true,skipped:false,confirmed_at:stamp,set_logs:[]}
  const state=fixture([saved([log],{id:'saved-cardio',day_name:'Manual Cardio'})])
  const summary=await (await read()).json(),exercise=summary.sessions[0].exercises[0]
  assert.equal(summary.completed,true);assert.equal(exercise.kind,'cardio');assert.equal(exercise.duration,75);assert.equal(exercise.durationUnit,'seconds')
  assert.equal(exercise.plannedSets,0);assert.deepEqual(exercise.setLogs,[]);assert.equal(exercise.id,plan.id)
  assert.equal(exercise.signature,manualExerciseSignature(log));state.verify()
})

test('summary is bound to canonical owner, client, current local day/source/program and never adopts foreign or unrelated sessions',async()=>{
  const own=saved(),state=fixture([own,saved(undefined,{id:'foreign-owner',auth_user_id:other}),saved(undefined,{id:'foreign-client',client_id:'MANUAL-OTHER'}),saved(undefined,{id:'yesterday',workout_date:'2026-11-02',workout_started_at:'2026-11-02T13:00:00Z'}),saved(undefined,{id:'recommended',workout_source:'recommended'}),saved(undefined,{id:'other-day-name',day_name:'Unrelated manual workout'}),saved(undefined,{id:'other-program',program:'ember'})])
  const summary=await (await read()).json();assert.deepEqual(summary.sessions.map(row=>row.id),[own.id])
  assert.equal((await read({clientId:'MANUAL-OTHER'})).status,404)
  assert.equal((await read({date:'2026-11-02'})).status,409);assert.equal((await read({program:'ember'})).status,409)
  assert.equal((await read({date:'2026-02-30'})).status,400)
  state.verify()
  fixture([own],{actor:null});const anonymous=await read();assert.equal(anonymous.status,401);assert.equal(anonymous.headers.get('cache-control'),'private, no-store')
})

test('read/retry/re-entry is idempotent and exact local-day boundaries retain same-day timestamp and legacy DATE rows',async()=>{
  const state=fixture([saved(),saved([strength(1)],{id:'legacy-dated',workout_started_at:null}),saved([strength(1)],{id:'late-local',workout_started_at:'2026-11-04T02:00:00Z'}),saved([strength(2)],{id:'next-local-day',workout_date:'2026-11-04',workout_started_at:'2026-11-04T06:00:00Z'})])
  const first=await (await read()).json(),second=await (await read()).json()
  assert.deepEqual(second,first);assert.equal(first.sessions.length,3)
  assert.equal(new Set(first.sessions.map(row=>row.id)).size,3)
  assert.ok(first.sessions.some(row=>row.id==='late-local'));assert.ok(first.sessions.some(row=>row.id==='legacy-dated'))
  assert.ok(!first.sessions.some(row=>row.id==='next-local-day'));state.verify()
})

test('unknown/malformed/oversized saved evidence and read failures remain unconfirmed with safe errors and no writes',async()=>{
  for(const row of [saved(undefined,{program:null}),saved(undefined,{updated_at:'invalid'}),saved([{...strength(),set_logs:[{reps:0,weight:10,completed_at:stamp}]}])]){
    const state=fixture([row]),response=await read();assert.equal(response.status,503);assert.doesNotMatch(JSON.stringify(await response.json()),/private-health-answer/);state.verify()
  }
  let state=fixture([saved()],{fail:'workout_logs'}),response=await read()
  assert.equal(response.status,503);assert.doesNotMatch(JSON.stringify(await response.json()),/private-health-answer|database detail/);state.verify()
  state=fixture(Array.from({length:101},(_,index)=>saved(undefined,{id:'session-'+index})))
  response=await read();assert.equal(response.status,503);state.verify()
})

test('empty saved history stays neutral and legacy recorded completion never fabricates individual sets or a denominator',async()=>{
  let state=fixture(),summary=await (await read()).json()
  assert.deepEqual(summary.sessions,[]);assert.equal(summary.completed,false);state.verify()
  const legacy={id:'legacy-occurrence',exercise:'Historical squat',exercise_category:'strength',completed:true,actual_reps:8,actual_weight:20}
  state=fixture([saved([legacy],{id:'legacy-record',workout_started_at:null,completed:true})]);summary=await (await read()).json()
  assert.equal(summary.completed,true,'Existing recorded legacy classification is retained')
  assert.deepEqual(summary.sessions[0].progress,{completedSets:0,totalSets:0,requiredSets:0})
  assert.equal(summary.sessions[0].exercises[0].plannedSets,0);assert.deepEqual(summary.sessions[0].exercises[0].setLogs,[])
  assert.equal(summary.sessions[0].exercises[0].name,'Historical squat');state.verify()
})
