// Exact review SQL rehearsal using only synthetic, isolated PGlite fixtures.
// No network, production keys, customer records, or remote database are used.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

const root = new URL('../', import.meta.url)
const db = new PGlite()
const owner = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'
await db.exec(`
  create role anon; create role authenticated;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as
    $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  create table auth.users(id uuid primary key);
  grant usage on schema public,auth to anon,authenticated;
  grant execute on function auth.uid() to anon,authenticated;
  create table public.clients(client_id text primary key,auth_user_id uuid,
    program text,onboarding_data jsonb);
  alter table public.clients enable row level security;
  create policy owned_clients on public.clients for all to authenticated
    using(auth_user_id=auth.uid()) with check(auth_user_id=auth.uid());
  grant select,update on public.clients to authenticated;
  insert into auth.users values('${owner}'),('${other}');
  insert into public.clients values
    ('LOCAL-QA-OWNER','${owner}','ignite','{"history":"preserve"}'),
    ('LOCAL-QA-OTHER','${other}','phoenix','{"history":"preserve"}');
  create table public.recommendation_audit_logs(
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id),
    recommendation_type text not null,engine_version text not null,
    recommendation_output jsonb not null);
  alter table public.recommendation_audit_logs enable row level security;
  create policy "users read own recommendation logs" on public.recommendation_audit_logs
    for select using(auth.uid()=user_id);
  create policy "users insert own recommendation logs" on public.recommendation_audit_logs
    for insert with check(auth.uid()=user_id);
`)
const before = (await db.query('select * from clients order by client_id')).rows
for (const file of ['production-outage-schedule-review-2026-10-13.sql','production-outage-audit-review-2026-10-13.sql']) {
  await db.exec(readFileSync(new URL(`docs/sql/${file}`,root),'utf8'))
}
assert.deepEqual((await db.query('select * from clients order by client_id')).rows,before)
await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${owner}',false)`)
const blocks = [{block_type:'work',label:'Synthetic work',days_of_week:[1,2,3],start_time:'09:00',end_time:'17:00'}]
await db.query('select replace_daily_commitments($1,$2)',['LOCAL-QA-OWNER',JSON.stringify(blocks)])
assert.equal((await db.query('select count(*)::int n from client_schedule_blocks')).rows[0].n,1)
await assert.rejects(db.query('select replace_daily_commitments($1,$2)',
  ['LOCAL-QA-OWNER',JSON.stringify([{...blocks[0],block_type:'invalid'}])]),/check constraint/)
assert.equal((await db.query('select label from client_schedule_blocks')).rows[0].label,'Synthetic work')
await assert.rejects(db.query('select replace_daily_commitments($1,$2)',
  ['LOCAL-QA-OWNER','null']),/Invalid commitments/)
await assert.rejects(db.query('select replace_daily_commitments($1,$2)',
  ['LOCAL-QA-OTHER','[]']),/Client not found/)
await assert.rejects(db.query('insert into client_schedule_blocks(user_id,client_id,block_type,start_time,end_time) values($1,$2,$3,$4,$5)',
  [owner,'LOCAL-QA-OTHER','work','09:00','17:00']),/row-level security/)
await assert.rejects(db.query("update client_schedule_blocks set client_id='LOCAL-QA-OTHER'"),/row-level security/)
await db.query('insert into recommendation_audit_logs(user_id,recommendation_type,engine_version,recommendation_output) values($1,$2,$3,$4)',
  [owner,'synthetic','local-qa','{}'])
await assert.rejects(db.query('insert into recommendation_audit_logs(user_id,recommendation_type,engine_version,recommendation_output) values($1,$2,$3,$4)',
  [other,'synthetic','local-qa','{}']),/row-level security/)
await assert.rejects(db.query('select * from recommendation_audit_logs'),/permission denied/)
await assert.rejects(db.query("update recommendation_audit_logs set engine_version='changed'"),/permission denied/)
await assert.rejects(db.query('delete from recommendation_audit_logs'),/permission denied/)
await db.exec(`select set_config('request.jwt.claim.sub','${other}',false)`)
assert.equal((await db.query('select count(*)::int n from client_schedule_blocks')).rows[0].n,0)
await db.exec('reset role;set role anon;')
await assert.rejects(db.query('select replace_daily_commitments($1,$2)',['LOCAL-QA-OWNER','[]']),/permission denied/)
await assert.rejects(db.query('select * from client_schedule_blocks'),/permission denied/)
await assert.rejects(db.query('insert into recommendation_audit_logs(user_id,recommendation_type,engine_version,recommendation_output) values($1,$2,$3,$4)',
  [owner,'synthetic','local-qa','{}']),/permission denied/)
await db.exec('reset role;')
assert.deepEqual((await db.query('select * from clients order by client_id')).rows,before)
assert.equal((await db.query('select count(*)::int n from recommendation_audit_logs')).rows[0].n,1)
await db.close()
console.log('PASS: exact schedule/audit review SQL; owned save/readback; invalid replacement rollback; cross-client insert/update/RPC denial; cross-user isolation; anonymous denial; audit INSERT-only access; synthetic client history preserved. No production change.')
