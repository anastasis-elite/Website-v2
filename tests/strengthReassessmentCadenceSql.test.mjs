import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { importTs } from './typescriptModule.mjs'

const existing = readFileSync('supabase/migrations/20261101170000_strength_assessment_drafts_atomic.sql','utf8')
const prepared = readFileSync('docs/sql/strength-reassessment-cadence.sql','utf8')
const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const values={weight:'150',height_in:'65',squat_weight:'0',squat_reps:'8'}

test('prepared atomic cadence gate preserves draft/history/replay; sequential different-period completions observe the prior final', async t => {
  const db=new PGlite();t.after(()=>db.close())
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated,service_role;
    insert into auth.users values('${owner}'),('${other}');
    create table clients(client_id text primary key,auth_user_id uuid,program text,timezone text,state text,onboarding_data jsonb default '{}');
    create table assessments(id uuid primary key default gen_random_uuid(),client_id text references clients,auth_user_id uuid,program text,assessment_type text,data jsonb,source text,submitted_at timestamptz default now());
    create table client_current_profiles(client_id text primary key references clients,user_id uuid,current_weight numeric,updated_at timestamptz);
    create table program_outputs(id uuid primary key default gen_random_uuid(),client_id text references clients,auth_user_id uuid,program text,status text,program_json jsonb,generated_at timestamptz);
    create function public.member_has_capability(p_client_id text,p_capability text) returns boolean language sql stable as $$select exists(select 1 from public.clients where client_id=p_client_id and auth_user_id=auth.uid())$$;
    grant select,insert,update on clients,assessments,client_current_profiles,program_outputs to authenticated;
    alter table clients enable row level security;alter table assessments enable row level security;
    alter table client_current_profiles enable row level security;alter table program_outputs enable row level security;
    create policy own_clients on clients for all to authenticated using(auth_user_id=auth.uid()) with check(auth_user_id=auth.uid());
    create policy own_assessments on assessments for all to authenticated using(auth_user_id=auth.uid()) with check(auth_user_id=auth.uid());
    create policy own_profiles on client_current_profiles for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
    create policy own_outputs on program_outputs for all to authenticated using(auth_user_id=auth.uid()) with check(auth_user_id=auth.uid());
    insert into clients values('OWN','${owner}','ember','Etc/UTC',null,'{}'),('OTHER','${other}','ember','Etc/UTC',null,'{}');
    insert into assessments(client_id,auth_user_id,assessment_type,data,submitted_at) values('OWN','${owner}','initial','{}',clock_timestamp()-interval '1 year');`)
  await db.exec(existing)
  await db.exec(prepared);await db.exec(prepared)
  const identity=async id=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated')}
  const dates=(await db.query("select date_trunc('month',clock_timestamp())::date::text as current,(date_trunc('month',clock_timestamp())-interval '1 month')::date::text as previous")).rows[0]
  const call=async(period=dates.current,revision=0,complete=false,input=values)=>(await db.query('select public.save_strength_assessment($1,$2::date,$3,$4::jsonb,$5,$6::jsonb) as result',['OWN',period,revision,JSON.stringify(input),complete,complete?'{}':null])).rows[0].result
  await db.query("insert into strength_assessment_sessions(client_id,auth_user_id,period,values) values('OWN',$1,$2,$3::jsonb)",[owner,dates.previous,JSON.stringify(values)])
  await identity(owner)
  const first=await call();assert.equal(first.success,true);assert.equal(first.assessment.status,'draft')
  const final=await call(dates.current,1,true);assert.equal(final.success,true);assert.equal(final.assessment.status,'completed')
  const snapshot=async()=>({sessions:(await db.query('select to_jsonb(s) as row from strength_assessment_sessions s order by period')).rows,assessments:(await db.query('select to_jsonb(a) as row from assessments a order by submitted_at')).rows,profile:(await db.query('select to_jsonb(p) as row from client_current_profiles p')).rows,outputs:(await db.query('select to_jsonb(p) as row from program_outputs p')).rows})
  const before=await snapshot()
  const replay=await call(dates.current,1,true);assert.equal(replay.alreadyCompleted,true);assert.deepEqual(replay.assessment,final.assessment)
  // The second queued completion observes the final committed by the first
  // when it acquires the same existing client lock, even in a different period.
  const second=await call(dates.previous,1,true)
  assert.equal(second.code,'not_eligible');assert.equal(second.status,409);assert.ok(second.eligibleDate)
  assert.deepEqual(await snapshot(),before)
  const resumed=await call(dates.previous,1,false,{...values,squat_weight:'12.'})
  assert.equal(resumed.success,true);assert.equal(resumed.assessment.status,'draft');assert.equal(resumed.assessment.revision,2)
  await identity(other);assert.equal((await call()).status,404)
  await db.exec('reset role')
  const grants=(await db.query("select p.prosecdef,has_function_privilege('anon',p.oid,'execute') as anon,has_function_privilege('authenticated',p.oid,'execute') as member,has_function_privilege('service_role',p.oid,'execute') as service from pg_proc p where p.oid='public.save_strength_assessment(text,date,bigint,jsonb,boolean,jsonb)'::regprocedure")).rows[0]
  assert.deepEqual(grants,{prosecdef:false,anon:false,member:true,service:false})
  assert.ok(prepared.indexOf('for update')<prepared.indexOf('into v_eligible'))
  assert.ok(prepared.indexOf('for update')<prepared.indexOf('v_now:=clock_timestamp();'))
  assert.ok(prepared.indexOf("'alreadyCompleted'")<prepared.indexOf('into v_eligible'))
})

test('prepared Postgres calendar arithmetic matches the existing clamped date policy, including local dates and leap years',async t=>{
  const db=new PGlite();t.after(()=>db.close())
  const { strengthCadence }=await importTs('lib/assessment/strengthCadence.ts')
  for(const [stamp,zone] of [['2026-09-01T02:30:00Z','America/Chicago'],['2023-11-30T18:00:00Z','America/New_York'],['2024-02-29T12:00:00Z','Etc/UTC'],['2026-08-09T23:30:00Z','Pacific/Honolulu']]){
    const result=(await db.query("select (($1::timestamptz at time zone $2)::date+interval '3 months')::date::text as eligible",[stamp,zone])).rows[0].eligible
    assert.equal(result,strengthCadence({timezone:zone},stamp,new Date('2026-11-09T12:00:00Z')).eligibleDate)
  }
})
