import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { importTs } from './typescriptModule.mjs'

const cardio = await importTs('lib/workout/manualCardio.ts')
const activity = await importTs('lib/workout/activity.ts')
const session = await importTs('lib/workout/session.ts')
const owner = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'
const occurrence = '33333333-3333-4333-8333-333333333333'
const exercise = (id = 'walking', unit = 'minutes') => cardio.createManualCardioExercise(id, unit, occurrence)
const initialized = (id = 'walking', unit = 'minutes') => session.initialWorkoutLogs([exercise(id, unit)])[0]
const confirmed = (id = 'walking', unit = 'minutes', duration = 10) => ({ ...initialized(id, unit), completed: true,
  actual_duration: duration, confirmed_at: new Date().toISOString() })
const route = await importTs('app/api/workout-log/route.ts', {
  'next/server': 'export const NextResponse = { json: (body, init) => Response.json(body, init) }',
  '@/lib/supabase/server': 'export const createClient = async () => globalThis.manualCardioDb',
  '@/lib/dashboard/invalidateDailyPlan': 'export const invalidateDailyPlan = () => {}',
  '@/lib/analytics/server': 'export const recordConversion = async () => false',
})

function fixture(tier = 'tracker') {
  const client = { client_id: 'CARDIO-OWNER', auth_user_id: owner, program: tier, timezone: 'Etc/UTC',
    access: true, active: true, verified_purchase: true, membership_expires_at: '2035-01-01T12:34:56Z' }
  const state = { user: { id: owner }, rows: [], writes: 0, fail: false }
  globalThis.manualCardioDb = {
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    from(table) {
      const filters = []
      const query = { select() { return query }, eq(key, value) { filters.push(row => row[key] === value);return query },
        gte(key, value) { filters.push(row => row[key] >= value);return query }, lt(key, value) { filters.push(row => row[key] < value);return query },
        order() { return query }, limit() { return query },
        maybeSingle: async () => ({ data: filters.every(filter => filter(client)) ? client : null, error: null }),
        then(done) { assert.equal(table, 'workout_logs');return Promise.resolve({ data: state.rows.filter(row => filters.every(filter => filter(row))), error: null }).then(done) },
      }
      return query
    },
    async rpc(name, args) {
      assert.equal(name, 'save_daily_workout')
      if (state.fail) return { data: null, error: new Error('Synthetic save failed.') }
      state.writes++
      const payload = structuredClone(args.p_payload), keys = session.workoutSessionKeys(payload.exercise_logs)
      let row = state.rows.find(row => row.auth_user_id === payload.auth_user_id && row.client_id === payload.client_id &&
        row.day_name === payload.day_name && row.workout_source === payload.workout_source && session.matchingWorkoutPlan(row.exercise_logs, keys))
      const fields = { ...payload, workout_started_at: payload.workout_date, workout_date: payload.workout_local_date }
      if (row) Object.assign(row, fields)
      else { row = { id: `cardio-row-${state.rows.length}`, ...fields };state.rows.push(row) }
      return { data: structuredClone(row), error: null }
    },
  }
  const body = (log = initialized()) => ({ client_id: client.client_id, program: client.program, day_name: cardio.MANUAL_CARDIO_DAY_NAME,
    workout_source: 'manual', workout_date: new Date().toISOString(), exercise_logs: [log], planned_exercises: [exercise(log.manual_cardio_id, log.duration_unit)], completed: true })
  const save = value => route.POST(new Request('https://synthetic.invalid/api/workout-log', { method: 'POST', body: JSON.stringify(value) }))
  const reload = (log = initialized()) => route.GET(new Request(`https://synthetic.invalid/api/workout-log?clientId=${client.client_id}&dayName=Manual%20Cardio&source=manual&planKeys=${encodeURIComponent(JSON.stringify([log.session_key]))}`))
  return { state, client, body, save, reload }
}

test('only established cardio identities use duration and Walking Lunge remains strength', () => {
  assert.deepEqual(cardio.MANUAL_CARDIO_OPTIONS.map(option => option.label), ['Walking', 'Running', 'Cycling', 'Treadmill'])
  for (const option of cardio.MANUAL_CARDIO_OPTIONS) for (const unit of ['minutes', 'seconds']) {
    const value = exercise(option.id, unit), dose = activity.activityDose(value)
    assert.equal(dose.kind, 'cardio');assert.equal(dose.metric, unit);assert.equal(dose.prescribed, 0)
    for (const key of ['sets', 'reps', 'weight', 'recommended_weight', 'duration_minutes', 'duration_seconds']) assert.equal(value[key], undefined)
    assert.equal(activity.workoutCompletion([initialized(option.id, unit)]).completed, false)
  }
  assert.equal(activity.activityDose({ exercise: 'Walking Lunge', exercise_category: 'strength', sets: 3, reps: 10 }).kind, 'strength')
  assert.throws(() => exercise('walking-lunge'), /supported cardio/)
})

test('canonical manual cardio keeps actual duration only and rejects guidance or invalid identity', () => {
  const original = confirmed('running', 'seconds', 90)
  const safe = cardio.canonicalManualCardioLog({ ...original, distance: 9, heart_rate: 105, calories: 200, email: 'synthetic@invalid.test' })
  assert.ok(safe)
  for (const key of ['distance', 'heart_rate', 'calories', 'email', 'actual_weight', 'actual_reps']) assert.equal(safe[key], undefined)
  assert.deepEqual(activity.summarizeActivityUnits([safe], true), { sets: 0, reps: 0, minutes: 1.5, breaths: 0, activities: 0 })
  for (const patch of [{ prescription: { version: 'founder-selected-v1', sets: 3 } }, { planned_sets: 3 }, { recommended_weight: 50 },
    { sets: 3 }, { duration_minutes: 10 }, { actual_reps: 10 }, { actual_weight: 1 }, { actual_duration: -1 },
    { manual_cardio_id: 'walking' }, { exercise: 'Walking Lunge' }, { duration_unit: 'reps' }, { set_logs: [{ reps: 10, weight: 20 }] }]) {
    assert.equal(cardio.canonicalManualCardioLog({ ...original, ...patch }), null)
  }
  assert.equal(cardio.canonicalManualCardioLog({ ...original, actual_duration: 0 }), null)
})

test('Tracker pause, server resume, duration confirmation and retry preserve one cardio session', async () => {
  const app = fixture(), initial = initialized('cycling', 'seconds')
  let response = await app.save(app.body(initial)), result = await response.json()
  assert.equal(response.status, 200);assert.equal(result.completed, false);assert.equal(result.session.exercise_logs[0].actual_duration, 0)
  const firstId = result.session.id
  let stored = (await (await app.reload(initial)).json()).session
  assert.equal(session.resumeWorkoutSession([initial], null, stored).logs[0].completed, false)
  response = await app.save(app.body(confirmed('cycling', 'seconds', 135)));result = await response.json()
  assert.equal(response.status, 200);assert.equal(result.completed, true);assert.equal(result.session.id, firstId)
  stored = (await (await app.reload(initial)).json()).session
  const resumed = session.resumeWorkoutSession([initial], null, stored).logs[0]
  assert.equal(resumed.actual_duration, 135);assert.equal(resumed.duration_unit, 'seconds');assert.equal(resumed.completed, true)
  assert.equal(activity.summarizeActivityUnits([resumed], true).minutes, 2.25)
  assert.equal((await app.save(app.body(resumed))).status, 200);assert.equal(app.state.rows.length, 1)
})

test('minute actuals and save failure retain the prior confirmed history for safe retry', async () => {
  const app = fixture('ember'), log = confirmed('treadmill', 'minutes', 12.5)
  assert.equal((await app.save(app.body(log))).status, 200)
  const prior = structuredClone(app.state.rows)
  app.state.fail = true
  assert.equal((await app.save(app.body({ ...log, actual_duration: 15 }))).status, 500)
  assert.deepEqual(app.state.rows, prior)
  app.state.fail = false
  assert.equal((await app.save(app.body({ ...log, actual_duration: 15 }))).status, 200)
  assert.equal(app.state.rows[0].exercise_logs[0].actual_duration, 15);assert.equal(app.state.rows.length, 1)
})

test('cardio saves do not replace strength logs, original sets or strength completion', async () => {
  const app = fixture('ignite'), now = new Date().toISOString()
  const strength = { id: 'original-strength-session', client_id: app.client.client_id, auth_user_id: owner, program: app.client.program,
    day_name: 'Manual Workout', workout_source: 'manual', workout_started_at: now, workout_date: now.slice(0, 10),
    exercise_logs: [{ id: 'strength', exercise: 'Squat', exercise_category: 'strength', planned_sets: 4, sets: 4,
      prescription: { version: 'founder-selected-v1', sets: 4 }, set_logs: [{ reps: 8, weight: 20, weight_unit: 'kg', completed_at: now }] }],
    planned_exercises: [], completed: false }
  app.state.rows.push(structuredClone(strength))
  const before = activity.workoutCompletion(strength.exercise_logs)
  assert.equal((await app.save(app.body(confirmed()))).status, 200)
  assert.deepEqual(app.state.rows[0], strength);assert.equal(app.state.rows.length, 2)
  assert.deepEqual(activity.workoutCompletion(app.state.rows[0].exercise_logs), before)
  assert.equal(before.totalSets, 4);assert.equal(before.completedSets, 1);assert.equal(before.completed, false)
})

test('malicious mixed strength or guidance payloads fail before the cardio write', async () => {
  const app = fixture(), base = app.body(confirmed())
  for (const body of [
    { ...base, exercise_logs: [{ ...base.exercise_logs[0], prescription: { version: 'founder-selected-v1', sets: 3, reps: 10, weightLb: 50 } }] },
    { ...base, planned_exercises: [{ ...base.planned_exercises[0], planned_sets: 3 }] },
    { ...base, exercise_logs: [...base.exercise_logs, { exercise: 'Squat', sets: 3, completed: true }] },
    { ...base, day_name: 'Manual Workout' }, { ...base, workout_source: 'recommended' },
    { ...base, exercise_logs: [{ ...base.exercise_logs[0], duration_unit: 'reps' }] },
    { ...base, planned_exercises: [exercise('walking', 'seconds')] },
  ]) assert.equal((await app.save(body)).status, body.workout_source === 'recommended' ? 403 : 400)
  assert.equal(app.state.writes, 0)
})

test('owned logging gate blocks other accounts, Free and expired mutations while preserving owner history', async () => {
  const app = fixture()
  assert.equal((await app.save(app.body(confirmed()))).status, 200)
  app.state.user = { id: other }
  assert.equal((await app.save(app.body())).status, 404);assert.equal((await app.reload()).status, 404)
  app.state.user = null
  assert.equal((await app.save(app.body())).status, 401);assert.equal((await app.reload()).status, 401)
  const free = fixture('free');assert.equal((await free.save(free.body())).status, 403)
  const expired = fixture();expired.client.membership_expires_at = '2020-01-01T00:00:00Z'
  assert.equal((await expired.save(expired.body())).status, 403)
})

function loadTracker() {
  const require = createRequire(import.meta.url), cache = new Map()
  const mocks = { 'next/navigation': { useRouter: () => ({ refresh() {} }) },
    'next/link': { default: ({ href, children }) => React.createElement('a', { href }, children) },
    '@/components/workout-dashboard/WorkoutSetEditor': { default: () => null } }
  function load(path) {
    path = resolve(path)
    if (cache.has(path)) return cache.get(path).exports
    const module = { exports: {} };cache.set(path, module)
    const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
    runInNewContext(code, { module, exports: module.exports, Date, Intl, console, require(name) {
      if (name in mocks) return mocks[name]
      const base = name.startsWith('@/') ? resolve(name.slice(2)) : name.startsWith('.') ? resolve(dirname(path), name) : null
      if (!base) return require(name)
      return load(base + (existsSync(base + '.ts') ? '.ts' : '.tsx'))
    } }, { filename: path })
    return module.exports
  }
  return load('components/ActivityWorkoutTracker.tsx').default
}

test('actual tracker renders manual duration and zero initial input without a fake prescription', () => {
  const Tracker = loadTracker()
  const html = renderToStaticMarkup(React.createElement(Tracker, { clientId: 'CARDIO-OWNER', authUserId: owner, program: 'tracker',
    dayName: cardio.MANUAL_CARDIO_DAY_NAME, exercises: [exercise('walking', 'seconds')], workoutSource: 'manual', timezone: 'Etc/UTC' }))
  assert.match(html, /Manual duration logging/);assert.match(html, /Actual duration \(seconds\)/);assert.match(html, /value="0"/)
  assert.match(html, /No duration target is prescribed/);assert.match(html, /Distance and automatic readings are not recorded here/)
  assert.doesNotMatch(html, /Prescribed:|prescribed sets recorded|Weight \(/)
  const source = readFileSync('components/ActivityWorkoutTracker.tsx', 'utf8')
  assert.match(source, /onManualExerciseFinished\?\.\(payload\.completed === true\)/)
  assert.match(source, /resumed\.logs\.map/)
})
