import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'

const activity = await importTs('lib/workout/activity.ts')
const session = await importTs('lib/workout/session.ts')
const { loadWorkoutHistory } = await importTs('lib/workout/history.ts')
const mocks = {
  'next/server': 'export const NextResponse = { json: (body, init) => Response.json(body, init) }',
  '@/lib/supabase/server': 'export const createClient = async () => globalThis.workoutThresholdDb',
  '@/lib/analytics/server': 'export const recordConversion = async () => false',
  '@/lib/dashboard/invalidateDailyPlan': 'export const invalidateDailyPlan = () => {}',
}
const route = await importTs('app/api/workout-log/route.ts', mocks)
const manualRoute = await importTs('app/api/workout-set-log/route.ts', mocks)
const plan = [1, 2, 3].map(id => ({ id: `exercise-${id}`, exercise: `Exercise ${id}`, exercise_category: 'strength', sets: 3, reps: 8 }))
const stamp = () => new Date().toISOString()
const set = (number, patch = {}) => ({ id: `set-${number}`, set_number: number, reps: 8, weight: 0, weight_unit: 'lb', completed_at: stamp(), ...patch })
function logsFor(counts) {
  return session.initialWorkoutLogs(plan).map((log, index) => ({ ...log, completed: counts[index] >= 3, set_logs: Array.from({ length: counts[index] }, (_, position) => set(position + 1)) }))
}

test('workout checkoff counts all prescribed sets and rounds the half threshold up', () => {
  const four = activity.workoutCompletion(logsFor([3, 1, 0]), plan)
  assert.equal(four.totalSets, 9); assert.equal(four.requiredSets, 5); assert.equal(four.completedSets, 4); assert.equal(four.completed, false)
  const five = activity.workoutCompletion(logsFor([3, 1, 1]), plan)
  assert.equal(five.completedSets, 5); assert.equal(five.completed, true)
  const seven = activity.workoutCompletion(logsFor([3, 1, 3]), plan)
  assert.equal(seven.completedSets, 7); assert.equal(seven.totalSets, 9); assert.equal(seven.complete, 2); assert.equal(seven.partial, 1); assert.equal(seven.completed, true)
  assert.equal(activity.workoutCompletion(logsFor([1, 1, 1]), plan).completed, false, 'attending every exercise does not satisfy half of all sets')
})

test('skips keep the denominator and duplicate slots or identities never inflate completed sets', () => {
  const logs = logsFor([3, 1, 0]); logs[1].skipped = true; logs[2].skipped = true
  logs[0].set_logs.push({ ...logs[0].set_logs[0] }, { ...logs[0].set_logs[1], set_number: 3 }, set(4))
  logs[1].set_logs.push(set(2, { skipped: true }), set(3, { status: 'skipped' }))
  logs.push(structuredClone(logs[0]))
  const counts = activity.workoutCompletion(logs, plan)
  assert.equal(counts.totalSets, 9); assert.equal(counts.completedSets, 4); assert.equal(counts.completed, false)
  for (const patch of [{ reps: true }, { weight: false }, { completed_at: null }, { completed_at: '' }, { reps: 1.5 }, { weight: -1 }]) {
    assert.equal(activity.isValidCompletedSet(set(1, patch)), false)
  }
  const sameInstant = logsFor([3, 0, 0]); sameInstant[0].set_logs = [1, 2, 3].map(number => set(number, { id: undefined, completed_at: '2026-10-31T12:00:00Z' }))
  assert.equal(activity.workoutCompletion(sameInstant, plan).completedSets, 3, 'different prescribed slots at the same timestamp remain separate sets')
})

test('zero and unknown strength prescriptions stay unqualified; confirmed timed activities retain compatibility', () => {
  for (const planned of [[], [{ exercise: 'Squat', sets: 0 }], [{ exercise: 'Squat' }], [{ exercise: 'Squat', sets: -1 }]]) {
    const logs = planned.map(log => ({ ...log, completed: false, set_logs: [set(1)] }))
    assert.equal(activity.workoutCompletion(logs, planned).totalSets, 0)
    assert.equal(activity.workoutCompletion(logs, planned).completed, false)
  }
  const walk = { exercise: 'Walking', duration_minutes: 10, completed: true, actual_duration: 10, duration_unit: 'minutes', confirmed_at: stamp() }
  assert.equal(activity.workoutCompletion([walk], [walk]).completed, true)
  assert.equal(activity.workoutCompletion([{ ...walk, skipped: true }], [walk]).completed, false)
})

function database() {
  const client = { client_id: 'SET-THRESHOLD-ONLY', auth_user_id: 'threshold-owner', program: 'ignite', access: true, active: true, timezone: 'Etc/UTC' }
  const rows = [], sets = new Map()
  const db = {
    auth: { getUser: async () => ({ data: { user: { id: client.auth_user_id } } }) },
    from(table) {
      const filters = []; let mutation = null
      const q = { select() { return q }, eq(key, value) { filters.push(row => row[key] === value); return q }, gte(key, value) { filters.push(row => row[key] >= value); return q }, lt(key, value) { filters.push(row => row[key] < value); return q }, order() { return q }, limit() { return q },
        insert(value) { mutation = { mode: 'insert', value }; return q }, update(value) { mutation = { mode: 'update', value }; return q }, upsert(value) { mutation = { mode: 'upsert', value }; return q },
        maybeSingle: async () => resolve(true), single: async () => resolve(true), then(done) { return Promise.resolve(resolve()).then(done) } }
      function resolve(single = false) {
        if (table === 'clients') return { data: filters.every(filter => filter(client)) ? client : null, error: null }
        if (table === 'workout_exercise_sessions') return { data: { id: mutation.value.exercise_id }, error: null }
        if (mutation) {
          let existing = mutation.mode === 'update' ? rows.find(row => filters.every(filter => filter(row))) : null
          if (existing) Object.assign(existing, structuredClone(mutation.value))
          else { existing = { id: `session-${rows.length + 1}`, ...structuredClone(mutation.value) }; rows.push(existing) }
          return { data: existing, error: null }
        }
        const matches = rows.filter(row => filters.every(filter => filter(row)))
        return { data: single ? matches[0] || null : matches, error: null }
      }
      return q
    },
    async rpc(name, args) {
      if (name === 'replace_workout_sets') { sets.set(args.p_session_id, structuredClone(args.p_sets)); return { data: null, error: null } }
      assert.equal(name, 'save_daily_workout')
      const payload = { ...structuredClone(args.p_payload), workout_started_at: args.p_payload.workout_date, workout_date: args.p_payload.workout_local_date }
      let row = rows.find(row => row.day_name === payload.day_name && row.workout_source === payload.workout_source && session.matchingWorkoutPlan(row.exercise_logs, session.workoutSessionKeys(payload.exercise_logs)))
      if (row) Object.assign(row, payload)
      else { row = { id: `session-${rows.length + 1}`, ...payload }; rows.push(row) }
      return { data: row, error: null }
    },
  }
  globalThis.workoutThresholdDb = db
  return { db, rows, client, sets }
}
const request = body => new Request('https://threshold.test/api/workout-log', { method: 'POST', body: JSON.stringify(body) })
const bodyFor = (client, logs) => ({ client_id: client.client_id, program: client.program, day_name: 'Whole daily plan', workout_source: 'recommended', workout_date: stamp(), planned_exercises: plan, exercise_logs: logs, completed: false })

test('save/pause, duplicate retry, reopen and Today history use the same fixed full-plan threshold', async () => {
  const { db, rows, client } = database()
  const partial = bodyFor(client, logsFor([3, 1, 0]))
  assert.equal((await route.POST(request(partial))).status, 200)
  assert.equal(rows[0].completed, false)
  const qualified = bodyFor(client, logsFor([3, 1, 1]))
  assert.equal((await (await route.POST(request(qualified))).json()).completed, true, 'Save / pause qualifies without finishing the session')
  await route.POST(request(qualified))
  assert.equal(rows.length, 1)
  const keys = encodeURIComponent(JSON.stringify(session.workoutSessionKeys(qualified.exercise_logs)))
  const reopened = await (await route.GET(new Request(`https://threshold.test/api/workout-log?clientId=${client.client_id}&dayName=Whole%20daily%20plan&planKeys=${keys}`))).json()
  assert.equal(reopened.session.completed, true)
  assert.deepEqual(reopened.session.planned_exercises, plan)
  assert.equal(activity.workoutCompletion(session.resumeWorkoutSession(session.initialWorkoutLogs(plan), null, reopened.session).logs, reopened.session.planned_exercises).completedSets, 5)
  rows[0].completed = false
  assert.equal((await loadWorkoutHistory({ supabase: db, client, completed: true })).data.length, 1, 'Today/checkoff reads qualifying persisted sets even for an older partial flag')
  const shrunk = { ...partial, planned_exercises: plan.map(exercise => ({ ...exercise, sets: 1 })) }
  assert.equal((await route.POST(request(shrunk))).status, 200)
  assert.equal(rows[0].completed, false)
  assert.equal(rows[0].planned_exercises.reduce((sum, exercise) => sum + exercise.sets, 0), 9)
  assert.equal((await route.POST(request({ ...partial, planned_exercises: plan.slice(0, 1), exercise_logs: partial.exercise_logs.slice(0, 1) }))).status, 400)
  assert.equal(rows.length, 1)
})

test('manual session checkoff aggregates every known custom prescription, preserves retries, and does not borrow the recommended denominator', async () => {
  const { rows, client, sets } = database()
  for (const [index, count] of [3, 1, 3].entries()) {
    const exercise = { id: `manual-${index}`, exercise: `Manual ${index}`, sets: 3, exercise_category: 'strength' }
    const logs = [{ ...exercise, planned_sets: 3, set_logs: Array.from({ length: count }, (_, position) => set(position + 1)) }]
    const body = { ...bodyFor(client, logs), day_name: 'Manual Workout', workout_source: 'manual', exercise, sets: logs[0].set_logs, exercise_logs: logs, exercise_finished_at: stamp() }
    assert.equal((await manualRoute.POST(request(body))).status, 200)
    assert.equal((await manualRoute.POST(request(body))).status, 200)
  }
  assert.equal(rows.length, 1)
  assert.equal(rows[0].exercise_logs.length, 3)
  assert.equal(activity.workoutCompletion(rows[0].exercise_logs, activity.manualWorkoutPlan(rows[0].exercise_logs)).completedSets, 7)
  assert.equal(activity.workoutCompletion(rows[0].exercise_logs, activity.manualWorkoutPlan(rows[0].exercise_logs)).totalSets, 9)
  assert.equal(rows[0].completed, true)
  assert.equal(sets.size, 3)
  assert.equal(activity.workoutRecordComplete({ workout_source: 'manual', exercise_logs: [{ exercise: 'Unknown prescription', set_logs: [set(1)] }], completed: true }), false)
})
