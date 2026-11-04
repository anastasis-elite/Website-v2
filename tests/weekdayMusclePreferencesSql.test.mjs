import assert from 'node:assert/strict'
import test, { after } from 'node:test'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { importTs } from './typescriptModule.mjs'

const sql = readFileSync('docs/sql/weekday-muscle-preferences-guard.sql', 'utf8')
const { mergeWeekdayMusclePreferences, getWeekdayMusclePreferencesView } = await importTs('lib/program/weekdayMusclePreferences.ts')
const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const db = new PGlite(); await db.waitReady; after(() => db.close())
await db.exec(`create role authenticated; create role anon; create role service_role;
 create schema auth; create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 create table public.clients(client_id text primary key,auth_user_id uuid,program text,access boolean,active boolean,timezone text,state text,onboarding_data jsonb);
 create function public.member_has_capability(p_client_id text,p_capability text) returns boolean language sql stable as $$
  select exists(select 1 from public.clients where client_id=p_client_id and auth_user_id=auth.uid() and program in ('ember','ignite','phoenix') and access is true and active is not false) $$;
 grant usage on schema public,auth to authenticated,anon,service_role;
 grant select,insert,update on clients to authenticated;
 grant execute on function auth.uid(),public.member_has_capability(text,text) to authenticated;`)
const timezoneSql = readFileSync('supabase/migrations/20261101170000_strength_assessment_drafts_atomic.sql', 'utf8').match(/create or replace function public\.strength_assessment_timezone[\s\S]*?grant execute on function public\.strength_assessment_timezone\(text\) to authenticated,service_role;/)[0]
await db.exec(timezoneSql)
await db.exec(sql); await db.exec(sql)
let count = 0
async function identity(id = owner) { await db.exec('reset role; set role authenticated'); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]) }
async function client(options = {}) {
  await db.exec('reset role')
  const id = `SYNTHETIC-${++count}`
  await db.query('insert into clients values($1,$2,$3,true,true,$4,$5,$6)', [id, owner, options.tier || 'ignite', options.timezone ?? 'America/New_York', options.state || null, JSON.stringify({ unrelated: { preserved: true }, ...(options.onboarding || {}) })])
  await identity()
  return id
}
async function calendar(id) { return (await db.query("select clock_timestamp()::text as stamp,(clock_timestamp() at time zone public.strength_assessment_timezone($1))::date::text as today,date_trunc('week',clock_timestamp() at time zone public.strength_assessment_timezone($1))::date+7 as monday", [id])).rows[0] }
async function current(id) { return (await db.query('select onboarding_data from clients where client_id=$1', [id])).rows[0].onboarding_data }
const op = index => `cccccccc-cccc-4ccc-8ccc-${String(index).padStart(12, '0')}`
async function proposal(id, overrides = {}) {
  const { stamp, today } = await calendar(id)
  const before = await current(id), revision = before.weekdayMusclePreferences?.revision || 0
  return mergeWeekdayMusclePreferences(before, { expectedRevision: revision, operationId: op(count), choice: { mode: 'program_default' }, today, savedAt: new Date(stamp).toISOString(), ...overrides }).onboardingData
}
const write = (id, value) => db.query('update clients set onboarding_data=$2::jsonb where client_id=$1 returning onboarding_data', [id, JSON.stringify(value)])

test('prepared guard is additive and a normal owned API-shaped CAS is accepted with unrelated JSON preserved', async () => {
  assert.doesNotMatch(sql, /create\s+table|alter\s+table|create\s+policy|update\s+public\.clients\s+set/i)
  assert.doesNotMatch(sql, /^\s*grant\s|valid_weekday_muscle_choice/m)
  assert.ok(sql.indexOf('lock table public.clients in share row exclusive mode') < sql.indexOf('do $existing_keys$'))
  const id = await client(), value = await proposal(id), before = await current(id)
  const saved = (await db.query('update clients set onboarding_data=$2::jsonb where client_id=$1 and onboarding_data=$3::jsonb returning onboarding_data', [id, JSON.stringify(value), JSON.stringify(before)])).rows[0].onboarding_data
  assert.deepEqual(saved, value); assert.deepEqual(saved.unrelated, { preserved: true })
  assert.deepEqual((await write(id, value)).rows[0].onboarding_data, value, 'An exact no-op remains compatible with retry.')
})
test('direct backdating, early activation, arbitrary current and stale revision cannot bypass the route', async () => {
  const id = await client(), valid = await proposal(id)
  for (const mutate of [
    value => { value.weekdayMusclePreferences.pending.effectiveDate = '2000-01-03'; value.weekdayMusclePreferences.lastOperation.requestedDate = '1999-12-28' },
    value => { value.weekdayMusclePreferences.current = value.weekdayMusclePreferences.pending },
    value => { value.weekdayMusclePreferences.revision = 3 },
    value => { value.weekdayMusclePreferences.pending.savedAt = '2000-01-01T00:00:00Z' },
  ]) { const bad = structuredClone(valid); mutate(bad); await assert.rejects(write(id, bad), /next local Monday|changed|time changed/) }
  assert.equal((await current(id)).weekdayMusclePreferences, undefined)
})
test('second save preserves current/pending transition, rejects deletion and same operation reuse', async () => {
  const id = await client(), first = await proposal(id); await write(id, first)
  const { stamp, today } = await calendar(id)
  const next = mergeWeekdayMusclePreferences(first, { expectedRevision: 1, operationId: op(count + 100), choice: { mode: 'custom', days: { Monday: ['chest', 'biceps'], Tuesday: [], Wednesday: ['core'], Thursday: [], Friday: [], Saturday: [], Sunday: [] } }, today, savedAt: new Date(stamp).toISOString() }).onboardingData
  await write(id, next)
  assert.equal(getWeekdayMusclePreferencesView(await current(id), today, 'America/New_York').current, null)
  assert.deepEqual(next.weekdayMusclePreferences.pending.choice.days.Monday, ['chest', 'biceps'])
  const reuse = structuredClone(next); reuse.weekdayMusclePreferences.revision = 3; reuse.weekdayMusclePreferences.lastOperation.expectedRevision = 2
  await assert.rejects(write(id, reuse), /receipt/)
  const deleted = { unrelated: { preserved: true } }; await assert.rejects(write(id, deleted), /state/)
  assert.deepEqual(await current(id), next)
})
test('changed preference key requires canonical owner and guided capability, while unrelated edits still work', async () => {
  const id = await client(), value = await proposal(id)
  await identity(other); await assert.rejects(write(id, value), /Owned guided/)
  await identity(); const tracker = await client({ tier: 'tracker' }), denied = await proposal(tracker)
  await assert.rejects(write(tracker, denied), /Owned guided/)
  const unrelated = await current(tracker); unrelated.otherPreference = { saved: true }
  assert.deepEqual((await write(tracker, unrelated)).rows[0].onboarding_data, unrelated)
})
test('existing authoritative timezone fallback and member-local calendar determine the enforced next Monday', async () => {
  for (const options of [{ timezone: 'America/Los_Angeles' }, { timezone: '', state: 'ID' }, { timezone: 'invalid/zone', state: 'NY' }]) {
    const id = await client(options), value = await proposal(id), info = await calendar(id)
    await write(id, value)
    assert.equal(value.weekdayMusclePreferences.pending.effectiveDate, new Date(info.monday).toISOString().slice(0, 10))
  }
  const helper = (await db.query("select public.strength_assessment_timezone($1) as zone", [`SYNTHETIC-${count}`])).rows[0].zone
  assert.equal(helper, 'America/New_York')
})
test('choice validation rejects unknown IDs, duplicated group days and extra fields without altering saved data', async () => {
  const id = await client(), valid = await proposal(id)
  for (const choice of [{ mode: 'program_default', extra: true }, { mode: 'custom', days: { Monday: ['invented'] } }, { mode: 'custom', days: { Monday: ['core'], Tuesday: ['core'], Wednesday: [], Thursday: [], Friday: [], Saturday: [], Sunday: [] } }, { mode: 'custom', days: { Monday: ['biceps', 'chest'], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [], Sunday: [] } }]) {
    const bad = structuredClone(valid); bad.weekdayMusclePreferences.pending.choice = choice; bad.weekdayMusclePreferences.lastOperation.choice = choice
    await assert.rejects(write(id, bad), /muscle choice/)
  }
  assert.equal((await current(id)).weekdayMusclePreferences, undefined)
  await db.query('update clients set timezone=$2 where client_id=$1', [id, 'Asia/Tokyo'])
  assert.equal((await db.query('select timezone from clients where client_id=$1', [id])).rows[0].timezone, 'Asia/Tokyo', 'A separate ordinary timezone edit remains unchanged.')
})

test('same-update timezone or state edits cannot turn the next-week pending choice into current work', async () => {
  const id = await client({ timezone: 'Pacific/Honolulu' }), valid = await proposal(id)
  for (const [column, value] of [['timezone', 'Asia/Tokyo'], ['state', 'NY']]) {
    await assert.rejects(db.query(`update clients set ${column}=$3,onboarding_data=$2::jsonb where client_id=$1`, [id, JSON.stringify(valid), value]), /timezone separately/)
  }
  for (const key of ['timezone', 'state']) {
    const value = { ...valid, [key]: key === 'timezone' ? 'Asia/Tokyo' : 'NY' }
    await assert.rejects(write(id, value), /timezone separately/)
  }
  assert.equal((await current(id)).weekdayMusclePreferences, undefined)
})
