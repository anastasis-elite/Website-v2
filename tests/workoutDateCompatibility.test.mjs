import assert from 'node:assert/strict'
import test, { after, mock } from 'node:test'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { importTs } from './typescriptModule.mjs'

// UTC is already October 14 while this Chicago member is still on October 13.
mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-14T04:30:00Z') })
after(() => mock.timers.reset())
const { loadWorkoutHistory, workoutLocalDate } = await importTs('lib/workout/history.ts')
const { generatedWorkoutCompletionEvidence } = await importTs('lib/workout/occurrenceCompletion.ts')
const { workoutRecordComplete } = await importTs('lib/workout/activity.ts')
const { dailyPlanToScheduleEvents } = await importTs('lib/schedule/dailyPlanAdapter.ts')
const { buildTodayDaySections } = await importTs('lib/dashboard/todayDaySections.ts')
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

async function database({ timestampColumn = true, originRule = false, programOutputs } = {}) {
  const pg = new PGlite()
  await pg.exec(`create role anon;create role authenticated;create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table clients(client_id text primary key,auth_user_id uuid,program text,timezone text,access boolean,active boolean default true,state text,onboarding_data jsonb default '{}');
    create table workout_logs(id uuid primary key default gen_random_uuid(),client_id text,auth_user_id uuid,program text,day_name text,
      workout_source text,workout_date date,${timestampColumn ? 'workout_started_at timestamptz,' : ''}planned_exercises jsonb,exercise_logs jsonb,completed boolean,updated_at timestamptz);
    alter table clients enable row level security;alter table workout_logs enable row level security;
    create policy client_owner on clients to authenticated using(auth_user_id=auth.uid()) with check(auth_user_id=auth.uid());
    create policy workout_owner on workout_logs to authenticated using(auth_user_id=auth.uid()) with check(auth_user_id=auth.uid());
    -- Keep ownership and active-member restrictions separate, as in the live
    -- restrictive ownership/capability policies. This fixture needs only these
    -- access flags, not unrelated billing and membership tables.
    create policy workout_member on workout_logs as restrictive for all to authenticated
      using(exists(select 1 from clients c where c.client_id=workout_logs.client_id and c.auth_user_id=auth.uid()
        and c.program=workout_logs.program and c.access is true and c.active is not false))
      with check(exists(select 1 from clients c where c.client_id=workout_logs.client_id and c.auth_user_id=auth.uid()
        and c.program=workout_logs.program and c.access is true and c.active is not false));
    grant usage on schema public,auth to authenticated;grant execute on function auth.uid() to authenticated;
    grant select,update on clients to authenticated;grant select,insert,update on workout_logs to authenticated;`)
  await pg.query('insert into clients(client_id,auth_user_id,program,timezone,access) values($1,$2,$3,$4,true)', [client.client_id, owner, client.program, client.timezone])
  await pg.query('insert into workout_logs(id,client_id,auth_user_id,program,day_name,workout_date,exercise_logs,planned_exercises,completed,updated_at) values($1,$2,$3,$4,$5,$6,$7,$7,true,$8)',
    [legacyId, client.client_id, owner, 'ember', 'Night workout', '2026-10-13', JSON.stringify([walk('legacy-walk')]), '2026-10-13T18:00:00Z'])
  await pg.query("insert into workout_logs(client_id,auth_user_id,program,day_name,workout_date,exercise_logs,completed) values($1,$2,'ember','Night workout','2026-10-12','[]',true),($1,$3,'ember','Night workout','2026-10-13','[]',true)", [client.client_id, owner, other])
  if (programOutputs) {
    await pg.exec(`create table program_outputs(id uuid primary key,client_id text,auth_user_id uuid,program text,program_json jsonb,generated_at timestamptz);
      alter table program_outputs enable row level security;
      alter table program_outputs force row level security;
      create policy program_owner on program_outputs for select to authenticated using(
        (auth_user_id is null or auth_user_id=auth.uid()) and exists(select 1 from clients c
          where c.client_id=program_outputs.client_id and c.auth_user_id=auth.uid() and c.program=program_outputs.program));
      grant select on program_outputs to authenticated;`)
    for (const source of programOutputs) await pg.query('insert into program_outputs values($1,$2,$3,$4,$5,$6)', [source.id, source.client_id, source.auth_user_id, source.program, JSON.stringify(source.program_json), source.generated_at])
  }
  if (timestampColumn) {
    const migration = readFileSync('supabase/migrations/20261014012428_p0_daily_save_foundation.sql', 'utf8')
    const functionSql = migration.match(/create or replace function public\.save_daily_workout[\s\S]*?end \$\$;/)?.[0]
    assert.ok(functionSql)
    await pg.exec(functionSql)
    await pg.exec('revoke all on function save_daily_workout(text,timestamptz,timestamptz,jsonb) from public,anon;grant execute on function save_daily_workout(text,timestamptz,timestamptz,jsonb) to authenticated;')
  }
  if (originRule) await pg.exec(readFileSync('supabase/migrations/20261111120750_workout_origin_classification.sql', 'utf8'))
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

test('new-row classification survives the actual SQL save RPC without backfilling genuine legacy history', async t => {
  const { pg, db } = await database(); t.after(() => pg.close())
  await pg.exec('reset role')
  const before = (await pg.query('select to_jsonb(w) as saved from workout_logs w order by id')).rows.map(row => row.saved)
  await pg.exec(readFileSync('supabase/migrations/20261111120750_workout_origin_classification.sql', 'utf8'))
  const after = (await pg.query("select to_jsonb(w)-'generated_origin_version'-'generated_origin_transition' as saved,generated_origin_version from workout_logs w order by id")).rows
  assert.deepEqual(after.map(row => row.saved), before)
  assert.ok(after.every(row => row.generated_origin_version === null), 'existing rows are not reclassified or rewritten')
  await pg.exec(`set role authenticated;set request.jwt.claim.sub='${owner}';`)
  const plan = [walk('new-unverified-walk')]
  const body = { client_id: client.client_id, program: client.program, day_name: 'Night workout', workout_source: 'recommended',
    workout_date: new Date().toISOString(), planned_exercises: plan, exercise_logs: plan, completed: true }
  let response = await workout.POST(request(body))
  assert.equal(response.status, 200, await response.clone().text())
  let saved = (await response.json()).session
  assert.equal(saved.generated_origin_version, 1)
  assert.equal(workoutRecordComplete(saved), true)
  const evidence = history => generatedWorkoutCompletionEvidence({ userId: owner, client, date: '2026-10-13',
    plannedWorkout: { day_name: 'Night workout', exercises: plan }, plannedExercises: plan, history })
  assert.equal(evidence([saved]).sessionId, null)
  // The existing SQL function updates only its explicit columns. Omitting JSON
  // markers or submitting a fake NULL version cannot turn this row into legacy.
  const retried = await db.rpc('save_daily_workout', { p_client_id: client.client_id,
    p_day_start: '2026-10-13T05:00:00Z', p_day_end: '2026-10-14T05:00:00Z',
    p_payload: { ...body, auth_user_id: owner, workout_local_date: '2026-10-13', generated_origin_version: null } })
  assert.equal(retried.error, null)
  saved = retried.data
  assert.equal(saved.generated_origin_version, 1)
  assert.equal(saved.planned_exercises[0].generated_workout_origin_status, undefined)
  assert.equal(workoutRecordComplete(saved), true)
  const history = await loadWorkoutHistory({ supabase: db, client, authUserId: owner, startDate: '2026-10-13' })
  assert.equal(evidence(history.data).sessionId, null, 'history must not infer unsigned new rows are legacy')
  response = await workout.POST(request(body))
  assert.equal(response.status, 200)
  saved = (await response.json()).session
  assert.equal(saved.generated_origin_version, 1)
  assert.equal(saved.planned_exercises[0].generated_workout_origin_status, 'unsigned')
  const legacyPlan = [walk('legacy-walk')]
  response = await workout.POST(request({ ...body, planned_exercises: legacyPlan, exercise_logs: legacyPlan }))
  assert.equal(response.status, 200)
  const legacy = (await response.json()).session
  assert.equal(legacy.id, legacyId)
  assert.equal(legacy.generated_origin_version, null)
  assert.equal(legacy.planned_exercises[0].generated_workout_origin_status, undefined)
  const legacyEvidence = generatedWorkoutCompletionEvidence({ userId: owner, client, date: '2026-10-13',
    plannedWorkout: { day_name: 'Night workout', exercises: legacyPlan }, plannedExercises: legacyPlan, history: [legacy] })
  assert.equal(legacyEvidence.sessionId, legacyId)
})

test('authenticated direct inserts and updates cannot manufacture legacy status or regain fallback after JSON removal', async t => {
  const { pg } = await database({ originRule: true }); t.after(() => pg.close())
  const grants = (await pg.query("select current_user as actor,has_table_privilege(current_user,'public.workout_logs','INSERT') as can_insert,has_table_privilege(current_user,'public.workout_logs','UPDATE') as can_update")).rows[0]
  assert.equal(grants.actor, 'authenticated'); assert.equal(grants.can_insert, true); assert.equal(grants.can_update, true)
  const plan = [walk('direct-owned-occurrence')]
  const marked = [{ ...plan[0], generated_workout_origin_status: 'unverified' }]
  for (const value of ['default', null, 0, 9]) {
    const columns = value === 'default' ? '' : ',generated_origin_version'
    const placeholder = value === 'default' ? '' : ',$8'
    const args = [client.client_id, owner, client.program, `Direct ${value}`, '2026-10-13', new Date().toISOString(), JSON.stringify(marked)]
    if (value !== 'default') args.push(value)
    let row = (await pg.query(`insert into workout_logs(client_id,auth_user_id,program,day_name,workout_source,workout_date,workout_started_at,planned_exercises,exercise_logs,completed${columns})
      values($1,$2,$3,$4,'recommended',$5,$6,$7,$7,true${placeholder}) returning *`, args)).rows[0]
    assert.equal(row.generated_origin_version, 1, `INSERT ${value} is nonlegacy`)
    for (const attempted of [null, 0, 9]) {
      row = (await pg.query('update workout_logs set generated_origin_version=$2,planned_exercises=$3,exercise_logs=$3 where id=$1 returning *',
        [row.id, attempted, JSON.stringify(plan)])).rows[0]
      assert.equal(row.generated_origin_version, 1, `UPDATE ${attempted} preserves the stored class`)
      assert.equal(row.planned_exercises[0].generated_workout_origin_status, undefined)
      assert.equal(workoutRecordComplete(row), true)
      const evidence = generatedWorkoutCompletionEvidence({ userId: owner, client, date: '2026-10-13',
        plannedWorkout: { day_name: row.day_name, exercises: plan }, plannedExercises: plan, history: [row] })
      assert.equal(evidence.sessionId, null, 'a direct JSON rewrite must not restore unsigned legacy completion')
    }
    const upserted = (await pg.query(`insert into workout_logs(id,client_id,auth_user_id,program,day_name,workout_source,workout_date,planned_exercises,exercise_logs,completed,generated_origin_version)
      values($1,$2,$3,$4,$5,'recommended',$6,$7,$7,true,null)
      on conflict(id) do update set generated_origin_version=excluded.generated_origin_version,planned_exercises=excluded.planned_exercises returning *`,
    [row.id, client.client_id, owner, client.program, row.day_name, '2026-10-13', JSON.stringify(plan)])).rows[0]
    assert.equal(upserted.generated_origin_version, 1)
  }
})

test('preexisting legacy updates and upserts remain NULL while repeated migration installation leaves every row and grant unchanged', async t => {
  const { pg } = await database({ originRule: true }); t.after(() => pg.close())
  const original = (await pg.query('select * from workout_logs where id=$1', [legacyId])).rows[0]
  assert.equal(original.generated_origin_version, null)
  let legacy = (await pg.query('update workout_logs set generated_origin_version=1,completed=completed where id=$1 returning *', [legacyId])).rows[0]
  assert.equal(legacy.generated_origin_version, null, 'preexisting legacy identity is preserved even if a caller requests reclassification')
  assert.deepEqual(legacy, original)
  legacy = (await pg.query(`insert into workout_logs(id,client_id,auth_user_id,program,day_name,workout_source,workout_date,planned_exercises,exercise_logs,completed,generated_origin_version)
    values($1,$2,$3,$4,$5,'recommended',$6,$7,$7,true,1)
    on conflict(id) do update set generated_origin_version=excluded.generated_origin_version returning *`,
  [legacyId, client.client_id, owner, client.program, original.day_name, '2026-10-13', JSON.stringify(original.planned_exercises)])).rows[0]
  assert.equal(legacy.generated_origin_version, null)
  // Match PostgREST's DATE serialization used by the real history reader; the
  // disposable SQL driver's raw DATE object is UTC midnight, not a saved time.
  const legacyRead = { ...legacy, workout_date: legacy.workout_date instanceof Date ? legacy.workout_date.toISOString().slice(0, 10) : legacy.workout_date }
  const evidence = generatedWorkoutCompletionEvidence({ userId: owner, client, date: '2026-10-13',
    plannedWorkout: { day_name: legacy.day_name, exercises: legacy.planned_exercises }, plannedExercises: legacy.planned_exercises, history: [legacyRead] })
  assert.equal(evidence.sessionId, legacyId)
  const classified = (await pg.query(`insert into workout_logs(client_id,auth_user_id,program,day_name,workout_source,workout_date,planned_exercises,exercise_logs,completed,generated_origin_version)
    values($1,$2,$3,'Repeat classified','recommended','2026-10-13',$4,$4,true,null) returning id,generated_origin_version`,
  [client.client_id, owner, client.program, JSON.stringify(original.planned_exercises)])).rows[0]
  assert.equal(classified.generated_origin_version, 1)
  await pg.exec('reset role')
  const before = (await pg.query('select to_jsonb(w) as saved from workout_logs w order by id')).rows
  const grants = (await pg.query("select has_table_privilege('authenticated','public.workout_logs','INSERT') as can_insert,has_table_privilege('authenticated','public.workout_logs','UPDATE') as can_update")).rows
  const migration = readFileSync('supabase/migrations/20261111120750_workout_origin_classification.sql', 'utf8')
  await pg.exec(migration)
  await pg.exec(migration)
  assert.deepEqual((await pg.query('select to_jsonb(w) as saved from workout_logs w order by id')).rows, before)
  assert.deepEqual((await pg.query("select has_table_privilege('authenticated','public.workout_logs','INSERT') as can_insert,has_table_privilege('authenticated','public.workout_logs','UPDATE') as can_update")).rows, grants)
  const guard = (await pg.query("select count(*)::int as guards,bool_and(not p.prosecdef) as invoker from pg_trigger t join pg_proc p on p.oid=t.tgfoid where t.tgrelid='public.workout_logs'::regclass and t.tgname='workout_origin_version_guard' and not t.tgisinternal")).rows[0]
  assert.equal(guard.guards, 1); assert.equal(guard.invoker, true)
  await pg.exec(`set role authenticated;set request.jwt.claim.sub='${owner}';`)
  assert.equal((await pg.query('select generated_origin_version from workout_logs where id=$1', [legacyId])).rows[0].generated_origin_version, null)
  assert.equal((await pg.query('select generated_origin_version from workout_logs where id=$1', [classified.id])).rows[0].generated_origin_version, 1)
})

test('classification guard does not bypass existing ownership or active-membership RLS', async t => {
  const { pg } = await database({ originRule: true }); t.after(() => pg.close())
  const insert = actor => pg.query(`insert into workout_logs(client_id,auth_user_id,program,day_name,workout_source,workout_date,planned_exercises,exercise_logs,generated_origin_version)
    values($1,$2,$3,'RLS check','recommended','2026-10-13','[]','[]',null) returning id`, [client.client_id, actor, client.program])
  await assert.rejects(() => insert(other), error => error.code === '42501')
  const foreignUpdate = await pg.query('update workout_logs set generated_origin_version=null where auth_user_id=$1 returning id', [other])
  assert.equal(foreignUpdate.rows.length, 0)
  await pg.query('update clients set active=false where client_id=$1', [client.client_id])
  await assert.rejects(() => insert(owner), error => error.code === '42501')
  assert.equal((await pg.query('update workout_logs set generated_origin_version=null where id=$1 returning id', [legacyId])).rows.length, 0)
  await pg.query('update clients set active=true where client_id=$1', [client.client_id])
  const inserted = await insert(owner)
  assert.equal((await pg.query('select generated_origin_version from workout_logs where id=$1', [inserted.rows[0].id])).rows[0].generated_origin_version, 1)
  assert.equal((await pg.query("select relrowsecurity from pg_class where oid='public.workout_logs'::regclass")).rows[0].relrowsecurity, true)
})

const transitionDate = '2026-10-13'
const transitionDay = { day_name: 'Tuesday', day_intent: 'training', exercises: [
  { id: 'transition-squat', session_key: 'transition-squat:0', exercise: 'Squat', exercise_category: 'strength', sets: 4, reps: 8 },
] }
const transitionSource = (patch = {}) => ({ id: '33333333-3333-4333-8333-333333333333', client_id: client.client_id,
  auth_user_id: owner, program: client.program, program_json: { days: [structuredClone(transitionDay)] },
  generated_at: '2026-10-14T03:00:00Z', ...patch })
const transitionLogs = (plan = transitionDay.exercises, count = 2) => plan.map(exercise => ({ ...exercise, completed: false,
  set_logs: Array.from({ length: count }, (_, index) => ({ id: `transition-set-${index}`, set_number: index + 1,
    reps: 8, weight: 20, weight_unit: 'lb', completed_at: new Date().toISOString() })) }))
const transitionBody = (patch = {}) => ({ client_id: client.client_id, auth_user_id: owner, program: client.program,
  day_name: transitionDay.day_name, workout_source: 'recommended', workout_date: new Date().toISOString(), workout_local_date: transitionDate,
  planned_exercises: structuredClone(transitionDay.exercises), exercise_logs: transitionLogs(), completed: true, ...patch })
const transitionEvidence = (history, patch = {}) => generatedWorkoutCompletionEvidence({ userId: owner, client, date: transitionDate,
  plannedWorkout: transitionDay, plannedExercises: transitionDay.exercises, history, ...patch })
const transitionRpc = (db, body) => db.rpc('save_daily_workout', { p_client_id: client.client_id,
  p_day_start: '2026-10-13T05:00:00Z', p_day_end: '2026-10-14T05:00:00Z', p_payload: body })

test('old open-session SQL save across migration is linked by its immutable saved-source receipt and survives new API resume', async t => {
  const source = transitionSource(), { pg, db } = await database({ originRule: true, programOutputs: [source] })
  t.after(() => pg.close())
  const beforeSource = (await pg.query('select to_jsonb(p) as saved from program_outputs p')).rows
  // This is the production RPC used by the pre-rollout application, without
  // any token, origin status or knowledge of the new receipt column.
  const result = await transitionRpc(db, transitionBody())
  assert.equal(result.error, null)
  let saved = result.data
  assert.equal(saved.generated_origin_version, 1)
  assert.equal(workoutRecordComplete(saved), true)
  assert.equal(saved.planned_exercises[0].generated_workout_origin, undefined)
  const receipt = structuredClone(saved.generated_origin_transition)
  assert.ok(receipt, 'the migration captures source evidence before app rollout')
  assert.equal(receipt.source_output_id, source.id)
  assert.equal(receipt.local_date, transitionDate)
  assert.equal(receipt.timezone, client.timezone)
  let history = await loadWorkoutHistory({ supabase: db, client, authUserId: owner, startDate: transitionDate })
  const confirmed = transitionEvidence(history.data)
  assert.equal(confirmed.sessionId, saved.id)
  const generated = dailyPlanToScheduleEvents({ userId: owner, client, workoutCompletion: confirmed,
    dailyPlan: { date: transitionDate, timezone: client.timezone, timing: { workoutTime: '08:00' } } })
    .find(event => event.id === `virtual-workout-${transitionDate}`)
  assert.equal(generated.status, 'completed')
  const separate = { ...generated, id: 'separate-saved-evening-class', source: 'external_calendar', calendar_event_id: 'separate-calendar-class',
    virtual: false, title: 'Separate evening class', status: 'scheduled', completed_at: null,
    start_at: '2026-10-13T23:00:00Z', end_at: '2026-10-14T00:00:00Z' }
  const logic = { program: client.program, client: { id: client.client_id }, assessments: {}, symptoms: { redFlag: false },
    execution: { workoutComplete: true, generatedWorkoutCompletion: confirmed }, workoutDecision: { canTrain: true } }
  const projected = buildTodayDaySections(logic, { date: transitionDate, timezone: client.timezone, now: new Date().toISOString(), events: [generated, separate] }, [])
  const cards = [...projected.sections.flatMap(section => section.items), ...projected.untimed]
  assert.equal(cards.some(item => item.eventId === generated.id), false)
  assert.ok(cards.some(item => item.eventId === separate.id), 'transition completion does not hide a separate workout')
  for (const date of ['2026-10-12', '2026-10-14', '2026-10-20']) assert.equal(transitionEvidence(history.data, { date }).sessionId, null)
  const response = await workout.POST(request(transitionBody({ generated_origin_transition: { source_output_id: 'caller-claim' } })))
  assert.equal(response.status, 200, await response.clone().text())
  saved = (await response.json()).session
  assert.equal(saved.id, result.data.id)
  assert.deepEqual(saved.generated_origin_transition, receipt)
  assert.equal(saved.generated_origin_version, 1, 'transition evidence never restores legacy authority')
  history = await loadWorkoutHistory({ supabase: db, client, authUserId: owner, startDate: transitionDate })
  assert.equal(transitionEvidence(history.data).sessionId, saved.id)
  assert.deepEqual((await pg.query('select to_jsonb(p) as saved from program_outputs p')).rows, beforeSource)
  const legacy = (await pg.query('select generated_origin_version,generated_origin_transition from workout_logs where id=$1', [legacyId])).rows[0]
  assert.equal(legacy.generated_origin_version, null); assert.equal(legacy.generated_origin_transition, null)
})

test('cached unsigned posts after app rollout link only a complete source prescription while altered dose and adapted sessions still save unconfirmed', async t => {
  for (const kind of ['exact', 'altered-dose', 'adapted-title', 'rejected-token', 'prior-day-actuals', 'prior-week-actuals']) {
    const { pg, db } = await database({ originRule: true, programOutputs: [transitionSource()] })
    t.after(() => pg.close())
    let plan = structuredClone(transitionDay.exercises), title = transitionDay.day_name
    if (kind === 'altered-dose') plan[0].sets = 1
    if (kind === 'adapted-title') { plan[0].sets = 2; title = 'Low-Capacity Strength Workout' }
    if (kind === 'rejected-token') plan[0].generated_workout_origin = 'gwo1.invalid.retained-token'
    const count = kind === 'altered-dose' ? 1 : 2
    const logs = transitionLogs(plan, count)
    if (kind === 'prior-day-actuals' || kind === 'prior-week-actuals') {
      for (const log of logs) for (const set of log.set_logs) set.completed_at = kind === 'prior-day-actuals' ? '2026-10-13T04:30:00Z' : '2026-10-07T04:30:00Z'
    }
    const response = await workout.POST(request(transitionBody({ day_name: title, planned_exercises: plan,
      exercise_logs: logs })))
    assert.equal(response.status, 200, await response.clone().text())
    const saved = (await response.json()).session
    assert.equal(workoutRecordComplete(saved), true, 'real work continues to save using the existing threshold')
    assert.equal(saved.generated_origin_version, 1)
    const history = await loadWorkoutHistory({ supabase: db, client, authUserId: owner, startDate: transitionDate })
    assert.equal(transitionEvidence(history.data).sessionId, kind === 'exact' ? saved.id : null, kind)
    if (kind === 'exact') assert.equal(saved.planned_exercises[0].generated_workout_origin_status, 'unsigned')
    if (kind === 'rejected-token') {
      assert.equal(saved.planned_exercises[0].generated_workout_origin_status, 'unverified')
      assert.equal(saved.generated_origin_transition, null, 'known rejection is not an unsigned transition')
    }
  }
})

test('transition uses the prescribed strength sets after conflicting mobility details and preserves same-day half-set completion through resume', async t => {
  const { pg, db } = await database({ originRule: true, programOutputs: [transitionSource()] })
  t.after(() => pg.close())
  const previousWeek = '2026-10-07T04:30:00Z'
  const oldLogs = transitionLogs()
  for (const log of oldLogs) for (const set of log.set_logs) set.completed_at = previousWeek
  const firstSave = await transitionRpc(db, transitionBody({ exercise_logs: oldLogs }))
  assert.equal(firstSave.error, null)
  const receipt = structuredClone(firstSave.data.generated_origin_transition)
  assert.ok(receipt)
  assert.equal(workoutRecordComplete(firstSave.data), true, 'the existing two-of-four-set threshold still counts the actual work')
  assert.equal(transitionEvidence([firstSave.data]).sessionId, null)
  const conflictingLogs = oldLogs.map(log => ({ ...log, exercise_category: 'mobility', completed: true,
    activity_completed: true, confirmed_at: new Date().toISOString() }))
  const cardsFor = evidence => {
    const generated = dailyPlanToScheduleEvents({ userId: owner, client, workoutCompletion: evidence,
      dailyPlan: { date: transitionDate, timezone: client.timezone, timing: { workoutTime: '08:00' } } })
      .find(event => event.id === `virtual-workout-${transitionDate}`)
    const logic = { program: client.program, client: { id: client.client_id }, assessments: {}, symptoms: { redFlag: false },
      execution: { workoutComplete: true, generatedWorkoutCompletion: evidence }, workoutDecision: { canTrain: true } }
    const projected = buildTodayDaySections(logic, { date: transitionDate, timezone: client.timezone,
      now: new Date().toISOString(), events: [generated] }, [])
    return [...projected.sections.flatMap(section => section.items), ...projected.untimed]
  }
  let response = await workout.POST(request(transitionBody({ exercise_logs: conflictingLogs })))
  assert.equal(response.status, 200, await response.clone().text())
  let saved = (await response.json()).session
  assert.equal(saved.id, firstSave.data.id)
  assert.deepEqual(saved.generated_origin_transition, receipt)
  assert.equal(saved.planned_exercises[0].exercise_category, 'strength')
  assert.equal(saved.planned_exercises[0].sets, 4)
  assert.deepEqual(saved.exercise_logs[0].set_logs, oldLogs[0].set_logs)
  assert.equal(workoutRecordComplete(saved), true, 'changing log-only category cannot change the established half-set definition')
  let history = await loadWorkoutHistory({ supabase: db, client, authUserId: owner, startDate: transitionDate })
  let evidence = transitionEvidence(history.data)
  assert.equal(evidence.sessionId, null, 'current mobility confirmation cannot replace the prior-week strength evidence that completed the prescription')
  assert.ok(cardsFor(evidence).some(item => item.eventId === `virtual-workout-${transitionDate}`))
  const reload = await workout.GET(new Request(`http://synthetic.test/api/workout-log?clientId=${client.client_id}&dayName=Tuesday&planKeys=${encodeURIComponent(JSON.stringify(['transition-squat:0']))}`))
  assert.equal(reload.status, 200)
  const resumed = (await reload.json()).session
  response = await workout.POST(request(transitionBody({ planned_exercises: resumed.planned_exercises, exercise_logs: resumed.exercise_logs })))
  assert.equal(response.status, 200, await response.clone().text())
  saved = (await response.json()).session
  assert.deepEqual(saved.generated_origin_transition, receipt)
  assert.equal(transitionEvidence([saved]).sessionId, null, 'resaving the conflicting recorded work cannot manufacture current-day evidence')
  const sameDayLogs = conflictingLogs.map(log => ({ ...log, set_logs: log.set_logs.map(set => ({ ...set, completed_at: new Date().toISOString() })) }))
  response = await workout.POST(request(transitionBody({ exercise_logs: sameDayLogs })))
  assert.equal(response.status, 200, await response.clone().text())
  saved = (await response.json()).session
  assert.deepEqual(saved.generated_origin_transition, receipt)
  assert.equal(workoutRecordComplete(saved), true)
  history = await loadWorkoutHistory({ supabase: db, client, authUserId: owner, startDate: transitionDate })
  evidence = transitionEvidence(history.data)
  assert.equal(evidence.sessionId, saved.id, 'legitimate same-day two-of-four strength sets still confirm the generated occurrence')
  assert.equal(cardsFor(evidence).some(item => item.eventId === `virtual-workout-${transitionDate}`), false)
})

test('transition follows the evidence counted for non-strength prescriptions when a log has conflicting strength details', async t => {
  const activityDay = { ...transitionDay, exercises: [
    { id: 'transition-mobility', session_key: 'transition-mobility:0', exercise: 'Cat Cow', exercise_category: 'mobility', sets: 1 },
  ] }
  const { pg, db } = await database({ originRule: true, programOutputs: [transitionSource({ program_json: { days: [activityDay] } })] })
  t.after(() => pg.close())
  const mobility = { ...activityDay.exercises[0], completed: true, activity_completed: true, confirmed_at: new Date().toISOString(), set_logs: [] }
  let receipt, savedId
  for (const kind of ['ordinary-mobility', 'prior-week-strength', 'same-day-strength']) {
    const log = kind === 'ordinary-mobility' ? mobility : { ...mobility, exercise_category: 'strength',
      confirmed_at: kind === 'same-day-strength' ? '2026-10-07T04:30:00Z' : new Date().toISOString(),
      set_logs: [{ id: 'mixed-direction-set', set_number: 1, reps: 8, weight: 20, weight_unit: 'lb',
        completed_at: kind === 'prior-week-strength' ? '2026-10-07T04:30:00Z' : new Date().toISOString() }] }
    const response = await workout.POST(request(transitionBody({ planned_exercises: activityDay.exercises, exercise_logs: [log] })))
    assert.equal(response.status, 200, await response.clone().text())
    const saved = (await response.json()).session
    receipt ??= structuredClone(saved.generated_origin_transition)
    savedId ??= saved.id
    assert.ok(receipt)
    assert.equal(saved.id, savedId)
    assert.deepEqual(saved.generated_origin_transition, receipt)
    assert.equal(workoutRecordComplete(saved), true, `existing completion semantics remain unchanged for ${kind}`)
    const history = await loadWorkoutHistory({ supabase: db, client, authUserId: owner, startDate: transitionDate })
    const evidence = transitionEvidence(history.data, { plannedWorkout: activityDay, plannedExercises: activityDay.exercises })
    assert.equal(evidence.sessionId, kind === 'prior-week-strength' ? null : saved.id, kind)
  }
})

test('direct callers cannot forge or refresh a transition receipt by changing saved prescription or JSON metadata', async t => {
  const source = transitionSource(), { pg, db } = await database({ originRule: true, programOutputs: [source] })
  t.after(() => pg.close())
  const body = transitionBody()
  let saved = (await pg.query(`insert into workout_logs(client_id,auth_user_id,program,day_name,workout_source,workout_date,workout_started_at,
    planned_exercises,exercise_logs,completed,generated_origin_version,generated_origin_transition)
    values($1,$2,$3,$4,'recommended',$5,$6,$7,$8,true,null,$9) returning *`,
  [client.client_id, owner, client.program, body.day_name, transitionDate, body.workout_date, JSON.stringify(body.planned_exercises),
    JSON.stringify(body.exercise_logs), JSON.stringify({ source_output_id: 'forged-source', local_date: '2026-10-20' })])).rows[0]
  assert.equal(saved.generated_origin_version, 1)
  const receipt = structuredClone(saved.generated_origin_transition)
  assert.equal(receipt.source_output_id, source.id)
  assert.equal(receipt.local_date, transitionDate)
  const changedPlan = [{ ...transitionDay.exercises[0], sets: 1 }]
  saved = (await pg.query(`update workout_logs set generated_origin_version=null,generated_origin_transition=$2,
    planned_exercises=$3,exercise_logs=$4,completed=true where id=$1 returning *`,
  [saved.id, JSON.stringify({ ...receipt, submitted_prescription: changedPlan }), JSON.stringify(changedPlan), JSON.stringify(transitionLogs(changedPlan, 1))])).rows[0]
  assert.equal(saved.generated_origin_version, 1)
  assert.deepEqual(saved.generated_origin_transition, receipt)
  assert.equal(workoutRecordComplete(saved), true)
  const history = await loadWorkoutHistory({ supabase: db, client, authUserId: owner, startDate: transitionDate })
  assert.equal(transitionEvidence(history.data).sessionId, null, 'the changed dose no longer matches the first saved snapshot')
})

test('missing or changed source evidence is not repaired by later saves or by searching an older convenient program', async t => {
  for (const kind of ['missing-at-save', 'latest-mismatch', 'latest-later-than-start']) {
    const newer = transitionSource({ id: '44444444-4444-4444-8444-444444444444', generated_at: kind === 'latest-later-than-start' ? '2026-10-14T04:31:00Z' : '2026-10-14T03:30:00Z',
      program_json: { days: [{ ...transitionDay, exercises: [{ ...transitionDay.exercises[0], sets: 8 }] }] } })
    const initialSources = kind === 'missing-at-save' ? [] : [transitionSource(), newer]
    const { pg, db } = await database({ originRule: true, programOutputs: initialSources })
    t.after(() => pg.close())
    const result = await transitionRpc(db, transitionBody())
    assert.equal(result.error, null)
    const receipt = structuredClone(result.data.generated_origin_transition)
    if (kind === 'missing-at-save') {
      assert.equal(receipt, null)
      await pg.exec('reset role')
      const source = transitionSource()
      await pg.query('insert into program_outputs values($1,$2,$3,$4,$5,$6)', [source.id, source.client_id, source.auth_user_id,
        source.program, JSON.stringify(source.program_json), source.generated_at])
      await pg.exec(`set role authenticated;set request.jwt.claim.sub='${owner}';`)
    } else if (kind === 'latest-later-than-start') assert.equal(receipt, null, 'a later source must not cause fallback to an older convenient output')
    else if (receipt) assert.equal(receipt.source_output_id, newer.id)
    const response = await workout.POST(request(transitionBody()))
    assert.equal(response.status, 200, await response.clone().text())
    const saved = (await response.json()).session
    assert.equal(saved.id, result.data.id)
    assert.deepEqual(saved.generated_origin_transition, receipt, 'UPDATE cannot mint a retrospective receipt')
    const history = await loadWorkoutHistory({ supabase: db, client, authUserId: owner, startDate: transitionDate })
    assert.equal(transitionEvidence(history.data).sessionId, null)
  }
})
