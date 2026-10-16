import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, readdirSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
const filename = readdirSync('supabase/migrations').find(name => name.endsWith('_strength_assessment_drafts_atomic.sql'))
assert.ok(filename, 'strength assessment migration must be committed with the implementation')
const migration = readFileSync(`supabase/migrations/${filename}`, 'utf8')
const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const values = { weight: '160', height_in: '67', squat_weight: '95', squat_reps: '8', plank_time: '0' }

test('strength drafts and final submissions under disposable Postgres transactions and RLS', async t => {
  const db = new PGlite(); t.after(() => db.close())
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema public,auth to anon,authenticated,service_role;
    insert into auth.users values('${owner}'),('${other}');
    create table public.clients(client_id text primary key,auth_user_id uuid not null,program text default 'ember',timezone text,state text,onboarding_data jsonb default '{}');
    create table public.assessments(id uuid primary key default gen_random_uuid(),client_id text references public.clients(client_id),auth_user_id uuid,program text,assessment_type text,data jsonb,source text,submitted_at timestamptz default now());
    create table public.client_current_profiles(client_id text primary key references public.clients(client_id),user_id uuid,current_weight numeric,injuries text[] default '{}',updated_at timestamptz default now());
    create table public.program_outputs(id uuid primary key default gen_random_uuid(),client_id text references public.clients(client_id),auth_user_id uuid,program text,status text,program_json jsonb,generated_at timestamptz);
    alter table public.clients enable row level security; alter table public.assessments enable row level security;
    alter table public.client_current_profiles enable row level security; alter table public.program_outputs enable row level security;
    create policy own_clients on public.clients for all to authenticated using(auth_user_id=auth.uid()) with check(auth_user_id=auth.uid());
    create policy own_assessments on public.assessments for all to authenticated using(auth_user_id=auth.uid()) with check(auth_user_id=auth.uid() and exists(select 1 from public.clients c where c.client_id=assessments.client_id and c.auth_user_id=auth.uid()));
    create policy own_profiles on public.client_current_profiles for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid() and exists(select 1 from public.clients c where c.client_id=client_current_profiles.client_id and c.auth_user_id=auth.uid()));
    create policy own_programs on public.program_outputs for all to authenticated using(auth_user_id=auth.uid()) with check(auth_user_id=auth.uid() and exists(select 1 from public.clients c where c.client_id=program_outputs.client_id and c.auth_user_id=auth.uid()));
    grant select,insert,update on public.clients,public.assessments,public.client_current_profiles,public.program_outputs to authenticated;
    insert into public.clients(client_id,auth_user_id,timezone) values('QA-OWN','${owner}','America/Chicago'),('QA-OTHER','${other}','America/Chicago');
    insert into public.assessments(client_id,auth_user_id,assessment_type,data,submitted_at) values('QA-OWN','${owner}','initial','{}','2026-01-01T12:00Z'),('QA-OWN','${owner}','strength','{"weight":"150"}','2026-01-15T12:00Z'),('QA-OWN','${owner}','strength','{"weight":"151"}','2026-01-15T13:00Z');
    insert into public.client_current_profiles(client_id,user_id,current_weight,injuries) values('QA-OWN','${owner}',150,array['preserved']);
  `)
  await db.exec(migration); await db.exec(migration)
  const identity = async id => { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]); await db.exec('set role authenticated') }
  await identity(owner)
  const current = (await db.query("select date_trunc('month',clock_timestamp() at time zone 'America/Chicago')::date::text as p")).rows[0].p
  const call = async (period=current,revision=0,input=values,complete=false,program=null,client='QA-OWN') => (await db.query('select public.save_strength_assessment($1,$2::date,$3,$4::jsonb,$5,$6::jsonb) as result',[client,period,revision,JSON.stringify(input),complete,program===null?null:JSON.stringify(program)])).rows[0].result
  const count = async table => (await db.query(`select count(*)::integer as n from public.${table}`)).rows[0].n
  const session = async () => (await db.query('select * from public.strength_assessment_sessions where period=$1',[current])).rows[0]
  const originalHistory = (await db.query("select to_jsonb(a) as row from public.assessments a where assessment_type='strength' order by submitted_at")).rows

  await t.test('additive replay preserves historical evidence and limits execution privileges',async () => {
    assert.equal(await count('assessments'),3)
    const grants=(await db.query("select p.prosecdef,has_function_privilege('anon',p.oid,'execute') as anon,has_function_privilege('authenticated',p.oid,'execute') as member,has_function_privilege('service_role',p.oid,'execute') as service from pg_proc p where p.oid='public.save_strength_assessment(text,date,bigint,jsonb,boolean,jsonb)'::regprocedure")).rows[0]
    assert.deepEqual(grants,{prosecdef:false,anon:false,member:true,service:false})
  })
  await t.test('partial cloud draft preserves unfinished strings, blanks and zeros across sessions',async () => {
    const input={weight:'',squat_weight:'12.',squat_reps:'',plank_time:'0'}
    const saved=await call(current,0,input); assert.equal(saved.success,true); assert.equal(saved.assessment.status,'draft'); assert.equal(saved.assessment.revision,1)
    await identity(owner); assert.deepEqual((await session()).values,input); assert.ok((await session()).saved_at)
    assert.equal(await count('assessments'),3); assert.equal(await count('program_outputs'),0)
    assert.equal((await call(current,0,values)).code,'conflict'); assert.deepEqual((await session()).values,input)
  })
  await t.test('invalid final input cannot complete or modify a draft',async () => {
    for(const input of [{},{weight:'160',height_in:'67',squat_weight:'12.'},{...values,squat_reps:'1.5'},{...values,weight:'NaN'},{...values,height_in:'Infinity'},{...values,auth_user_id:other}]) assert.equal((await call(current,1,input,true)).code,'validation')
    assert.equal((await session()).status,'draft'); assert.equal(await count('assessments'),3)
  })
  await t.test('program write failure atomically rolls back assessment, profile, session and revision',async () => {
    await db.exec("reset role; create function public.qa_fail_program() returns trigger language plpgsql as $$ begin raise exception 'synthetic program failure'; end $$; create trigger qa_fail_program before insert on public.program_outputs for each row execute function public.qa_fail_program();")
    await identity(owner)
    const before=await session()
    await assert.rejects(call(current,1,values,true,{days:[]}),/synthetic program failure/)
    assert.deepEqual(await session(),before); assert.equal(await count('assessments'),3); assert.equal((await db.query("select current_weight from public.client_current_profiles where client_id='QA-OWN'")).rows[0].current_weight,'150')
    await db.exec('reset role; drop trigger qa_fail_program on public.program_outputs; drop function public.qa_fail_program();'); await identity(owner)
  })
  await t.test('validated final commits once with timestamp, period, profile and generated plan',async () => {
    const final=await call(current,1,values,true,{days:[]}); assert.equal(final.success,true); assert.equal(final.assessment.status,'completed'); assert.equal(final.assessment.revision,2); assert.ok(final.assessment.completed_at); assert.ok(final.assessment.assessment_id)
    assert.equal(await count('assessments'),4); assert.equal(await count('program_outputs'),1)
    assert.deepEqual((await db.query("select injuries from public.client_current_profiles where client_id='QA-OWN'")).rows[0].injuries,['preserved'])
    assert.equal((await call(current,1,values,true,{days:['duplicate']})).alreadyCompleted,true)
    assert.equal((await call(current,2,{...values,weight:'161'},true)).code,'conflict')
    assert.equal((await call(current,2,values,false)).code,'conflict')
    assert.equal(await count('assessments'),4); assert.equal(await count('program_outputs'),1)
    assert.equal((await db.query('select assessment_period::text as period from public.assessments where id=$1',[final.assessment.assessment_id])).rows[0].period,current)
  })
  await t.test('completed and historical records remain immutable and legacy duplicate evidence blocks new finals',async () => {
    await db.exec("update public.strength_assessment_sessions set values='{}'") // RLS completed update returns zero.
    assert.deepEqual((await session()).values,values)
    assert.equal((await call('2026-01-01',0,values,true)).code,'already_completed')
    assert.deepEqual((await db.query("select to_jsonb(a) as row from public.assessments a where assessment_type='strength' and assessment_period is null order by submitted_at")).rows,originalHistory)
  })
  await t.test('month rollover preserves old draft period without falsely completing current month',async () => {
    await db.exec('reset role')
    const past=(await db.query("select (date_trunc('month',clock_timestamp() at time zone 'America/Chicago')-interval '1 month')::date::text as p")).rows[0].p
    await db.query("insert into public.strength_assessment_sessions(client_id,auth_user_id,period,values) values('QA-OWN',$1,$2,$3::jsonb)",[owner,past,JSON.stringify(values)])
    await identity(owner)
    const currentProfile = (await db.query("select to_jsonb(p) as row from public.client_current_profiles p where client_id='QA-OWN'")).rows[0].row
    const programCount = await count('program_outputs')
    const oldCompletion = await call(past,1,{...values,weight:'140'},true,{days:['older period']})
    assert.equal(oldCompletion.success,true)
    assert.equal(oldCompletion.preservedNewerResults,true)
    assert.deepEqual((await db.query("select to_jsonb(p) as row from public.client_current_profiles p where client_id='QA-OWN'")).rows[0].row,currentProfile)
    assert.equal(await count('program_outputs'),programCount)
    assert.equal((await db.query('select assessment_period::text as period from public.assessments where id=(select assessment_id from public.strength_assessment_sessions where period=$1)',[past])).rows[0].period,past)
    assert.equal((await call('2099-01-01',0,values)).code,'period_changed')
  })
  await t.test('direct draft inserts cannot invent a new prior period and timezone matches account fallbacks',async () => {
    await identity(other)
    await assert.rejects(db.query("insert into public.strength_assessment_sessions(client_id,auth_user_id,period,values) values('QA-OTHER',$1,'2025-01-01','{}')",[other]),/month changed/)
    await db.exec("update public.clients set timezone=null,state='ID' where client_id='QA-OTHER'")
    assert.equal((await db.query("select public.strength_assessment_timezone('QA-OTHER') as zone")).rows[0].zone,'America/Boise')
    await db.exec("update public.clients set timezone='america/new_york' where client_id='QA-OTHER'")
    assert.equal((await db.query("select public.strength_assessment_timezone('QA-OTHER') as zone")).rows[0].zone,'America/New_York')
    await identity(owner)
  })
  await t.test('cross-user and anonymous access cannot read, modify, or complete another account',async () => {
    await identity(other); assert.equal(await count('strength_assessment_sessions'),0)
    assert.equal((await call(current,0,values,true,null,'QA-OWN')).status,404)
    await assert.rejects(db.query("insert into public.strength_assessment_sessions(client_id,auth_user_id,period,values) values('QA-OWN',$1,$2,'{}')",[other,current]),/row-level security/)
    await db.exec('reset role; set role anon'); await assert.rejects(call(),/permission denied/)
    await identity(owner); await db.query("select set_config('request.jwt.claim.sub','',false)"); assert.equal((await call()).status,401)
  })
})
