import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

const migrationPath = 'supabase/migrations/20261102211437_retired_disclaimer_acceptance.sql'
const migration = readFileSync(migrationPath, 'utf8')
const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

async function fixture() {
  const db = new PGlite()
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema public,auth to anon,authenticated,service_role;
    insert into auth.users values('${owner}'),('${other}');
    create table public.legal_acceptances (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references auth.users(id) on delete cascade,
      terms_version text not null, privacy_version text not null,
      health_disclaimer_version text not null, ai_disclaimer_version text not null,
      research_consent_version text,
      accepted_at timestamptz not null default now(), ip_address text,
      user_agent text, acceptance_source text not null, created_at timestamptz not null default now()
    );
    create index legal_acceptances_user_time_idx on public.legal_acceptances(user_id,accepted_at desc);
    create function public.prevent_compliance_record_mutation() returns trigger language plpgsql as $$
      begin raise exception 'Compliance records are immutable'; end;
    $$;
    create trigger legal_acceptances_immutable before update on public.legal_acceptances
      for each row execute function public.prevent_compliance_record_mutation();
    alter table public.legal_acceptances enable row level security;
    alter table public.legal_acceptances force row level security;
    create policy "users read own legal acceptances" on public.legal_acceptances for select using(auth.uid()=user_id);
    create policy "users insert own legal acceptances" on public.legal_acceptances for insert with check(auth.uid()=user_id);
    revoke all on public.legal_acceptances from public,anon,authenticated,service_role;
    grant select,insert on public.legal_acceptances to service_role;
    insert into public.legal_acceptances(id,user_id,terms_version,privacy_version,health_disclaimer_version,ai_disclaimer_version,research_consent_version,accepted_at,acceptance_source)
      values('11111111-1111-4111-8111-111111111111','${owner}','v1.0','v1.0','v1.0','v1.0','v1.0','2026-07-01T12:00Z','synthetic-historical');
  `)
  return db
}

const rows = async db => (await db.query('select to_jsonb(a) as row from public.legal_acceptances a order by id')).rows
const column = async (db, name) => (await db.query(`select attnotnull from pg_catalog.pg_attribute where attrelid='public.legal_acceptances'::regclass and attname=$1`, [name])).rows[0]
const insert = (db, versions = ['v1.0', 'v1.0', 'v1.0', null], userId = other) => db.query(`
  insert into public.legal_acceptances(user_id,terms_version,privacy_version,health_disclaimer_version,ai_disclaimer_version,acceptance_source)
  values($1,$2,$3,$4,$5,'synthetic-current') returning ai_disclaimer_version`, [userId, ...versions])

async function protections(db) {
  const table = (await db.query(`select relrowsecurity,relforcerowsecurity,relacl::text from pg_catalog.pg_class where oid='public.legal_acceptances'::regclass`)).rows
  const policies = (await db.query(`select policyname,permissive,roles,cmd,qual,with_check from pg_catalog.pg_policies where schemaname='public' and tablename='legal_acceptances' order by policyname`)).rows
  const triggers = (await db.query(`select tgname,tgenabled,pg_get_triggerdef(oid) as definition from pg_catalog.pg_trigger where tgrelid='public.legal_acceptances'::regclass and not tgisinternal order by tgname`)).rows
  const indexes = (await db.query(`select indexname,indexdef from pg_catalog.pg_indexes where schemaname='public' and tablename='legal_acceptances' order by indexname`)).rows
  return { table, policies, triggers, indexes }
}

test('retirement permits explicit NULL only after compatibility and replays without changing original consent history', async t => {
  const db = await fixture();t.after(() => db.close())
  const original = await rows(db)
  await assert.rejects(insert(db), /null value.*ai_disclaimer_version/)
  assert.deepEqual(await rows(db), original)
  await db.exec(migration);await db.exec(migration)
  assert.deepEqual(await rows(db), original)
  assert.equal((await column(db, 'ai_disclaimer_version')).attnotnull, false)
  assert.deepEqual((await insert(db)).rows, [{ ai_disclaimer_version: null }])
  assert.equal((await rows(db)).length, 2)
  assert.deepEqual((await rows(db)).find(item => item.row.acceptance_source === 'synthetic-historical'), original[0])
  for (const [index, name] of ['terms_version', 'privacy_version', 'health_disclaimer_version'].entries()) {
    assert.equal((await column(db, name)).attnotnull, true)
    const versions = ['v1.0', 'v1.0', 'v1.0', null];versions[index] = null
    await assert.rejects(insert(db, versions), new RegExp(`null value.*${name}`))
  }
  assert.equal((await rows(db)).length, 2, 'Failed required agreements do not produce acceptance rows.')
})

test('retirement preserves immutable history, private grants, RLS policies and indexes', async t => {
  const db = await fixture();t.after(() => db.close())
  const before = await protections(db), original = await rows(db)
  await db.exec(migration)
  assert.deepEqual(await protections(db), before)
  const grants = (await db.query(`select role,
    has_table_privilege(role,'public.legal_acceptances','select') as can_read,
    has_table_privilege(role,'public.legal_acceptances','insert') as can_insert,
    has_table_privilege(role,'public.legal_acceptances','update') as can_update,
    has_table_privilege(role,'public.legal_acceptances','delete') as can_delete
    from unnest(array['anon','authenticated','service_role']) as role order by role`)).rows
  assert.deepEqual(grants, [
    { role: 'anon', can_read: false, can_insert: false, can_update: false, can_delete: false },
    { role: 'authenticated', can_read: false, can_insert: false, can_update: false, can_delete: false },
    { role: 'service_role', can_read: true, can_insert: true, can_update: false, can_delete: false },
  ])
  await assert.rejects(db.exec("update public.legal_acceptances set ai_disclaimer_version='changed'"), /Compliance records are immutable/)
  assert.deepEqual(await rows(db), original)
  for (const userId of [owner, other]) {
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [userId])
    await db.exec('set role authenticated')
    await assert.rejects(db.exec('select * from public.legal_acceptances'), /permission denied/)
    await assert.rejects(insert(db), /permission denied/)
    await db.exec('reset role')
  }
  await db.exec('set role anon')
  await assert.rejects(db.exec('select * from public.legal_acceptances'), /permission denied/)
  await assert.rejects(insert(db), /permission denied/)
  await db.exec('reset role')
  assert.deepEqual(await rows(db), original)
})

test('compatibility refuses missing or unexpected foundations instead of silently weakening legal protections', async () => {
  const missing = new PGlite()
  try {
    await assert.rejects(missing.exec(migration), /Legal compliance foundation must exist/)
    await missing.exec('rollback')
    assert.equal((await missing.query("select to_regclass('public.legal_acceptances') as table_name")).rows[0].table_name, null)
  } finally { await missing.close() }
  for (const [mutation, expected] of [
    ["alter table public.legal_acceptances alter column ai_disclaimer_version set default 'v1.0'", /historical disclaimer text column without a default/],
    ['alter table public.legal_acceptances alter column terms_version drop not null', /Required Terms, Privacy and Health/],
    ['alter table public.legal_acceptances disable row level security', /RLS and immutable-history guard/],
    ['alter table public.legal_acceptances disable trigger legal_acceptances_immutable', /RLS and immutable-history guard/],
    ['alter table public.legal_acceptances enable replica trigger legal_acceptances_immutable', /RLS and immutable-history guard/],
  ]) {
    const db = await fixture()
    try {
      await db.exec(mutation);const before = await rows(db)
      await assert.rejects(db.exec(migration), expected)
      await db.exec('rollback')
      assert.equal((await column(db, 'ai_disclaimer_version')).attnotnull, true)
      assert.deepEqual(await rows(db), before)
    } finally { await db.close() }
  }
})

test('old non-null writers remain compatible and rollback cannot fabricate versions for valid new acceptances', async t => {
  const db = await fixture();t.after(() => db.close())
  await db.exec(migration)
  assert.deepEqual((await insert(db, ['v1.0', 'v1.0', 'v1.0', 'v1.0'])).rows, [{ ai_disclaimer_version: 'v1.0' }])
  await insert(db)
  const preserved = await rows(db)
  await assert.rejects(db.exec('alter table public.legal_acceptances alter column ai_disclaimer_version set not null'), /contains null values/)
  assert.deepEqual(await rows(db), preserved)
  assert.equal(preserved.filter(item => item.row.ai_disclaimer_version === null).length, 1)
  assert.equal(preserved.filter(item => item.row.ai_disclaimer_version === 'v1.0').length, 2)
})
