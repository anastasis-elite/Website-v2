import assert from 'node:assert/strict'
import test, { after, mock } from 'node:test'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { importTs } from './typescriptModule.mjs'

// UTC is already October 14 while this Chicago member is still on October 13.
mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-14T04:30:00Z') })
after(() => mock.timers.reset())
const { loadWorkoutHistory, workoutLocalDate } = await importTs('lib/workout/history.ts')
const workout = await importTs('app/api/workout-log/route.ts', {
  'next/server': 'export const NextResponse = { json: (body, init) => Response.json(body, init) }',
  '@/lib/supabase/server': 'export const createClient = async () => globalThis.workoutDateDb',
  '@/lib/dashboard/invalidateDailyPlan': 'export const invalidateDailyPlan = () => {}',
})
const owner = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222'
const client = { client_id: 'QA-DATE-ONLY', auth_user_id: owner, program: 'ember', timezone: 'America/Chicago' }
const legacyId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const walk = id => ({ id, exercise: 'Walking', duration_label: '10 minutes', actual_duration: 10, duration_unit: 'minutes', completed: true, confirmed_at: new Date().toISOString() })
const request = body => new Request('http://synthetic.test/api/workout-log', { method: 'POST', body: JSON.stringify(body) })

async function database({ timestampColumn = true } = {}) {
  const pg = new PGlite()
  await pg.exec(`create role anon;create role authenticated;create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table clients(client_id text primary key,auth_user_id uuid,program text,timezone text,state text,onboarding_data jsonb default '{}');
    create table workout_logs(id uuid primary key default gen_random_uuid(),client_id text,auth_user_id uuid,program text,day_name text,
      workout_source text,workout_date date,${timestampColumn ? 'workout_started_at timestamptz,' : ''}planned_exercises jsonb,exercise_logs jsonb,completed boolean,updated_at timestamptz);
    alter table clients enable row level security;alter table workout_logs enable row level security;
    create policy client_owner on clients to authenticated using(auth_user_id=auth.uid()) with check(auth_user_id=auth.uid());
    create policy workout_owner on workout_logs to authenticated using(auth_user_id=auth.uid()) with check(auth_user_id=auth.uid());
    grant usage on schema public,auth to authenticated;grant execute on function auth.uid() to authenticated;
    grant select,update on clients to authenticated;grant select,insert,update on workout_logs to authenticated;`)
  await pg.query('insert into clients(client_id,auth_user_id,program,timezone) values($1,$2,$3,$4)', [client.client_id, owner, client.program, client.timezone])
  await pg.query('insert into workout_logs(id,client_id,auth_user_id,program,day_name,workout_date,exercise_logs,planned_exercises,completed,updated_at) values($1,$2,$3,$4,$5,$6,$7,$7,true,$8)',
    [legacyId, client.client_id, owner, 'ember', 'Night workout', '2026-10-13', JSON.stringify([walk('legacy-walk')]), '2026-10-13T18:00:00Z'])
  await pg.query("insert into workout_logs(client_id,auth_user_id,program,day_name,workout_date,exercise_logs,completed) values($1,$2,'ember','Night workout','2026-10-12','[]',true),($1,$3,'ember','Night workout','2026-10-13','[]',true)", [client.client_id, owner, other])
  if (timestampColumn) {
    const migration = readFileSync('supabase/migrations/20261014012428_p0_daily_save_foundation.sql', 'utf8')
    const functionSql = migration.match(/create or replace function public\.save_daily_workout[\s\S]*?end \$\$;/)?.[0]
    assert.ok(functionSql)
    await pg.exec(functionSql)
    await pg.exec('revoke all on function save_daily_workout(text,timestamptz,timestamptz,jsonb) from public,anon;grant execute on function save_daily_workout(text,timestamptz,timestamptz,jsonb) to authenticated;')
  }
  await pg.exec(`set role authenticated;set request.jwt.claim.sub='${owner}';`)
  const queries = []
  const db = { auth: { getUser: async () => ({ data: { user: { id: owner } } }) }, from(table) {
    assert.ok(['clients', 'workout_logs'].includes(table))
    const filters = [], orders = []; let size = null
    const q = {
      select() { return q }, eq(key, value) { filters.push([key, '=', value]); return q },
      gte(key, value) { filters.push([key, '>=', value]); return q }, lt(key, value) { filters.push([key, '<', value]); return q },
      order(key, { ascending = true } = {}) { orders.push([key, ascending]); return q }, limit(value) { size = value; return q },
      maybeSingle: async () => resolve(true), then(done, reject) { return resolve().then(done, reject) },
    }
    async function resolve(single = false) {
      for (const [key, , value] of filters) if (key === 'workout_date') assert.match(value, /^\d{4}-\d{2}-\d{2}$/, 'DATE predicates must use civil dates')
      queries.push({ table, filters: structuredClone(filters) })
      const where = filters.length ? ' where ' + filters.map(([key, op], index) => `${key}${op}$${index + 1}`).join(' and ') : ''
      const order = orders.length ? ' order by ' + orders.map(([key, ascending]) => `${key} ${ascending ? 'asc' : 'desc'} nulls last`).join(',') : ''
      try {
        const result = await pg.query(`select * from ${table}${where}${order}${size ? ` limit ${size}` : ''}`, filters.map(([, , value]) => value))
        // PostgREST serializes DATE as a civil-date string; PGlite's driver uses Date.
        const rows = result.rows.map(row => ({ ...row, ...(row.workout_date instanceof Date ? { workout_date: row.workout_date.toISOString().slice(0, 10) } : {}), ...(row.workout_started_at instanceof Date ? { workout_started_at: row.workout_started_at.toISOString() } : {}) }))
        return { data: single ? rows[0] || null : rows, error: null }
      } catch (error) { return { data: null, error: { code: error.code, message: error.message } } }
    }
    return q
  }, async rpc(name, args) {
    assert.equal(name, 'save_daily_workout')
    try {
      const result = await pg.query('select save_daily_workout($1,$2,$3,$4::jsonb) as session', [args.p_client_id, args.p_day_start, args.p_day_end, JSON.stringify(args.p_payload)])
      return { data: result.rows[0].session, error: null }
    } catch (error) { return { data: null, error } }
  } }
  globalThis.workoutDateDb = db
  return { pg, db, queries }
}

test('Chicago legacy DATE progress reloads before the timestamp migration without shifting to yesterday', async t => {
  const { pg, db } = await database({ timestampColumn: false }); t.after(() => pg.close())
  const result = await loadWorkoutHistory({ supabase: db, client, completed: true })
  assert.equal(result.error, null)
  assert.deepEqual(result.data.map(row => row.id), [legacyId])
  assert.equal(workoutLocalDate(result.data[0], client.timezone), '2026-10-13')
  const response = await workout.GET(new Request(`http://synthetic.test/api/workout-log?clientId=${client.client_id}&dayName=Night%20workout`))
  assert.equal(response.status, 200)
  assert.equal((await response.json()).session.id, legacyId)
})

test('Chicago DATE legacy retries reuse the row; new same-day plans preserve separate timestamps and reload by identity', async t => {
  const { pg, db } = await database(); t.after(() => pg.close())
  const payload = logs => ({ client_id: client.client_id, program: 'ember', day_name: 'Night workout', workout_date: new Date().toISOString(), planned_exercises: logs, exercise_logs: logs, completed: true })
  let response = await workout.POST(request(payload([walk('legacy-walk')])))
  assert.equal(response.status, 200)
  assert.equal((await response.json()).session.id, legacyId)
  const legacy = (await pg.query('select * from workout_logs where id=$1', [legacyId])).rows[0]
  assert.equal(legacy.workout_started_at, null, 'No historical timestamp may be invented')
  assert.equal(legacy.workout_date.toISOString().slice(0, 10), '2026-10-13')
  const newPlan = payload([walk('new-walk')])
  response = await workout.POST(request(newPlan))
  assert.equal(response.status, 200)
  const saved = (await response.json()).session
  assert.notEqual(saved.id, legacyId)
  assert.equal(saved.workout_date, '2026-10-13')
  assert.equal(new Date(saved.workout_started_at).toISOString(), '2026-10-14T04:30:00.000Z')
  response = await workout.POST(request(newPlan))
  assert.equal(response.status, 200)
  assert.equal((await response.json()).session.id, saved.id)
  const history = await loadWorkoutHistory({ supabase: db, client })
  assert.deepEqual(new Set(history.data.map(row => row.id)), new Set([legacyId, saved.id]))
  const planKeys = encodeURIComponent(JSON.stringify(['new-walk:0']))
  const reload = await workout.GET(new Request(`http://synthetic.test/api/workout-log?clientId=${client.client_id}&dayName=Night%20workout&planKeys=${planKeys}`))
  assert.equal((await reload.json()).session.id, saved.id)
})

test('new workout timestamps control day membership even when a stored DATE disagrees', async t => {
  const { pg, db } = await database(); t.after(() => pg.close())
  await pg.query("insert into workout_logs(client_id,auth_user_id,program,day_name,workout_date,workout_started_at,exercise_logs,completed) values($1,$2,'ember','Boundary mismatch','2026-10-13','2026-10-13T04:59:59Z','[]',true)", [client.client_id, owner])
  const result = await loadWorkoutHistory({ supabase: db, client })
  assert.equal(result.error, null)
  assert.deepEqual(result.data.map(row => row.id), [legacyId])
  const priorDay = await loadWorkoutHistory({ supabase: db, client, startDate: '2026-10-12' })
  assert.ok(priorDay.data.some(row => row.day_name === 'Boundary mismatch'))
})
