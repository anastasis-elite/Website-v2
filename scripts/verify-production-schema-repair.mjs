// Opt-in disposable database rehearsal: loads schema metadata and synthetic records only.
// No connection string, production keys, customer records, or remote access is used.
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
process.on('uncaughtException',error=>{console.error('REHEARSAL FAIL',error.message,error.where||'');process.exit(1)})
const {PGlite}=await import('@electric-sql/pglite')
const root=new URL('../',import.meta.url)
const metadata=JSON.parse(readFileSync(new URL('tests/fixtures/production-schema-metadata-2026-10-13.json',root),'utf8'))
const q=s=>'"'+s.replaceAll('"','""')+'"'
async function fixture(){
 const db=new PGlite()
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql stable as $$select '{}'::jsonb$$;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 grant usage on schema public,auth to anon,authenticated,service_role;
 grant execute on function auth.uid() to anon,authenticated,service_role;
 create schema storage;create table storage.buckets(id text primary key,name text,public boolean);
 insert into storage.buckets values ('assessment_photos','assessment_photos',false);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;
 create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;`)
 for(const t of metadata.tables){
  const cols=t.columns.map(c=>`${q(c.name)} ${c.type}${c.default?' default '+c.default:''}${c.notnull?' not null':''}`)
  const cs=(t.constraints||[]).filter(c=>!c.definition.startsWith('FOREIGN KEY')).map(c=>`constraint ${q(c.name)} ${c.definition}`)
  await db.exec(`create table public.${q(t.table_name)}(${[...cols,...cs].join(',')});${t.rls_enabled?'alter table public.'+q(t.table_name)+' enable row level security;':''}`)
 }
 for(const t of metadata.tables) for(const c of t.constraints||[]) {
  if(c.definition.startsWith('FOREIGN KEY')) await db.exec(`alter table public.${q(t.table_name)} add constraint ${q(c.name)} ${c.definition}`)
 }
 for(const p of metadata.policies){
  const roles=p.roles.slice(1,-1).split(',').join(',')
  await db.exec(`create policy ${q(p.policyname)} on public.${q(p.tablename)} as ${p.permissive} for ${p.cmd} to ${roles}${p.qual?' using ('+p.qual+')':''}${p.with_check?' with check ('+p.with_check+')':''};`)
 }
 await db.exec(`create view nutrition_log_totals as select 1 as fixture;create view nutrition_log_totals_by_block as select 1 as fixture;create view nutrition_log_remaining as select 1 as fixture;
 grant select,insert,update on clients,nutrition_logs,recovery_logs,workout_logs,assessments,program_outputs,measurement_logs to authenticated;
 grant select,insert,update,delete on all tables in schema public to service_role;
 insert into auth.users values('11111111-1111-4111-8111-111111111111','owner@local-qa.invalid',now()),('22222222-2222-4222-8222-222222222222','other@local-qa.invalid',now());
 insert into clients(client_id,auth_user_id,email,program,onboarding_completed,access,active) values('LOCAL-QA-ONLY','11111111-1111-4111-8111-111111111111','owner@local-qa.invalid','ignite',true,true,true),('LOCAL-QA-OTHER','22222222-2222-4222-8222-222222222222','other@local-qa.invalid','phoenix',false,true,true);
 insert into nutrition_logs(id,client_id,auth_user_id,log_date,water_consumed_oz) values('33333333-3333-4333-8333-333333333333','LOCAL-QA-ONLY','11111111-1111-4111-8111-111111111111','2026-10-13',8);
 insert into workout_logs(id,client_id,auth_user_id,program,workout_date,day_name,exercise_logs,completed) values('44444444-4444-4444-8444-444444444444','LOCAL-QA-ONLY','11111111-1111-4111-8111-111111111111','ignite','2026-10-12T18:00Z','Legacy','[{"exercise":"Walk","completed":true}]',true);`)
 return db
}
const db=await fixture()
const pre=(await db.query("select client_id,program,auth_user_id,access,active from clients order by client_id")).rows
const repair=readFileSync(new URL('docs/sql/production-schema-repair-2026-10-13.sql',root),'utf8')
await db.exec(repair)
console.log('PASS exact schema-only repair bundle executed against metadata-based synthetic fixture')
assert.deepEqual((await db.query("select client_id,program,auth_user_id,access,active from clients order by client_id")).rows,pre)
assert.equal((await db.query('select count(*)::int n from client_onboarding_snapshots')).rows[0].n,0)
assert.equal((await db.query('select count(*)::int n from client_current_profiles')).rows[0].n,0)
assert.equal((await db.query("select exercise_logs from workout_logs where day_name='Legacy'")).rows[0].exercise_logs[0].completed,true)
await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);`)
await assert.rejects(db.query("update clients set program='phoenix' where client_id='LOCAL-QA-ONLY'"),/Member entitlement fields cannot be changed/)
await db.query('select add_daily_water($1,$2,$3)',['33333333-3333-4333-8333-333333333333',8,'55555555-5555-4555-8555-555555555555'])
await db.query('select add_daily_water($1,$2,$3)',['33333333-3333-4333-8333-333333333333',8,'55555555-5555-4555-8555-555555555555'])
assert.equal(Number((await db.query('select water_consumed_oz from nutrition_logs')).rows[0].water_consumed_oz),16)
await db.query('select replace_daily_commitments($1,$2)',['LOCAL-QA-ONLY',JSON.stringify([{block_type:'work',days_of_week:[2],start_time:'09:00',end_time:'17:00'}])])
assert.equal((await db.query('select count(*)::int n from client_schedule_blocks')).rows[0].n,1)
await assert.rejects(db.query('select replace_daily_commitments($1,$2)',['LOCAL-QA-ONLY',JSON.stringify([{block_type:'invalid',days_of_week:[2],start_time:'09:00',end_time:'17:00'}])]),/check constraint/)
assert.equal((await db.query('select count(*)::int n from client_schedule_blocks')).rows[0].n,1)
await db.exec(`select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);`)
await assert.rejects(db.query('select add_daily_water($1,$2,$3)',['33333333-3333-4333-8333-333333333333',8,'66666666-6666-4666-8666-666666666666']),/Nutrition log not found/)
await db.exec('reset role; set role anon;')
await assert.rejects(db.query('select add_daily_water($1,$2,$3)',['33333333-3333-4333-8333-333333333333',8,'66666666-6666-4666-8666-666666666666']),/permission denied/)
await db.exec(`reset role;
 insert into workout_logs(id,client_id,auth_user_id,program,workout_date,day_name) values('77777777-7777-4777-8777-777777777777','LOCAL-QA-OTHER','22222222-2222-4222-8222-222222222222','phoenix','2026-10-13T18:00Z','Other user workout');
 set role authenticated;select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);`)
await db.query("insert into client_current_profiles(user_id,client_id) values('11111111-1111-4111-8111-111111111111','LOCAL-QA-ONLY')")
await assert.rejects(db.query("insert into client_current_profiles(user_id,client_id) values('11111111-1111-4111-8111-111111111111','LOCAL-QA-OTHER')"),/row-level security/)
await assert.rejects(db.query("insert into client_schedule_blocks(user_id,client_id,block_type,start_time,end_time) values('11111111-1111-4111-8111-111111111111','LOCAL-QA-OTHER','work','09:00','17:00')"),/row-level security/)
await assert.rejects(db.query("insert into workout_exercise_sessions(workout_log_id,client_id,auth_user_id,exercise_id,exercise_name) values('77777777-7777-4777-8777-777777777777','LOCAL-QA-OTHER','11111111-1111-4111-8111-111111111111','qa-foreign','Foreign fixture')"),/row-level security/)
await db.query("insert into client_profile_change_history(user_id,client_id,field_name) values('11111111-1111-4111-8111-111111111111','LOCAL-QA-ONLY','qa')")
await assert.rejects(db.query("insert into client_profile_change_history(user_id,client_id,field_name) values('11111111-1111-4111-8111-111111111111','LOCAL-QA-OTHER','qa')"),/row-level security/)
console.log('PASS repaired direct profile, schedule, exercise-parent and profile-history ownership boundaries')
await db.exec('reset role; set role service_role;')
assert.equal((await db.query('select commerce_configuration_ready() as ready')).rows[0].ready,true)
await db.close()
console.log('PASS synthetic history and member fields preserved; no customer backfill; entitlement denial; water retry deduplication; commitments atomic rollback; cross-owner and anonymous denial; commerce readiness. No real customer data or credentials loaded. This is a metadata-based synthetic rehearsal; live cardinality, storage, and provider behavior remain unverified.')
