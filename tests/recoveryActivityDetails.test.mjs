import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { importTs } from './typescriptModule.mjs'

const details = await importTs('lib/recovery/activityDetails.ts')
const practice = await importTs('lib/meditation/practiceTiming.ts')
const route = await importTs('app/api/recovery/activity/route.ts', {
  'next/server': 'export const NextResponse = { json: (body, init) => Response.json(body, init) }',
  '@/lib/supabase/server': 'export const createClient = async () => globalThis.recoveryActivityDb',
  '@/lib/timezone': 'export const getClientLocalDate = () => globalThis.recoveryActivityDate || "2026-10-30"',
  '@/lib/dashboard/invalidateDailyPlan': 'export const invalidateDailyPlan = () => { globalThis.recoveryActivityInvalidations++ }',
})

const owner = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'
const requestId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const walk = patch => ({ clientId: 'own-client', activityType: 'Gentle walk', minutes: 12.5, requestId,
  details: { kind: 'slow_walk', source: 'manual', distance: 0.5, distanceUnit: 'mi', heartRateBpm: 82 }, ...patch })
const soak = patch => ({ clientId: 'own-client', activityType: 'Warm soak', minutes: 8.75, requestId,
  details: { kind: 'warm_soak', source: 'manual', temperature: 0, temperatureUnit: 'C', additions: ['herbs', 'tea', 'oats'], herbs: '  rosemary  ', tea: 'chamomile' }, ...patch })
const req = body => new Request('http://recovery.test/api/recovery/activity', { method: 'POST', body: JSON.stringify(body) })

test('manual details preserve actual duration, convert units and calculate pace only from valid positive measures', () => {
  const saved = details.validateDetailedRecovery(walk())
  assert.equal(saved.durationMinutes, 12)
  assert.equal(saved.details.durationMinutes, 12.5)
  assert.equal(saved.details.distanceMeters, 804.672)
  assert.equal(saved.details.heartRateBpm, 82)
  assert.equal(saved.details.source, 'manual')
  assert.equal(saved.details.paceSecondsPerKm, 12.5 * 60 / 0.804672)
  assert.equal(details.distanceToMeters(1, 'km'), 1000)
  assert.equal(details.temperatureToCelsius(32, 'F'), 0)
  assert.equal(details.temperatureToCelsius(212, 'F'), 100)
  assert.equal(details.calculateWalkPace(12.5, 0.5), 25)
  for (const [minutes, distance] of [[0, 1], [1, 0], [-1, 2], [NaN, 1], [1, Infinity]]) assert.equal(details.calculateWalkPace(minutes, distance), null)
  const minimal = details.validateDetailedRecovery(walk({ minutes: 0.5, details: { kind: 'slow_walk', source: 'manual' } }))
  assert.equal(minimal.durationMinutes, 0)
  assert.equal(minimal.details.durationMinutes, 0.5)
  for (const key of ['distance', 'distanceMeters', 'distanceUnit', 'paceSecondsPerKm', 'heartRateBpm']) assert.equal(Object.hasOwn(minimal.details, key), false)
})

test('soak supports multiple named additions, explicit none, omitted values, and valid zero temperature', () => {
  const saved = details.validateDetailedRecovery(soak()).details
  assert.equal(saved.temperature, 0)
  assert.equal(saved.temperatureCelsius, 0)
  assert.equal(saved.herbs, 'rosemary')
  assert.deepEqual(saved.additions, ['herbs', 'tea', 'oats'])
  const omitted = details.validateDetailedRecovery(soak({ details: { kind: 'warm_soak', source: 'manual' } })).details
  assert.equal(Object.hasOwn(omitted, 'temperature'), false)
  assert.deepEqual(omitted.additions, [])
  const none = details.validateDetailedRecovery(soak({ details: { kind: 'warm_soak', source: 'manual', additions: ['none'] } })).details
  assert.deepEqual(none.additions, ['none'])
  const all = details.validateDetailedRecovery(soak({ details: { kind: 'warm_soak', source: 'manual', additions: ['other', 'epsom_salts'], other: 'Unscented bath mix' } })).details
  assert.deepEqual(all.additions, ['epsom_salts', 'other'])
  assert.equal(all.other, 'Unscented bath mix')
})

test('detail validation rejects invalid numbers, wrong kinds, invented sources, unsupported units and unbounded text', () => {
  for (const minutes of [0, -1, 1441, '12', null, NaN, Infinity]) assert.throws(() => details.validateDetailedRecovery(walk({ minutes })))
  for (const requestId of ['', 'not-a-uuid', null]) assert.throws(() => details.validateDetailedRecovery(walk({ requestId })))
  for (const value of [null, [], { kind: 'slow_walk', source: 'watch' }, { kind: 'warm_soak', source: 'manual' },
    { kind: 'slow_walk', source: 'manual', distance: 0, distanceUnit: 'mi' },
    { kind: 'slow_walk', source: 'manual', distance: 1, distanceUnit: 'm' },
    { kind: 'slow_walk', source: 'manual', distance: 1001, distanceUnit: 'mi' },
    { kind: 'slow_walk', source: 'manual', distanceUnit: 'mi' },
    { kind: 'slow_walk', source: 'manual', heartRateBpm: 0 },
    { kind: 'slow_walk', source: 'manual', heartRateBpm: 82.2 },
    { kind: 'slow_walk', source: 'manual', heartRateBpm: 301 },
    { kind: 'slow_walk', source: 'manual', paceSecondsPerKm: 600 }]) assert.throws(() => details.validateDetailedRecovery(walk({ details: value })))
  for (const value of [
    { temperature: 0, temperatureUnit: 'K' }, { temperature: -274, temperatureUnit: 'C' }, { temperature: 1001, temperatureUnit: 'C' },
    { temperature: '100', temperatureUnit: 'F' }, { temperature: null, temperatureUnit: 'C' }, { temperatureUnit: 'F' },
    { additions: ['none', 'oats'] }, { additions: ['oats', 'oats'] }, { additions: ['stones'] },
    { additions: ['herbs'] }, { additions: ['tea'], tea: 'x'.repeat(121) }, { additions: ['other'], other: 'a\nline' },
    { additions: [], herbs: 'unselected' },
  ]) assert.throws(() => details.validateDetailedRecovery(soak({ details: { kind: 'warm_soak', source: 'manual', ...value } })))
  assert.equal(details.sameRecoveryDetails({ a: 1, b: { x: 2 } }, { b: { x: 2 }, a: 1 }), true)
  assert.equal(details.sameRecoveryDetails({ a: 1 }, { a: 2 }), false)
})

function database({ signedIn = true, failInsert = false } = {}) {
  const rows = [{ user_id: other, client_id: 'other-client', activity_type: 'Mobility', duration_minutes: 10, log_date: '2026-10-29' }]
  const db = { rows, failInsert, inserts: 0, auth: { getUser: async () => ({ data: { user: signedIn ? { id: owner } : null } }) },
    from(table) {
      const filters = []
      const query = { select() { return query }, eq(key, value) { filters.push([key, value]); return query },
        async maybeSingle() {
          const candidates = table === 'clients' ? [{ client_id: 'own-client', auth_user_id: owner }, { client_id: 'other-client', auth_user_id: other }] : rows
          return { data: candidates.find(row => filters.every(([key, value]) => row[key] === value)) ?? null, error: null }
        },
        async insert(row) {
          db.inserts++
          assert.equal(table, 'recovery_activity_logs')
          if (db.failInsert) { db.failInsert = false; return { error: { code: 'XX000', message: 'Temporary save failure' } } }
          if (row.request_id && rows.some(existing => existing.user_id === row.user_id && existing.client_id === row.client_id && existing.request_id === row.request_id)) return { error: { code: '23505', message: 'Duplicate request' } }
          rows.push(structuredClone(row))
          return { error: null }
        } }
      return query
    } }
  globalThis.recoveryActivityDb = db
  globalThis.recoveryActivityInvalidations = 0
  return db
}

test('route authorizes the owner, rejects malformed details, and leaves unrelated logs untouched', async () => {
  const signedOut = database({ signedIn: false })
  assert.equal((await route.POST(req(walk()))).status, 401)
  assert.equal(signedOut.inserts, 0)
  const db = database()
  assert.equal((await route.POST(req(walk({ clientId: 'other-client' })))).status, 404)
  assert.equal((await route.POST(new Request('http://recovery.test', { method: 'POST', body: '{broken' }))).status, 400)
  assert.equal((await route.POST(req(walk({ details: { kind: 'slow_walk', source: 'watch' } })))).status, 400)
  assert.equal(db.inserts, 0)
  const before = structuredClone(db.rows)
  assert.equal((await route.POST(req(walk()))).status, 200)
  assert.deepEqual(db.rows.slice(0, 1), before)
  assert.equal(db.rows[1].duration_minutes, 12)
  assert.equal(db.rows[1].activity_details.durationMinutes, 12.5)
  assert.equal(db.rows[1].user_id, owner)
})

test('save retries, concurrent requests and lost responses do not duplicate or overwrite logs', async () => {
  const db = database({ failInsert: true })
  assert.equal((await route.POST(req(walk()))).status, 500)
  assert.equal(db.rows.length, 1)
  assert.equal((await route.POST(req(walk()))).status, 200)
  globalThis.recoveryActivityDate = '2026-10-31'
  const retry = await route.POST(req(walk()))
  assert.equal(retry.status, 200)
  assert.deepEqual(await retry.json(), { success: true })
  assert.equal(db.rows.length, 2)
  assert.equal(db.rows[1].log_date, '2026-10-30')
  assert.equal((await route.POST(req(walk({ minutes: 13 })))).status, 409)
  assert.equal(db.rows[1].activity_details.durationMinutes, 12.5)
  assert.equal(db.rows.length, 2)
  delete globalThis.recoveryActivityDate
  const concurrent = database()
  const responses = await Promise.all([route.POST(req(soak())), route.POST(req(soak()))])
  assert.deepEqual(responses.map(response => response.status), [200, 200])
  assert.equal(concurrent.rows.length, 2)
})

test('generic activity logs and fully completed breathing sequences retain existing behavior', async () => {
  const db = database()
  for (const [activityType, minutes, expected] of [['Gentle walk', 3, 5], ['Warm soak', 25, 25], ['Mobility', 200, 90], ['Full rest', 30, null]]) {
    assert.equal((await route.POST(req({ clientId: 'own-client', activityType, minutes }))).status, 200)
    const row = db.rows.at(-1)
    assert.equal(row.duration_minutes, expected)
    assert.equal(Object.hasOwn(row, 'activity_details'), false)
    assert.equal(Object.hasOwn(row, 'request_id'), false)
  }
  const elapsedMs = practice.createPracticeTimeline('breath-reset', true).durationMs
  assert.equal((await route.POST(req({ clientId: 'own-client', activityType: 'Breathwork', practiceId: 'breath-reset', skipHolds: true, elapsedMs }))).status, 200)
  assert.equal(db.rows.at(-1).duration_minutes, Math.floor(elapsedMs / 60_000))
  assert.equal((await route.POST(req({ clientId: 'own-client', activityType: 'Breathwork', practiceId: 'breath-reset', skipHolds: true, elapsedMs: elapsedMs - 1 }))).status, 400)
})

test('additive migration preserves history and generic logging while enforcing owner/client RLS and idempotency', async () => {
  const pg = new PGlite()
  try {
    await pg.exec(`create role authenticated; create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
      create table public.clients(client_id text primary key,auth_user_id uuid not null references auth.users(id));
      alter table public.clients enable row level security;
      create policy own_clients on public.clients for select to authenticated using(auth_user_id=(select auth.uid()));
      grant select on public.clients to authenticated;
      create table public.recovery_logs(id uuid primary key);
      insert into auth.users values('${owner}'),('${other}');
      insert into public.clients values('own-client','${owner}'),('own-client-2','${owner}'),('other-client','${other}');`)
    await pg.exec(readFileSync('supabase/migrations/20260702_daily_check_in_and_recovery.sql', 'utf8'))
    await pg.query(`insert into recovery_activity_logs(user_id,client_id,activity_type,duration_minutes,log_date) values($1,'own-client','Gentle walk',15,'2026-10-29'),($2,'other-client','Warm soak',20,'2026-10-29')`, [owner, other])
    await pg.exec(readFileSync('supabase/migrations/20261030164252_recovery_activity_details.sql', 'utf8'))
    assert.equal((await pg.query('select count(*)::int as n from recovery_activity_logs')).rows[0].n, 2)
    assert.equal((await pg.query('select count(*)::int as n from recovery_activity_logs where activity_details is null and request_id is null')).rows[0].n, 2)
    await pg.exec(`set role authenticated;set request.jwt.claim.sub='${owner}'`)
    assert.equal((await pg.query('select count(*)::int as n from recovery_activity_logs')).rows[0].n, 1)
    const insert = (user, client, id = null, value = null, minutes = 12) => pg.query(`insert into recovery_activity_logs(user_id,client_id,activity_type,duration_minutes,request_id,activity_details) values($1,$2,'Gentle walk',$3,$4,$5::jsonb)`, [user, client, minutes, id, value && JSON.stringify(value)])
    const value = details.validateDetailedRecovery(walk()).details
    await insert(owner, 'own-client', requestId, value)
    await assert.rejects(insert(owner, 'own-client', requestId, value), /unique constraint/)
    await insert(owner, 'own-client-2', requestId, value)
    await insert(owner, 'own-client')
    await insert(owner, 'own-client')
    await assert.rejects(insert(owner, 'other-client'), /row-level security/)
    await assert.rejects(insert(other, 'other-client'), /row-level security/)
    await assert.rejects(insert(owner, 'own-client', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', {}), /check constraint/)
    await assert.rejects(pg.query(`update recovery_activity_logs set user_id=$1 where request_id=$2`, [other, requestId]), /permission denied/)
    await pg.exec(`set request.jwt.claim.sub='${other}'`)
    assert.equal((await pg.query('select count(*)::int as n from recovery_activity_logs')).rows[0].n, 1)
    await insert(other, 'other-client', requestId, value)
    assert.equal((await pg.query('select count(*)::int as n from recovery_activity_logs')).rows[0].n, 2)
  } finally { await pg.close() }
})
