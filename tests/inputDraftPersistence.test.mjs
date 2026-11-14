import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'

const { createWorkoutInputDraft, readWorkoutInputDraft } = await importTs('lib/workout/inputDraft.ts')
const { initialWorkoutLogs, matchingWorkoutPlan, workoutSessionKeys } = await importTs('lib/workout/session.ts')
const route = await importTs('app/api/workout-log/route.ts', {
  'next/server': 'export const NextResponse = { json: (body, init) => Response.json(body, init) }',
  '@/lib/supabase/server': 'export const createClient = async () => globalThis.inputDraftTestDb',
  '@/lib/analytics/server': 'export const recordConversion = async () => false',
  '@/lib/dashboard/invalidateDailyPlan': 'export const invalidateDailyPlan = () => {}',
})

const plan = [0, 1, 2].map(index => ({ id: 'kickback', session_key: `kickback:${index}`, exercise: 'Cable Kickback',
  exercise_category: 'strength', sets: 3, reps: 12, recommended_weight: 15, weight_unit: 'lb', load_type: 'single_side' }))
const draft = () => ({ version: 1, session_key: 'kickback:1', weight_unit: 'kg', weightEdited: true, weight: 7.25, amountEdited: true, amount: 11 })
const request = body => new Request('https://draft.test/api/workout-log', { method: 'POST', body: JSON.stringify(body) })

function database() {
  const client = { client_id: 'DRAFT-ONLY', auth_user_id: 'draft-owner', program: 'ember', access: true, active: true, timezone: 'Etc/UTC' }
  const rows = [], writes = []
  const db = {
    auth: { getUser: async () => ({ data: { user: { id: client.auth_user_id } } }) },
    from(table) {
      const filters = []
      const q = { select() { return q }, eq(key, value) { filters.push(row => row[key] === value); return q },
        gte(key, value) { filters.push(row => row[key] >= value); return q }, lt(key, value) { filters.push(row => row[key] < value); return q },
        order() { return q }, limit() { return q }, maybeSingle: async () => result(true), then(done) { return Promise.resolve(result()).then(done) } }
      function result(single = false) {
        const matches = (table === 'clients' ? [client] : rows).filter(row => filters.every(filter => filter(row)))
        return { data: single ? matches[0] || null : matches, error: null }
      }
      return q
    },
    async rpc(name, args) {
      assert.equal(name, 'save_daily_workout')
      const payload = { ...structuredClone(args.p_payload), workout_started_at: args.p_payload.workout_date, workout_date: args.p_payload.workout_local_date }
      writes.push(payload)
      let row = rows.find(row => row.day_name === payload.day_name && matchingWorkoutPlan(row.exercise_logs, workoutSessionKeys(payload.exercise_logs)))
      if (row) Object.assign(row, payload)
      else { row = { id: 'draft-session', ...payload }; rows.push(row) }
      return { data: structuredClone(row), error: null }
    },
  }
  globalThis.inputDraftTestDb = db
  return { client, rows, writes }
}
const bodyFor = (client, logs) => ({ client_id: client.client_id, program: client.program, day_name: 'Saved workout', workout_source: 'recommended',
  workout_date: new Date().toISOString(), planned_exercises: structuredClone(plan), exercise_logs: logs, completed: false })
const reopen = async client => (await (await route.GET(new Request(`https://draft.test/api/workout-log?clientId=${client.client_id}&dayName=Saved%20workout&planKeys=${encodeURIComponent(JSON.stringify(workoutSessionKeys(plan)))}`))).json()).session

test('only explicit input edits are serialized; blanks stay null and occurrence/unit travel with them', () => {
  assert.equal(createWorkoutInputDraft({ weight: 15, amount: 12 }, 'kickback:1', 'lb'), null)
  const saved = createWorkoutInputDraft({ weightEdited: true, weight: NaN, amountEdited: true, amount: 0, set_logs: [{ weight: 999 }] }, 'kickback:1', 'kg')
  assert.deepEqual(saved, { version: 1, session_key: 'kickback:1', weight_unit: 'kg', weightEdited: true, weight: null, amountEdited: true, amount: 0 })
  assert.deepEqual(readWorkoutInputDraft(JSON.parse(JSON.stringify(saved)), 'kickback:1'), saved)
  assert.deepEqual(createWorkoutInputDraft({ weightEdited: true, weight: 0, amount: 12 }, 'kickback:1', 'lb'),
    { version: 1, session_key: 'kickback:1', weight_unit: 'lb', weightEdited: true, weight: 0 })
})

test('corrupt and foreign draft records cannot supply an input value', () => {
  for (const patch of [{ version: 2 }, { session_key: 'kickback:0' }, { weight_unit: 'stone' }, { weight: '7.25' },
    { weight: -1 }, { weight: Infinity }, { weightEdited: false }, { amount: undefined }, { actual_weight: 40 }]) {
    const value = { ...draft(), ...patch }, before = structuredClone(value)
    assert.equal(readWorkoutInputDraft(value, 'kickback:1'), null)
    assert.deepEqual(value, before)
  }
  for (const value of [null, [], '7.25', {}, { version: 1, session_key: 'kickback:1', weight_unit: 'lb' }]) {
    assert.equal(readWorkoutInputDraft(value, 'kickback:1'), null)
  }
})

test('real save/pause and GET round-trip edited unconfirmed values separately across repeated saves', async () => {
  const { client, rows } = database(), logs = initialWorkoutLogs(plan)
  const recordedSet = { set_number: 1, weight: 0, weight_unit: 'kg', reps: 9, completed_at: new Date().toISOString() }
  logs[0].set_logs = [recordedSet]
  logs[1].input_draft = draft()
  const body = bodyFor(client, logs), before = structuredClone(body)
  assert.equal((await route.POST(request(body))).status, 200)
  assert.deepEqual(body, before, 'the save does not mutate the caller')
  const originalPlan = structuredClone(rows[0].planned_exercises)
  for (let attempt = 0; attempt < 3; attempt++) {
    const saved = await reopen(client)
    assert.deepEqual(saved.exercise_logs[1].input_draft, draft())
    assert.deepEqual(saved.exercise_logs[0].set_logs, [recordedSet])
    assert.deepEqual(saved.exercise_logs[1].set_logs, [])
    assert.equal(saved.exercise_logs[1].actual_weight, 0)
    assert.equal(saved.exercise_logs[1].actual_reps, 0)
    assert.equal(saved.exercise_logs[2].input_draft, undefined, 'untouched defaults remain prescription data')
    assert.deepEqual(saved.planned_exercises, originalPlan)
    assert.equal((await route.POST(request({ ...bodyFor(client, saved.exercise_logs), planned_exercises: saved.planned_exercises }))).status, 200)
  }
  assert.equal(rows.length, 1)
  const cleared = structuredClone(rows[0].exercise_logs)
  cleared[1].input_draft = { ...draft(), weight: null, amount: null }
  assert.equal((await route.POST(request(bodyFor(client, cleared)))).status, 200)
  assert.deepEqual((await reopen(client)).exercise_logs[1].input_draft, cleared[1].input_draft)
  assert.deepEqual(rows[0].exercise_logs[0].set_logs, [recordedSet], 'clearing an unconfirmed input never rewrites a confirmed set')
})

test('invalid drafts and ambiguous occurrence identities are rejected before writing any workout data', async () => {
  for (const patch of [{ session_key: 'kickback:0' }, { version: 99 }, { weight: -1 }, { weight_unit: 'stone' }, { amount: '12' }, { actual_reps: 12 }]) {
    const { client, writes } = database(), logs = initialWorkoutLogs(plan)
    logs[1].input_draft = { ...draft(), ...patch }
    assert.equal((await route.POST(request(bodyFor(client, logs)))).status, 400)
    assert.equal(writes.length, 0)
  }
  const { client, writes } = database(), logs = initialWorkoutLogs(plan)
  logs[0].session_key = 'kickback:1'; logs[1].input_draft = draft()
  assert.equal((await route.POST(request(bodyFor(client, logs)))).status, 400)
  assert.equal(writes.length, 0)
})

test('saved drafts cannot cross the existing local-day boundary', async () => {
  const { client, writes } = database(), logs = initialWorkoutLogs(plan)
  logs[1].input_draft = draft()
  const response = await route.POST(request({ ...bodyFor(client, logs), workout_date: new Date(Date.now() - 2 * 86400000).toISOString() }))
  assert.equal(response.status, 400)
  assert.equal(writes.length, 0)
})
