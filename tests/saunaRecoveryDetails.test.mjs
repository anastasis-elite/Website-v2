import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { importTs } from './typescriptModule.mjs'

const detail = await importTs('lib/recovery/activityDetails.ts')
const display = await importTs('lib/recovery/activityDisplay.ts')
const timing = await importTs('lib/meditation/practiceTiming.ts')
const { POST } = await importTs('app/api/recovery/activity/route.ts', {
  'next/server': 'export const NextResponse = { json: (body, init) => Response.json(body, init) }',
  '@/lib/supabase/server': 'export const createClient = async () => globalThis.saunaRecoveryDb',
  '@/lib/timezone': 'export const getClientLocalDate = () => globalThis.saunaRecoveryDate || "2026-11-02"',
  '@/lib/analytics/server': 'export const recordConversion = async () => false',
  '@/lib/dashboard/invalidateDailyPlan': 'export const invalidateDailyPlan = () => { globalThis.saunaInvalidations++ }',
})
const owner = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'
const requestId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const sauna = patch => ({ clientId: 'own-client', activityType: 'Sauna', minutes: 10.5, requestId,
  details: { kind: 'sauna', source: 'manual', context: 'before_workout' }, ...patch })
const request = body => new Request('http://sauna.test/api/recovery/activity', { method: 'POST', body: JSON.stringify(body) })
const compatibility = () => readFileSync('docs/sql/recovery-sauna-details-compatibility.sql', 'utf8')

function database({ signedIn = true, failInsert = false } = {}) {
  const rows = [{ user_id: other, client_id: 'other-client', activity_type: 'Mobility', duration_minutes: 10, log_date: '2026-11-01' }]
  const db = { rows, failInsert, writes: [], inserts: 0,
    auth: { getUser: async () => ({ data: { user: signedIn ? { id: owner } : null } }) },
    from(table) {
      assert.ok(['clients', 'recovery_activity_logs'].includes(table), 'Recovery must not read/write water, workout completion or another activity system.')
      const filters = []
      const q = { select() { return q }, eq(key, value) { filters.push([key, value]);return q },
        async maybeSingle() {
          const candidates = table === 'clients' ? [
            { client_id: 'own-client', auth_user_id: owner, program: 'ignite', access: true, active: true },
            { client_id: 'other-client', auth_user_id: other, program: 'ignite', access: true, active: true },
          ] : rows
          return { data: candidates.find(row => filters.every(([key, value]) => row[key] === value)) || null, error: null }
        },
        async insert(row) {
          assert.equal(table, 'recovery_activity_logs')
          db.inserts++;db.writes.push({ table, row: structuredClone(row) })
          if (db.failInsert) { db.failInsert = false;return { error: { code: 'XX000', message: 'Temporary synthetic save failure' } } }
          if (row.request_id && rows.some(old => old.user_id === row.user_id && old.client_id === row.client_id && old.request_id === row.request_id)) {
            return { error: { code: '23505', message: 'Duplicate request' } }
          }
          rows.push(structuredClone(row));return { error: null }
        },
      }
      return q
    },
  }
  globalThis.saunaRecoveryDb = db;globalThis.saunaInvalidations = 0
  delete globalThis.saunaRecoveryDate
  return db
}

test('Sauna validation requires actual duration/context and accepts optional manual heart rate without a safety guarantee', () => {
  for (const context of ['before_workout', 'after_workout', 'standalone']) {
    const saved = detail.validateDetailedRecovery(sauna({ details: { kind: 'sauna', source: 'manual', context } }))
    assert.equal(saved.durationMinutes, 10)
    assert.equal(saved.details.durationMinutes, 10.5)
    assert.equal(saved.details.context, context)
    assert.equal(saved.details.source, 'manual')
    assert.equal(Object.hasOwn(saved.details, 'heartRateBpm'), false)
  }
  for (const heartRateBpm of [104, 105, 180]) {
    const saved = detail.validateDetailedRecovery(sauna({ details: { kind: 'sauna', source: 'manual', context: 'standalone', heartRateBpm } }))
    assert.equal(saved.details.heartRateBpm, heartRateBpm, 'A manual record above a coaching limit must not be hidden or replaced by an invented reading.')
  }
  for (const value of [undefined, null, '', 'before', 'BEFORE_WORKOUT', 1]) {
    assert.throws(() => detail.validateDetailedRecovery(sauna({ details: { kind: 'sauna', source: 'manual', context: value } })))
  }
  for (const minutes of [0, -1, 1441, '10', null, NaN, Infinity]) assert.throws(() => detail.validateDetailedRecovery(sauna({ minutes })))
  for (const fields of [{ source: 'watch' }, { heartRateBpm: 0 }, { heartRateBpm: 104.5 }, { heartRateBpm: 301 }, { heartRateBpm: null },
    { restingHeartRate: 60 }, { liveHeartRate: 104 }, { thresholdSafe: true }, { distance: 1 }, { context: 'standalone', hydrationOz: 16 }]) {
    assert.throws(() => detail.validateDetailedRecovery(sauna({ details: { ...sauna().details, ...fields } })))
  }
  assert.throws(() => detail.validateDetailedRecovery(sauna({ activityType: 'Warm soak' })))
})

test('Sauna history identifies actual minutes, manual entry and selected context without live monitoring or hydration claims', () => {
  const details = detail.validateDetailedRecovery(sauna({ details: { ...sauna().details, heartRateBpm: 104 } })).details
  const lines = display.formatRecoveryDetails(details).join(' | ')
  assert.match(lines, /10\.5 minutes/)
  assert.match(lines, /manual/i)
  assert.match(lines, /before.?workout/i)
  assert.match(lines, /104 bpm/)
  assert.doesNotMatch(lines, /safe|live|automatic|alert|water logged|hydration complete/i)
})

test('Sauna route is owner-bound and retries save one immutable recovery row without hydration or workout writes', async () => {
  const signedOut = database({ signedIn: false })
  assert.equal((await POST(request(sauna()))).status, 401);assert.equal(signedOut.inserts, 0)
  const db = database({ failInsert: true }), untouched = structuredClone(db.rows[0])
  assert.equal((await POST(request(sauna({ clientId: 'other-client' })))).status, 404)
  assert.equal(db.inserts, 0)
  assert.equal((await POST(request(sauna()))).status, 500)
  assert.equal(db.rows.length, 1)
  assert.equal(globalThis.saunaInvalidations, 0)
  assert.equal((await POST(request(sauna()))).status, 200)
  const first = structuredClone(db.rows[1])
  assert.equal(first.activity_type, 'Sauna');assert.equal(first.duration_minutes, 10)
  assert.equal(first.activity_details.durationMinutes, 10.5);assert.equal(first.activity_details.context, 'before_workout')
  globalThis.saunaRecoveryDate = '2026-11-03'
  assert.equal((await POST(request(sauna()))).status, 200)
  assert.equal(db.rows.length, 2);assert.deepEqual(db.rows[1], first);assert.deepEqual(db.rows[0], untouched)
  assert.equal((await POST(request(sauna({ details: { ...sauna().details, context: 'after_workout' } })))).status, 409)
  assert.equal((await POST(request({ clientId: 'own-client', activityType: 'Sauna', minutes: 10 }))).status, 400)
  assert.equal((await POST(request(sauna({ details: { ...sauna().details, source: 'watch' } })))).status, 400)
  assert.equal(db.rows.length, 2)
  assert.ok(db.writes.every(write => write.table === 'recovery_activity_logs'))
  delete globalThis.saunaRecoveryDate
})

test('existing generic recovery and completed breathing logging retain their paths alongside Sauna', async () => {
  const db = database()
  for (const [activityType, minutes, expected] of [['Gentle walk', 3, 5], ['Warm soak', 25, 25], ['Full rest', 20, null]]) {
    assert.equal((await POST(request({ clientId: 'own-client', activityType, minutes }))).status, 200)
    assert.equal(db.rows.at(-1).duration_minutes, expected)
    assert.equal(Object.hasOwn(db.rows.at(-1), 'request_id'), false)
  }
  const elapsedMs = timing.createPracticeTimeline('breath-reset', true).durationMs
  assert.equal((await POST(request({ clientId: 'own-client', activityType: 'Breathwork', practiceId: 'breath-reset', skipHolds: true, elapsedMs }))).status, 200)
  assert.equal(db.rows.at(-1).duration_minutes, Math.floor(elapsedMs / 60_000))
})

async function postgres() {
  const pg = new PGlite()
  await pg.exec(`create role authenticated;create schema auth;create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
    create table public.clients(client_id text primary key,auth_user_id uuid not null references auth.users(id));
    alter table public.clients enable row level security;
    create policy own_clients on public.clients for select to authenticated using(auth_user_id=(select auth.uid()));
    grant select on public.clients to authenticated;create table public.recovery_logs(id uuid primary key);
    insert into auth.users values('${owner}'),('${other}');
    insert into public.clients values('own-client','${owner}'),('own-client-2','${owner}'),('other-client','${other}');`)
  await pg.exec(readFileSync('supabase/migrations/20260702_daily_check_in_and_recovery.sql', 'utf8'))
  await pg.exec(readFileSync('supabase/migrations/20261030164252_recovery_activity_details.sql', 'utf8'))
  return pg
}

test('prepared Sauna constraint preserves old rows, owner RLS and request dedup while rejecting malformed Sauna details', async t => {
  const pg = await postgres();t.after(() => pg.close())
  const walk = detail.validateDetailedRecovery({ activityType: 'Gentle walk', minutes: 12, requestId,
    details: { kind: 'slow_walk', source: 'manual' } }).details
  const soak = detail.validateDetailedRecovery({ activityType: 'Warm soak', minutes: 8, requestId,
    details: { kind: 'warm_soak', source: 'manual', additions: ['none'] } }).details
  await pg.query(`insert into recovery_activity_logs(user_id,client_id,activity_type,duration_minutes,request_id,activity_details)
    values($1,'own-client','Gentle walk',12,$2,$3::jsonb),($1,'own-client','Warm soak',8,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',$4::jsonb),
    ($1,'own-client','Breathwork',2,null,null)`, [owner, requestId, JSON.stringify(walk), JSON.stringify(soak)])
  const snapshot = async () => (await pg.query('select to_jsonb(r) row from recovery_activity_logs r order by id')).rows
  const before = await snapshot()
  const guards = async () => (await pg.query(`select relrowsecurity,(select indexdef from pg_indexes where indexname='recovery_activity_request_owner_idx') idx,
    (select jsonb_agg(to_jsonb(p) order by p.policyname) from pg_policies p where p.tablename='recovery_activity_logs') policies,
    has_table_privilege('authenticated','public.recovery_activity_logs','insert') member_insert,
    has_table_privilege('authenticated','public.recovery_activity_logs','update') member_update
    from pg_class where oid='public.recovery_activity_logs'::regclass`)).rows[0]
  const originalGuards = await guards()
  await pg.exec(compatibility())
  assert.deepEqual(await snapshot(), before);assert.deepEqual(await guards(), originalGuards)
  await pg.exec(`set role authenticated;set request.jwt.claim.sub='${owner}'`)
  const insert = (client, id, value, minutes = 10, user = owner, type = 'Sauna') => pg.query(`insert into recovery_activity_logs(user_id,client_id,activity_type,duration_minutes,request_id,activity_details)
    values($1,$2,$3,$4,$5,$6::jsonb)`, [user, client, type, minutes, id, value === undefined ? null : JSON.stringify(value)])
  const valid = context => ({ kind: 'sauna', source: 'manual', durationMinutes: 10.5, context })
  for (const [index, context] of ['before_workout', 'after_workout', 'standalone'].entries()) {
    await insert('own-client', `cccccccc-cccc-4ccc-8ccc-ccccccccccc${index}`, { ...valid(context), ...(index === 2 ? { heartRateBpm: 104 } : {}) })
  }
  await assert.rejects(insert('own-client', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc0', valid('before_workout')), /unique constraint/)
  await insert('own-client-2', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc0', valid('standalone'))
  await assert.rejects(insert('other-client', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', valid('standalone')), /row-level security/)
  await assert.rejects(insert('other-client', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', valid('standalone'), 10, other), /row-level security/)
  for (const value of [undefined, null, {}, [], { ...valid('standalone'), source: 'watch' }, { ...valid('standalone'), context: null },
    { ...valid('standalone'), context: 'pre_workout' }, { ...valid('standalone'), durationMinutes: 0 }, { ...valid('standalone'), durationMinutes: 1441 },
    { ...valid('standalone'), heartRateBpm: 0 }, { ...valid('standalone'), heartRateBpm: 104.5 }, { ...valid('standalone'), heartRateBpm: 301 },
    { ...valid('standalone'), heartRateBpm: null }, { ...valid('standalone'), liveHeartRate: 104 }]) {
    await assert.rejects(insert('own-client', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', value))
  }
  await assert.rejects(insert('own-client', null, valid('standalone')))
  await assert.rejects(insert('own-client', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', valid('standalone'), 11))
  await assert.rejects(insert('own-client', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', valid('standalone'), 10, owner, 'Warm soak'))
})

test('prepared compatibility SQL fails atomically for legacy Sauna rows without inventing details or removing history', async t => {
  const pg = await postgres();t.after(() => pg.close())
  await pg.query(`insert into recovery_activity_logs(user_id,client_id,activity_type,duration_minutes) values($1,'own-client','Sauna',10)`, [owner])
  const snapshot = async () => (await pg.query('select to_jsonb(r) row from recovery_activity_logs r')).rows
  const before = await snapshot()
  const oldConstraint = (await pg.query(`select pg_get_constraintdef(oid) definition from pg_constraint where conname='recovery_activity_details_shape'`)).rows[0].definition
  await assert.rejects(pg.exec(compatibility()), /sauna|review|details|constraint/i)
  await pg.exec('rollback')
  assert.deepEqual(await snapshot(), before)
  assert.equal((await pg.query(`select pg_get_constraintdef(oid) definition from pg_constraint where conname='recovery_activity_details_shape'`)).rows[0].definition, oldConstraint)
})
