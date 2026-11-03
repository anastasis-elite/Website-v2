import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { importTs } from './typescriptModule.mjs'

const { validateExportSelection, validateExportRecord } = await importTs('lib/health/appleExport/shared.ts')
const route = await importTs('app/api/health/apple-export/route.ts', {
  'next/server': 'export const NextResponse={json:(body,options)=>Response.json(body,options)}',
  '@/lib/supabase/server': 'export const createClient=async()=>globalThis.appleRepeatedMidnightDb',
})
const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const client = { client_id: 'HAVANA-OWNER', auth_user_id: owner, program: 'ignite', access: true, active: true,
  verified_purchase: true, membership_expires_at: '2099-01-01T00:00:00Z' }
const date = '2026-11-01', timezone = 'America/Havana'
const records = ['2026-11-01T04:30:00.000Z', '2026-11-01T05:30:00.000Z'].map(startAt => ({
  metric: 'heart_rate', value: 72, unit: 'count/min', startAt, endAt: startAt,
  creationAt: '2026-11-01T07:00:00.000Z', sourceName: 'Synthetic repeated-midnight watch', sourceVersion: '1', sourceDevice: 'Synthetic device',
}))
const headers = { origin: 'https://anastasis.test', 'content-type': 'application/json', 'sec-fetch-site': 'same-origin',
  'x-expected-client-id': client.client_id, 'x-expected-user-id': owner }
const post = () => new Request('https://anastasis.test/api/health/apple-export', { method: 'POST', headers,
  body: JSON.stringify({ date, timezone, records }) })
const get = day => new Request('https://anastasis.test/api/health/apple-export?' + new URLSearchParams({ date: day, timezone }), { headers })

test('Havana repeated midnight reload includes both occurrences, leaves the preceding day empty and preserves the original receipt on replay', async t => {
  const db = new PGlite()
  t.after(async () => { delete globalThis.appleRepeatedMidnightDb; await db.close() })
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated,service_role;
    create table public.clients(client_id text primary key,auth_user_id uuid references auth.users(id),program text,access boolean,active boolean,verified_purchase boolean,subscription_ends_at date);
    alter table public.clients enable row level security;
    create policy owned_client on public.clients for select to authenticated using(auth_user_id=auth.uid());
    grant select on public.clients to authenticated;
    insert into auth.users values('${owner}',now());
    insert into public.clients values('${client.client_id}','${owner}','ignite',true,true,true,null);
  `)
  await db.exec(readFileSync('supabase/migrations/20261101145900_membership_exact_expiry.sql', 'utf8'))
  await db.exec("update public.clients set membership_expires_at='2099-01-01T00:00:00Z'")
  const capabilities = readFileSync('supabase/migrations/20261101160000_membership_capabilities.sql', 'utf8')
  await db.exec(capabilities.slice(capabilities.indexOf('create or replace function membership_private.has_capability'), capabilities.indexOf('-- Existing nutrition')))
  await db.exec(readFileSync('docs/sql/apple-health-export-review.sql', 'utf8'))
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [owner])
  await db.exec("set timezone='UTC'; set role authenticated")

  const selection = validateExportSelection(date, timezone)
  assert.equal(selection.startAt, '2026-11-01T04:00:00.000Z', 'The client/API select the first local midnight.')
  assert.ok(records.every(record => validateExportRecord(record, selection)))
  globalThis.appleRepeatedMidnightDb = {
    auth: { getUser: async () => ({ data: { user: { id: owner, email_confirmed_at: '2026-01-01T00:00:00Z' } }, error: null }) },
    from(table) {
      assert.equal(table, 'clients')
      return { select() { return this }, eq(key, value) { assert.equal(key, 'auth_user_id'); assert.equal(value, owner); return this },
        maybeSingle: async () => ({ data: client, error: null }) }
    },
    async rpc(name, args) {
      assert.equal(args.p_client_id, client.client_id)
      const result = name === 'import_health_export_review_batch'
        ? await db.query('select public.import_health_export_review_batch($1,$2::date,$3,$4::jsonb) result', [args.p_client_id,args.p_date,args.p_timezone,JSON.stringify(args.p_records)])
        : await db.query('select public.get_health_export_review_day($1,$2::date,$3,$4) result', [args.p_client_id,args.p_date,args.p_timezone,args.p_offset])
      return { data: result.rows[0].result, error: null }
    },
  }
  const first = await route.POST(post())
  assert.equal(first.status, 200)
  const confirmation = await first.json()
  assert.deepEqual([confirmation.imported, confirmation.alreadyPresent, confirmation.replayed], [2, 0, false])

  const reload = await route.GET(get(date))
  assert.equal(reload.status, 200, 'Actual API validation must accept all SQL day rows.')
  const day = await reload.json()
  assert.equal(day.total, 2)
  assert.deepEqual(day.records.map(record => record.startAt), records.map(record => record.startAt))
  assert.deepEqual(day.counts, { heart_rate: 2, resting_heart_rate: 0 })
  assert.deepEqual(day.receipts, [confirmation.receipt])
  assert.equal(day.nextCursor, null)

  const previous = await route.GET(get('2026-10-31'))
  assert.equal(previous.status, 200, 'The earlier midnight occurrence must not leak into the preceding day and cause a503.')
  const empty = await previous.json()
  assert.equal(empty.total, 0)
  assert.deepEqual(empty.records, [])
  assert.deepEqual(empty.counts, { heart_rate: 0, resting_heart_rate: 0 })
  assert.equal(empty.range, null)
  assert.deepEqual(empty.receipts, [])

  const retry = await route.POST(post())
  assert.equal(retry.status, 200)
  const replay = await retry.json()
  assert.deepEqual([replay.imported, replay.alreadyPresent, replay.replayed], [0, 2, true])
  assert.deepEqual(replay.receipt, confirmation.receipt)
  const after = await route.GET(get(date))
  assert.equal(after.status, 200)
  assert.deepEqual((await after.json()).receipts, day.receipts)
  assert.equal((await db.query('select count(*)::integer n from public.health_export_review_samples')).rows[0].n, 2)
  assert.equal((await db.query('select count(*)::integer n from health_export_private.review_batches')).rows[0].n, 1)
})
