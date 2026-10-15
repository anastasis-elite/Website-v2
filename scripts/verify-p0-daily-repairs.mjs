// Exact reviewed migrations in an isolated schema-only PGlite reconstruction.
// This script has no network code, production keys, customer rows, or remote connection.
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { createProductionFixture, setFixtureIdentity } from './lib/p0-production-fixture.mjs'
process.on('uncaughtException', error => {
  console.error('P0 REHEARSAL FAIL:', error.message, error.code || '', error.where || '')
  process.exit(1)
})

const root = new URL('../', import.meta.url)
const migrationDir = new URL('supabase/migrations/', root)
const migrationFiles = process.argv.slice(2).length ? process.argv.slice(2) :
  readdirSync(migrationDir).filter(name => /_p0_.*\.sql$/.test(name)).sort().map(name => new URL(name, migrationDir))
assert.ok(migrationFiles.length, 'Provide the exact new P0 migration files as command arguments.')
const { db, metadata, adaptations } = await createProductionFixture()
const owner = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'
const ember = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
const log = '33333333-3333-4333-8333-333333333333'
const emberLog = 'eeeeeeee-1111-4111-8111-eeeeeeeeeeee'
const drink = '55555555-5555-4555-8555-555555555555'
const workoutId = '44444444-4444-4444-8444-444444444444'
const legacyToday = '44444444-1111-4111-8111-444444444444'
const foodId = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
const mealId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const date = '2026-10-13'
await db.exec(`insert into auth.users(id,email,email_confirmed_at) values
  ('${owner}','owner@local-qa.invalid',now()),('${other}','other@local-qa.invalid',now()),('${ember}','ember@local-qa.invalid',now());
  insert into public.clients(client_id,auth_user_id,email,program,timezone,onboarding_completed,access,active) values
  ('LOCAL-QA-ONLY','${owner}','owner@local-qa.invalid','ignite','America/Chicago',true,true,true),
  ('LOCAL-QA-OTHER','${other}','other@local-qa.invalid','phoenix','America/Chicago',true,true,true),
  ('LOCAL-QA-EMBER','${ember}','ember@local-qa.invalid','ember','America/Chicago',true,true,true);
  insert into nutrition_logs(id,client_id,auth_user_id,log_date,water_consumed_oz,water_oz,calories,protein,carbs,fats) values
  ('${log}','LOCAL-QA-ONLY','${owner}','${date}',36,111,2000,100,250,60),
  ('${emberLog}','LOCAL-QA-EMBER','${ember}','${date}',0,100,2000,100,250,60);
  insert into workout_logs(id,client_id,auth_user_id,program,workout_date,day_name,exercise_logs,completed) values
  ('${workoutId}','LOCAL-QA-ONLY','${owner}','ignite','2026-10-12','Legacy','[{"exercise":"Walk","completed":true}]',true),
  ('${legacyToday}','LOCAL-QA-ONLY','${owner}','ignite','${date}','Legacy today','[{"id":"walk","session_key":"walk:0","completed":false}]',false);
  insert into foods(id,name,source) values('${foodId}','Synthetic fixture food','catalog');
  insert into food_nutrients(food_id,calories,protein_g,carbs_g,fat_g) values('${foodId}',100,5,10,2);`)
const before = (await db.query('select client_id,auth_user_id,program,access,active from clients order by client_id')).rows
const seedTables = ['nutrient_reference_sources','nutrients','nutrient_function_map','nutrient_interactions','supplements','supplement_ingredients','ingredient_nutrients','supplement_supported_functions','supplement_recommendation_engine_config']
let firstSeedCounts
for (let replay = 0; replay < 2; replay++) {
  for (const file of migrationFiles) await db.exec(readFileSync(file, 'utf8'))
  const seedCounts = {}
  for (const table of seedTables) seedCounts[table] = (await db.query(`select count(*)::int n from public."${table}"`)).rows[0].n
  if (replay === 0) firstSeedCounts = seedCounts
  else assert.deepEqual(seedCounts,firstSeedCounts,'Reference seeds must not duplicate when exact migrations replay')
}
assert.deepEqual((await db.query('select client_id,auth_user_id,program,access,active from clients order by client_id')).rows, before)
assert.equal((await db.query(`select workout_date::text date,completed from workout_logs where id='${workoutId}'`)).rows[0].date,'2026-10-12')
assert.equal((await db.query(`select workout_started_at from workout_logs where id='${workoutId}'`)).rows[0].workout_started_at,null)
console.log(`PASS exact P0 migration files applied twice to ${metadata.tables.length} captured public base tables; synthetic member/date history preserved`)

await setFixtureIdentity(db, 'authenticated', owner)
await db.query('select add_daily_water($1,$2,$3)', [log, 8, drink])
// A new request/session after a simulated lost response reuses the same identifier.
await setFixtureIdentity(db, 'authenticated', owner)
await db.query('select add_daily_water($1,$2,$3)', [log, 8, drink])
assert.equal(Number((await db.query('select water_consumed_oz from nutrition_logs where id=$1', [log])).rows[0].water_consumed_oz),44)
await assert.rejects(db.query('select add_daily_water($1,$2,$3)', [log, -8, drink]), /valid water/)
await assert.rejects(db.query("insert into nutrition_logs(client_id,auth_user_id,log_date) values('LOCAL-QA-OTHER',$1,'2026-10-20')", [owner]), /row-level security/)
await assert.rejects(db.query("update clients set program='phoenix' where client_id='LOCAL-QA-ONLY'"), /entitlement/i)
await assert.rejects(db.query("update clients set access=false where client_id='LOCAL-QA-ONLY'"), /entitlement/i)

await db.query(`insert into recovery_logs(client_id,auth_user_id,log_date,energy_level,sleep_hours,check_in_completed_at)
  values('LOCAL-QA-ONLY',$1,$2,7,8,now()) on conflict(client_id,log_date) do update set energy_level=excluded.energy_level`, [owner,date])
await db.query(`insert into sleep_logs(user_id,client_id,log_date,duration_hours,quality) values($1,'LOCAL-QA-ONLY',$2,8,7)
  on conflict(user_id,client_id,log_date) do update set duration_hours=excluded.duration_hours`,[owner,date])
await db.query(`insert into recovery_activity_logs(user_id,client_id,log_date,activity_type,duration_minutes) values($1,'LOCAL-QA-ONLY',$2,'Gentle walk',20)`,[owner,date])
await db.query(`insert into cycle_logs(client_id,auth_user_id,log_date,cycle_phase,answered_fields) values('LOCAL-QA-ONLY',$1,$2,'follicular',array['cycle_phase'])
  on conflict(client_id,log_date) do update set answered_fields=excluded.answered_fields`,[owner,date])
await db.query(`insert into measurement_logs(client_id,auth_user_id,log_date,measurements) values('LOCAL-QA-ONLY',$1,$2,'{"waist":30}')`,[owner,date])
await db.query(`insert into meal_entries(id,nutrition_log_id,food_id,serving_amount,grams,entry_source,entry_state) values($1,$2,$3,1,100,'manual','confirmed')`,[mealId,log,foodId])
assert.equal(Number((await db.query('select calories_eaten from nutrition_log_totals where nutrition_log_id=$1',[log])).rows[0].calories_eaten),100)
await db.query(`insert into client_current_profiles(user_id,client_id,current_weight) values($1,'LOCAL-QA-ONLY',180)
  on conflict(client_id) do update set current_weight=excluded.current_weight`,[owner])
await db.query(`insert into client_profile_change_history(user_id,client_id,field_name,new_value) values($1,'LOCAL-QA-ONLY','current_weight','180')`,[owner])
await assert.rejects(db.query(`insert into client_current_profiles(user_id,client_id,current_weight) values($1,'LOCAL-QA-OTHER',180)`,[owner]),/row-level security/)
await assert.rejects(db.query("update client_current_profiles set client_id='LOCAL-QA-OTHER' where client_id='LOCAL-QA-ONLY'"),/row-level security/)
await assert.rejects(db.query(`insert into client_profile_change_history(user_id,client_id,field_name) values($1,'LOCAL-QA-OTHER','weight')`,[owner]),/row-level security/)
await db.query('select replace_daily_commitments($1,$2)',['LOCAL-QA-ONLY',JSON.stringify([{block_type:'work',days_of_week:[1,2],start_time:'09:00',end_time:'17:00'}])])
await assert.rejects(db.query('select replace_daily_commitments($1,$2)',['LOCAL-QA-ONLY',null]),/Invalid commitments/)
await assert.rejects(db.query('select replace_daily_commitments($1,$2)',['LOCAL-QA-ONLY',JSON.stringify([{block_type:'invalid',days_of_week:[1],start_time:'09:00',end_time:'17:00'}])]),/check constraint/)
assert.equal((await db.query('select count(*)::int n from client_schedule_blocks')).rows[0].n,1)
await db.query(`insert into anastasis_schedule_events(user_id,client_id,title,event_type,start_at,end_at,status)
  values($1,'LOCAL-QA-ONLY','Synthetic fixture appointment','appointment','2026-10-13T18:00Z','2026-10-13T19:00Z','scheduled')`,[owner])
await db.query(`insert into workout_plan_feedback(user_id,client_id,feedback_date,assigned_workout_id,program,response)
  values($1,'LOCAL-QA-ONLY',$2,'fixture-plan','ignite','looks_good')`,[owner,date])
const payload = {program:'ignite',day_name:'Fixture strength',workout_source:'manual',workout_date:'2026-10-13T18:00:00Z',workout_local_date:date,
  planned_exercises:[{id:'squat'}],exercise_logs:[{id:'squat',session_key:'squat:0',completed:false}],completed:false}
const legacyResume = (await db.query('select save_daily_workout($1,$2,$3,$4) saved',['LOCAL-QA-ONLY','2026-10-13T05:00Z','2026-10-14T05:00Z',JSON.stringify({...payload,day_name:'Legacy today',workout_source:'recommended',exercise_logs:[{id:'walk',session_key:'walk:0',completed:true}]})])).rows[0].saved
assert.equal(legacyResume.id,legacyToday)
assert.equal(legacyResume.workout_started_at,null)
const saved = (await db.query('select save_daily_workout($1,$2,$3,$4) saved',['LOCAL-QA-ONLY','2026-10-13T05:00Z','2026-10-14T05:00Z',JSON.stringify(payload)])).rows[0].saved
const resumed = (await db.query('select save_daily_workout($1,$2,$3,$4) saved',['LOCAL-QA-ONLY','2026-10-13T05:00Z','2026-10-14T05:00Z',JSON.stringify({...payload,completed:true})])).rows[0].saved
assert.equal(saved.id,resumed.id)
assert.equal(saved.workout_date,date)
assert.ok(saved.workout_started_at)
const changedPlan = (await db.query('select save_daily_workout($1,$2,$3,$4) saved',['LOCAL-QA-ONLY','2026-10-13T05:00Z','2026-10-14T05:00Z',JSON.stringify({...payload,exercise_logs:[{id:'walk',session_key:'walk:0'}]})])).rows[0].saved
assert.notEqual(changedPlan.id,saved.id)
await assert.rejects(db.query('select save_daily_workout($1,$2,$3,$4)',['LOCAL-QA-ONLY','2026-10-13T05:00Z','2026-10-14T05:00Z',JSON.stringify({...payload,workout_local_date:'2026-10-12'})]),/outside local day/)
await assert.rejects(db.query('select save_daily_workout($1,$2,$3,$4)',['LOCAL-QA-ONLY','2026-10-13T05:00Z','2026-10-14T05:00Z',JSON.stringify({...payload,program:'phoenix'})]),/match your program/)
await assert.rejects(db.query('select save_daily_workout($1,$2,$3,$4)',['LOCAL-QA-ONLY','2026-10-13T05:00Z','2026-10-14T05:00Z',null]),/match your program/)
await db.query("update clients set timezone='America/Los_Angeles' where client_id='LOCAL-QA-ONLY'")
const midnight = (await db.query('select save_daily_workout($1,$2,$3,$4) saved',['LOCAL-QA-ONLY','2026-10-13T07:00Z','2026-10-14T07:00Z',JSON.stringify({...payload,day_name:'Late local fixture',workout_date:'2026-10-14T06:30:00Z'})])).rows[0].saved
assert.equal(midnight.workout_date,'2026-10-13')
await db.query("update clients set timezone='America/Chicago' where client_id='LOCAL-QA-ONLY'")
const dst = (await db.query('select save_daily_workout($1,$2,$3,$4) saved',['LOCAL-QA-ONLY','2026-11-01T05:00Z','2026-11-02T06:00Z',JSON.stringify({...payload,day_name:'DST fixture',workout_local_date:'2026-11-01',workout_date:'2026-11-02T05:30:00Z'})])).rows[0].saved
assert.equal(dst.workout_date,'2026-11-01')
const session = (await db.query(`insert into workout_exercise_sessions(workout_log_id,client_id,auth_user_id,exercise_id,exercise_name)
  values($1,'LOCAL-QA-ONLY',$2,'squat','Squat') returning id`,[saved.id,owner])).rows[0].id
await db.query('select replace_workout_sets($1,$2)',[session,JSON.stringify([{set_number:1,weight:15,weight_unit:'lb',reps:8,completed_at:'2026-10-13T18:10Z'}])])
await assert.rejects(db.query('select replace_workout_sets($1,$2)',[session,null]),/Invalid sets/)
await assert.rejects(db.query('select replace_workout_sets($1,$2)',[session,JSON.stringify([{set_number:-1,weight:15,weight_unit:'lb',reps:8,completed_at:'2026-10-13T18:10Z'}])]),/check constraint/)
await assert.rejects(db.query(`insert into workout_exercise_sessions(workout_log_id,client_id,auth_user_id,exercise_id,exercise_name)
  values($1,'LOCAL-QA-OTHER',$2,'foreign','Foreign')`,[saved.id,owner]),/row-level security/)
await assert.rejects(db.query("update workout_exercise_sets set exercise_id='wrong-parent' where exercise_session_id=$1",[session]),/row-level security/)
assert.equal((await db.query('select count(*)::int n from workout_exercise_sets')).rows[0].n,1)
await db.query(`insert into daily_execution_status(user_id,client_id,log_date,program,capacity_status,completion_score,streak_eligible)
  values($1,'LOCAL-QA-ONLY',$2,'ignite','ready',100,true)`,[owner,date])
await db.query(`insert into dashboard_daily_recommendations(user_id,client_id,log_date,program,engine_version,input_snapshot,recommendation_output)
  values($1,'LOCAL-QA-ONLY',$2,'ignite','fixture','{}','{"next":"recovery"}')`,[owner,date])
await setFixtureIdentity(db,'authenticated',owner)
for (const table of ['recovery_logs','sleep_logs','recovery_activity_logs','cycle_logs','measurement_logs','client_current_profiles','client_profile_change_history','client_schedule_blocks','anastasis_schedule_events','workout_plan_feedback','workout_logs','workout_exercise_sessions','workout_exercise_sets','daily_execution_status','dashboard_daily_recommendations']) {
  assert.ok((await db.query(`select count(*)::int n from public."${table}"`)).rows[0].n > 0, table+' did not survive session reload')
}
console.log('PASS owner daily save/session-reload, real nutrition views, history-preserving workout resume, and NULL replacement rollback')

await setFixtureIdentity(db,'authenticated',other)
assert.equal((await db.query('select count(*)::int n from nutrition_logs where id=$1',[log])).rows[0].n,0)
await assert.rejects(db.query('select add_daily_water($1,$2,$3)',[log,8,drink]),/not found/i)
await assert.rejects(db.query('select replace_workout_sets($1,$2)',[session,'[]']),/not found/i)
await setFixtureIdentity(db,'authenticated',ember)
await db.query(`insert into macro_entries(nutrition_log_id,client_id,auth_user_id,calories,protein_g,carbs_g,fat_g)
  values($1,'LOCAL-QA-EMBER',$2,200,10,20,5)`,[emberLog,ember])
await assert.rejects(db.query(`insert into meal_entries(nutrition_log_id,food_id,serving_amount,grams,entry_source,entry_state)
  values($1,$2,1,100,'manual','confirmed')`,[emberLog,foodId]),/row-level security/)
await assert.rejects(db.query("update clients set program='phoenix' where client_id='LOCAL-QA-EMBER'"),/entitlement/i)
await assert.rejects(db.query(`insert into recommendation_audit_logs(user_id,recommendation_type,engine_version,recommendation_output)
  values($1,'fixture','fixture','{}')`,[ember]),/permission denied/)
await setFixtureIdentity(db,'anon')
await assert.rejects(db.query('select add_daily_water($1,$2,$3)',[log,8,drink]),/permission denied/)
await setFixtureIdentity(db,'service_role')
await db.query(`insert into recommendation_audit_logs(user_id,recommendation_type,engine_version,recommendation_output)
  values($1,'fixture','fixture','{}')`,[owner])
await assert.rejects(db.query('select * from recommendation_audit_logs'),/permission denied/)
await assert.rejects(db.query("update recommendation_audit_logs set engine_version='changed'"),/permission denied/)
await assert.rejects(db.query('delete from recommendation_audit_logs'),/permission denied/)
console.log('PASS direct ownership, anonymous denials, EMBER allowed macros/denied meals, protected tier fields, and service-only audit append')

const connection = (await db.query(`insert into calendar_connections(user_id,provider,provider_account_id,account_label)
  values($1,'google','synthetic-owner','Synthetic fixture') returning id`,[owner])).rows[0].id
await db.query(`insert into calendar_credentials(connection_id,user_id,encrypted_value) values($1,$2,'synthetic-no-provider-secret')`,[connection,owner])
const calendar = (await db.query(`insert into connected_calendars(connection_id,user_id,provider_calendar_id,name,selected)
  values($1,$2,'synthetic-calendar','Synthetic calendar',true) returning id`,[connection,owner])).rows[0].id
await db.query(`insert into calendar_preferences(user_id,default_calendar_id) values($1,$2)`,[owner,calendar])
await db.query(`insert into calendar_events(user_id,calendar_id,provider_event_id,provider_payload,etag)
  values($1,$2,'synthetic-event','{"summary":"Synthetic appointment"}','synthetic-etag')`,[owner,calendar])
assert.equal((await db.query('select claim_calendar_sync($1,$2,$3) claimed',[connection,owner,'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'])).rows[0].claimed,true)
assert.equal((await db.query('select claim_calendar_sync($1,$2,$3) claimed',[connection,owner,'aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa'])).rows[0].claimed,false)
assert.equal((await db.query('select claim_calendar_sync($1,$2,$3) claimed',[connection,other,'aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa'])).rows[0].claimed,false)
await setFixtureIdentity(db,'authenticated',owner)
for (const table of ['calendar_connections','connected_calendars','calendar_preferences','calendar_events']) {
  assert.equal((await db.query(`select count(*)::int n from public."${table}"`)).rows[0].n,1)
}
for (const table of ['calendar_credentials','calendar_oauth_states','calendar_write_operations']) {
  await assert.rejects(db.query(`select * from public."${table}"`),/permission denied/)
}
await assert.rejects(db.query(`insert into calendar_events(user_id,calendar_id,provider_event_id,provider_payload,etag)
  values($1,$2,'synthetic-forbidden','{}','synthetic-etag')`,[owner,calendar]),/permission denied/)
await assert.rejects(db.query('select claim_calendar_sync($1,$2,$3)',[connection,owner,drink]),/permission denied/)

const bodySession = (await db.query(`insert into body_assessment_sessions(user_id,client_id,assessment_type,measurement_date)
  values($1,'LOCAL-QA-ONLY','monthly',$2) returning id`,[owner,date])).rows[0].id
await db.query(`insert into body_assessment_measurements(session_id,user_id,client_id,measurement_group,region,value,unit)
  values($1,$2,'LOCAL-QA-ONLY','regional_circumference','waist',30,'in')`,[bodySession,owner])
await assert.rejects(db.query(`insert into body_assessment_sessions(user_id,client_id,assessment_type)
  values($1,'LOCAL-QA-OTHER','monthly')`,[owner]),/row-level security/)
const cycle = (await db.query('select id from cycle_logs where client_id=$1 and log_date=$2',['LOCAL-QA-ONLY',date])).rows[0].id
const flow = (await db.query(`insert into menstrual_flow_logs(user_id,client_id,log_date,cycle_log_id,raw_entry)
  values($1,'LOCAL-QA-ONLY',$2,$3,'{"bleeding":true}') returning id`,[owner,date,cycle])).rows[0].id
await db.query(`insert into menstrual_product_logs(flow_log_id,user_id,client_id,log_date,product_type)
  values($1,$2,'LOCAL-QA-ONLY',$3,'pad')`,[flow,owner,date])
await setFixtureIdentity(db,'authenticated',other)
for (const table of ['calendar_connections','connected_calendars','calendar_preferences','calendar_events','body_assessment_measurements','menstrual_flow_logs','menstrual_product_logs']) {
  assert.equal((await db.query(`select count(*)::int n from public."${table}"`)).rows[0].n,0,table+' leaked another user’s records')
}
const foreignSession = (await db.query(`insert into body_assessment_sessions(user_id,client_id,assessment_type)
  values($1,'LOCAL-QA-OTHER','monthly') returning id`,[other])).rows[0].id
const foreignCycle = (await db.query(`insert into cycle_logs(client_id,auth_user_id,log_date) values('LOCAL-QA-OTHER',$1,$2) returning id`,[other,date])).rows[0].id
const foreignFlow = (await db.query(`insert into menstrual_flow_logs(user_id,client_id,log_date,cycle_log_id)
  values($1,'LOCAL-QA-OTHER',$2,$3) returning id`,[other,date,foreignCycle])).rows[0].id
await setFixtureIdentity(db,'authenticated',owner)
await assert.rejects(db.query(`insert into body_assessment_measurements(session_id,user_id,client_id,measurement_group,region,value,unit)
  values($1,$2,'LOCAL-QA-ONLY','regional_circumference','waist',30,'in')`,[foreignSession,owner]),/row-level security/)
await assert.rejects(db.query(`insert into menstrual_flow_logs(user_id,client_id,log_date,cycle_log_id)
  values($1,'LOCAL-QA-ONLY',$2,$3)`,[owner,date,foreignCycle]),/row-level security/)
await assert.rejects(db.query(`insert into menstrual_product_logs(flow_log_id,user_id,client_id,log_date,product_type)
  values($1,$2,'LOCAL-QA-ONLY',$3,'pad')`,[foreignFlow,owner,date]),/row-level security/)
await setFixtureIdentity(db,'authenticated',owner)
assert.equal((await db.query('select count(*)::int n from body_assessment_measurements')).rows[0].n,1)
assert.equal((await db.query('select count(*)::int n from menstrual_product_logs')).rows[0].n,1)
for (const table of seedTables.filter(table => firstSeedCounts[table]>0)) {
  assert.equal((await db.query(`select count(*)::int n from public."${table}"`)).rows[0].n,firstSeedCounts[table],table+' catalog readback failed')
}
await assert.rejects(db.query(`insert into nutrients(nutrient_key,canonical_name,category,default_unit) values('synthetic-forbidden','Synthetic','mineral','mg')`),/permission denied/)
assert.equal((await db.query("select has_table_privilege('authenticated','public.clients','TRUNCATE') allowed")).rows[0].allowed,false)
// Malformed legacy/privileged parent records remain readable but cannot be mutated.
await db.exec('reset role')
const malformedWorkout='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const malformedSession='bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb'
await db.query(`insert into workout_logs(id,client_id,auth_user_id,program,workout_date,day_name,exercise_logs)
  values($1,'LOCAL-QA-OTHER',$2,'phoenix',$3,'Malformed synthetic parent','[]')`,[malformedWorkout,owner,date])
await db.query(`insert into workout_exercise_sessions(id,workout_log_id,client_id,auth_user_id,exercise_id,exercise_name)
  values($1,$2,'LOCAL-QA-OTHER',$3,'malformed','Malformed synthetic exercise')`,[malformedSession,malformedWorkout,owner])
await db.query(`insert into workout_exercise_sets(workout_log_id,exercise_session_id,exercise_id,set_number,reps)
  values($1,$2,'malformed',1,8)`,[malformedWorkout,malformedSession])
await setFixtureIdentity(db,'authenticated',owner)
assert.equal((await db.query('select count(*)::int n from workout_exercise_sets where exercise_session_id=$1',[malformedSession])).rows[0].n,1)
await assert.rejects(db.query(`insert into workout_exercise_sets(workout_log_id,exercise_session_id,exercise_id,set_number,reps)
  values($1,$2,'malformed',2,8)`,[malformedWorkout,malformedSession]),/row-level security/)
await assert.rejects(db.query('select replace_workout_sets($1,$2)',[malformedSession,'[]']),/Session not found/)
assert.equal((await db.query('delete from workout_exercise_sets where exercise_session_id=$1',[malformedSession])).affectedRows,0)
assert.equal((await db.query('select count(*)::int n from workout_exercise_sets where exercise_session_id=$1',[malformedSession])).rows[0].n,1)
console.log('PASS calendar service save/member readback/private isolation/lease ownership; body and cycle parent ownership; reference catalog reload and seed replay counts')
console.log('Local adaptations:', adaptations.join('; '))
console.log('No production write, connected HTTP account test, browser reload, installed PWA, or provider integration is claimed.')
await db.close()
