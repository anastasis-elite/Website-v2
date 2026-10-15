// Isolated fixture database only. Run with PGLITE_MODULE pointing to an installed PGlite ESM entry.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite')
const db = new PGlite()
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',logId='33333333-3333-4333-8333-333333333333',drink='44444444-4444-4444-8444-444444444444'
await db.exec(`
create role anon; create role authenticated; create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid$$;
grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
create table clients(client_id text primary key, auth_user_id uuid, program text);
create table cycle_logs(id uuid primary key default gen_random_uuid());
create table nutrition_logs(id uuid primary key,client_id text,auth_user_id uuid,water_consumed_oz numeric,updated_at timestamptz);
create table client_schedule_blocks(id uuid primary key default gen_random_uuid(),client_id text,user_id uuid,block_type text check(block_type in ('sleep','work','school_dropoff','school_pickup','commute','appointment','other')),label text,days_of_week smallint[],start_time time,end_time time,active boolean);
create table workout_logs(id uuid primary key default gen_random_uuid(),client_id text,auth_user_id uuid,program text,day_name text,workout_source text,workout_date timestamptz,planned_exercises jsonb,exercise_logs jsonb,completed boolean,updated_at timestamptz);
create table workout_exercise_sessions(id uuid primary key default gen_random_uuid(),auth_user_id uuid,workout_log_id uuid,exercise_id text);
create table workout_exercise_sets(id uuid primary key default gen_random_uuid(),workout_log_id uuid,exercise_session_id uuid,exercise_id text,set_number integer check(set_number>=1),weight numeric,weight_unit text,reps integer check(reps>=0),set_started_at timestamptz,completed_at timestamptz not null);
alter table workout_exercise_sessions enable row level security;alter table workout_exercise_sets enable row level security;
create policy owned_sessions on workout_exercise_sessions for all to authenticated using(auth_user_id=auth.uid()) with check(auth_user_id=auth.uid());
create policy owned_sets on workout_exercise_sets for all to authenticated using(exists(select 1 from workout_exercise_sessions s where s.id=exercise_session_id and s.auth_user_id=auth.uid())) with check(exists(select 1 from workout_exercise_sessions s where s.id=exercise_session_id and s.auth_user_id=auth.uid()));
grant select,insert,update on workout_exercise_sessions to authenticated;grant select,insert,update,delete on workout_exercise_sets to authenticated;
insert into clients values('qa-dashboard','${owner}','ignite'),('qa-other','${other}','phoenix');
insert into nutrition_logs values('${logId}','qa-dashboard','${owner}',0,now());
insert into client_schedule_blocks(client_id,user_id,block_type,days_of_week,start_time,end_time,active) values('qa-dashboard','${owner}','work','{1,2,3,4,5}','09:00','17:00',true);
insert into workout_logs(client_id,auth_user_id,program,day_name,workout_source,workout_date,planned_exercises,exercise_logs,completed) values('qa-dashboard','${owner}','ignite','Strength','recommended','2026-10-07T14:00Z','[]','[]',true);
alter table clients enable row level security; alter table nutrition_logs enable row level security; alter table client_schedule_blocks enable row level security; alter table workout_logs enable row level security;
create policy owned_clients on clients for all to authenticated using(auth_user_id=auth.uid()) with check(auth_user_id=auth.uid());
create policy owned_water on nutrition_logs for all to authenticated using(auth_user_id=auth.uid()) with check(auth_user_id=auth.uid());
create policy owned_blocks on client_schedule_blocks for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy owned_workout on workout_logs for all to authenticated using(auth_user_id=auth.uid()) with check(auth_user_id=auth.uid());
grant select,insert,update,delete on clients,nutrition_logs,client_schedule_blocks,workout_logs to authenticated;
`)
await db.exec(readFileSync('supabase/migrations/20261009004035_coordinated_daily_dashboard.sql','utf8'))
await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${owner}',false)`)
await db.query('select add_daily_water($1,$2,$3)',[logId,8,drink])
await db.query('select add_daily_water($1,$2,$3)',[logId,8,drink])
assert.equal(Number((await db.query('select water_consumed_oz from nutrition_logs')).rows[0].water_consumed_oz),8)
await db.query('select add_daily_water($1,$2,$3)',[logId,4,'55555555-5555-4555-8555-555555555555'])
assert.equal(Number((await db.query('select water_consumed_oz from nutrition_logs')).rows[0].water_consumed_oz),12)
await assert.rejects(db.query('select add_daily_water($1,$2,$3)',[logId,-8,drink]),/valid water/)
await assert.rejects(db.query('select replace_daily_commitments($1,$2)', ['qa-dashboard',JSON.stringify([{block_type:'invalid',days_of_week:[4],start_time:'09:00',end_time:'17:00'}])]),/check constraint/)
assert.equal((await db.query('select count(*)::int n from client_schedule_blocks')).rows[0].n,1)
await db.query('select replace_daily_commitments($1,$2)', ['qa-dashboard',JSON.stringify([{block_type:'work',label:'Work',days_of_week:[4],start_time:'10:00',end_time:'16:00'}])])
assert.equal((await db.query('select start_time::text t from client_schedule_blocks')).rows[0].t,'10:00:00')
const session={day_name:'Strength',workout_source:'recommended',program:'ignite',workout_date:'2026-10-08T20:40:00Z',planned_exercises:[{exercise:'Walk'}],exercise_logs:[{exercise:'Walk',completed:false,actual_duration:5}],completed:false}
await db.query('select save_daily_workout($1,$2,$3,$4)',['qa-dashboard','2026-10-08T05:00Z','2026-10-09T05:00Z',JSON.stringify(session)])
session.exercise_logs[0].completed=true;session.completed=true
await db.query('select save_daily_workout($1,$2,$3,$4)',['qa-dashboard','2026-10-08T05:00Z','2026-10-09T05:00Z',JSON.stringify(session)])
assert.equal((await db.query('select count(*)::int n from workout_logs')).rows[0].n,2)
assert.equal((await db.query("select completed from workout_logs where workout_date < '2026-10-08T05:00Z'")).rows[0].completed,true)
const sessionId='66666666-6666-4666-8666-666666666666'
await db.query('insert into workout_exercise_sessions(id,auth_user_id,workout_log_id,exercise_id) values($1,$2,$3,$4)',[sessionId,owner,'77777777-7777-4777-8777-777777777777','squat'])
const set={set_number:1,weight:15,weight_unit:'lb',reps:8,completed_at:'2026-10-08T20:40Z'}
await db.query('select replace_workout_sets($1,$2)',[sessionId,JSON.stringify([set])])
await assert.rejects(db.query('select replace_workout_sets($1,$2)',[sessionId,JSON.stringify([{...set,set_number:-1}])]),/check constraint/)
assert.equal((await db.query('select count(*)::int n from workout_exercise_sets')).rows[0].n,1)
await db.exec(`select set_config('request.jwt.claim.sub','${other}',false)`)
await assert.rejects(db.query('select replace_workout_sets($1,$2)',[sessionId,'[]']),/not found/)
await assert.rejects(db.query('select add_daily_water($1,$2,$3)',[logId,8,drink]),/not found/)
await assert.rejects(db.query('select replace_daily_commitments($1,$2)',['qa-dashboard','[]']),/not found/)
await assert.rejects(db.query('select save_daily_workout($1,$2,$3,$4)',['qa-dashboard','2026-10-08T05:00Z','2026-10-09T05:00Z',JSON.stringify(session)]),/not found/)
await db.exec('reset role; set role anon;')
await assert.rejects(db.query('select add_daily_water($1,$2,$3)',[logId,8,drink]),/permission denied/)
await db.close()
console.log('PASS: additive migration; water retries; invalid-input rejection; atomic commitments rollback; session resume without duplicate records; atomic recorded-set edits; preserved history; owner RLS; anonymous denial. All records were isolated QA fixtures.')
