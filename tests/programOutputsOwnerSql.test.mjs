import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { PGlite } from '@electric-sql/pglite'

test('reviewable plan-save SQL supports owned insert/update and blocks cross-owner, tier and revoked-access writes', async () => {
  const db = new PGlite()
  const a = '11111111-1111-4111-8111-111111111111', b = '22222222-2222-4222-8222-222222222222'
  await db.exec(`create role authenticated; create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
    create table public.clients(client_id text primary key, auth_user_id uuid, program text, access boolean, active boolean);
    grant select on public.clients to authenticated;`)
  await db.query('insert into auth.users values ($1),($2)', [a, b])
  await db.query("insert into clients values ('QA-A',$1,'ember',true,true),('QA-B',$2,'ignite',true,true)", [a, b])
  // Simulate a broad historical policy: the new restrictive boundary still governs it.
  await db.exec(`create table public.program_outputs(id uuid primary key default gen_random_uuid(),client_id text,auth_user_id uuid,program text,output jsonb,generated_at timestamptz default now());
    alter table program_outputs enable row level security;create policy old_broad_policy on program_outputs for all to authenticated using (true) with check (true);`)
  await db.query("insert into program_outputs(client_id,program,output) values ('QA-A','ember','{\"legacy\":true}')")
  const migration = readFileSync('supabase/migrations/20261012173013_member_program_ownership_and_workout_history.sql', 'utf8')
  await db.exec(migration.slice(0, migration.indexOf('-- Additive replacement;')))
  await db.exec(`set role authenticated; set request.jwt.claim.sub='${a}'`)
  assert.equal((await db.query('select * from program_outputs')).rows[0].output.legacy, true)
  await db.query("insert into program_outputs(client_id,auth_user_id,program,program_json,status) values('QA-A',$1,'ember','{\"days\":[]}','generated')", [a])
  assert.equal((await db.query('select * from program_outputs')).rows.length, 2)
  await db.query("update program_outputs set auth_user_id=$1,status='generated' where client_id='QA-A'", [a])
  await assert.rejects(db.query("insert into program_outputs(client_id,auth_user_id,program) values('QA-B',$1,'ignite')", [a]), /row-level security/)
  await assert.rejects(db.query("insert into program_outputs(client_id,auth_user_id,program) values('QA-A',$1,'phoenix')", [a]), /row-level security/)
  await assert.rejects(db.query("update program_outputs set client_id='QA-B' where client_id='QA-A'"), /row-level security/)
  await db.exec(`set request.jwt.claim.sub='${b}'`)
  assert.equal((await db.query('select * from program_outputs')).rows.length, 0)
  await db.exec('reset role')
  await db.query("update clients set access=false where client_id='QA-A'")
  await db.exec(`set role authenticated;set request.jwt.claim.sub='${a}'`)
  await assert.rejects(db.query("insert into program_outputs(client_id,auth_user_id,program) values('QA-A',$1,'ember')", [a]), /row-level security/)
  assert.equal((await db.query('select * from program_outputs')).rows.length, 2)
  await db.close()
})
