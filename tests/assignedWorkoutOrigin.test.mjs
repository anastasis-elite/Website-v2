import assert from 'node:assert/strict'
import test, { after, mock } from 'node:test'
import { importTs } from './typescriptModule.mjs'

const instant = '2026-11-11T16:00:00.000Z', date = '2026-11-11'
mock.timers.enable({ apis: ['Date'], now: Date.parse(instant) })
const priorSecret = process.env.SUPABASE_SERVICE_ROLE_KEY
const priorPreferredSecret = process.env.SUPABASE_SECRET_KEY
delete process.env.SUPABASE_SECRET_KEY
process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-generated-origin-test-secret-only'
after(() => {
  mock.timers.reset()
  if (priorSecret === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY
  else process.env.SUPABASE_SERVICE_ROLE_KEY = priorSecret
  if (priorPreferredSecret === undefined) delete process.env.SUPABASE_SECRET_KEY
  else process.env.SUPABASE_SECRET_KEY = priorPreferredSecret
  delete globalThis.assignedWorkoutOriginDb
})

const { runWorkoutDecisionEngine } = await importTs('lib/dashboard/logic/engines.ts')
const { getWorkoutForToday } = await importTs('lib/workout/getWorkoutForToday.ts')
const { attachGeneratedWorkoutOrigin, readGeneratedWorkoutOrigin } = await importTs('lib/workout/generatedOrigin.ts')
const { generatedWorkoutCompletionEvidence } = await importTs('lib/workout/occurrenceCompletion.ts')
const { dailyPlanToScheduleEvents } = await importTs('lib/schedule/dailyPlanAdapter.ts')
const { buildTodayDaySections } = await importTs('lib/dashboard/todayDaySections.ts')
const { buildTodayActivities } = await importTs('lib/dashboard/todayActivities.ts')
const { workoutSessionKeys, initialWorkoutLogs, matchingWorkoutPlan } = await importTs('lib/workout/session.ts')
const { workoutCompletion, workoutRecordComplete, activityDose, prescribedSetCount } = await importTs('lib/workout/activity.ts')
const { loadWorkoutHistory } = await importTs('lib/workout/history.ts')
const route = await importTs('app/api/workout-log/route.ts', {
  'next/server': 'export const NextResponse = { json: (body, init) => Response.json(body, init) }',
  '@/lib/supabase/server': 'export const createClient = async () => globalThis.assignedWorkoutOriginDb',
  '@/lib/analytics/server': 'export const recordConversion = async () => false',
  '@/lib/dashboard/invalidateDailyPlan': 'export const invalidateDailyPlan = () => {}',
})

const owner = '11111111-1111-4111-8111-111111111111'
const client = { client_id: 'ASSIGNED-ORIGIN-ONLY', auth_user_id: owner, program: 'ignite', timezone: 'UTC',
  access: true, active: true, primary_goal: 'strength', time_available: 45, preferred_workout_time: '08:00' }
const sourceExercises = ['Bicep Curl', 'Squat', 'Row'].map((exercise, index) => ({
  id: `source-${index}`, session_key: `source-${index}:0`, exercise, exercise_category: 'strength', sets: 3, reps: 8, recommended_weight: 20,
}))
const planned = { day_name: 'Wednesday', day_intent: 'training', exercises: sourceExercises }

function inputs(member = client) {
  return { date, userId: owner, client: member, program: 'ignite', plannedWorkout: planned, plannedExercises: sourceExercises,
    nutritionTotals: [], nutritionLogs: [], workoutHistory: [], strengthAssessments: [], todayRecovery: {}, executionHistory: [],
    photoRecord: null, initialAssessment: null }
}

function assignment(kind = 'reordered') {
  const member = { ...client, time_available: kind === 'reduced' ? 20 : 45 }
  const capacity = { status: kind === 'low-capacity' ? 'low_capacity' : 'high_capacity' }
  const recovery = { status: 'normal_training_day' }, fuel = { status: 'well_fueled' }, hydration = { status: 'ready', percent: 100 }
  const decision = runWorkoutDecisionEngine(inputs(member), capacity, recovery, fuel, hydration,
    { redFlag: false, severity: 'none' }, { correctivePriorities: [], substitutions: [] })
  assert.equal(decision.canTrain, true)
  return decision.assignedWorkout
}

function withOrigin(assigned, patch = {}) {
  return attachGeneratedWorkoutOrigin({ userId: owner, client, date, plannedWorkout: planned,
    assignedWorkout: assigned, now: new Date(instant), ...patch })
}

function completedLogs(exercises) {
  return initialWorkoutLogs(exercises).map((exercise, index) => {
    const dose = activityDose(exercise)
    if (dose.kind === 'strength') return { ...exercise, completed: true, set_logs: Array.from({ length: prescribedSetCount(exercise) }, (_, slot) => ({
      id: `set-${index}-${slot}`, set_number: slot + 1, reps: 8, weight: 20, weight_unit: 'lb', completed_at: instant,
    })) }
    return { ...exercise, completed: true, confirmed_at: instant, activity_completed: dose.metric === 'completion',
      actual_duration: !['breaths', 'completion'].includes(dose.metric) ? Math.max(1, dose.prescribed) : 0,
      actual_breaths: dose.metric === 'breaths' ? Math.max(1, dose.prescribed) : 0, duration_unit: dose.metric }
  })
}

function database(member = client) {
  const rows = [], writes = []
  const db = { auth: { getUser: async () => ({ data: { user: { id: owner } } }) }, from(table) {
    assert.ok(['clients', 'workout_logs'].includes(table), `Unexpected source/write ${table}`)
    const filters = [], orders = []
    let limit = Infinity
    const q = { select() { return q }, eq(key, value) { filters.push(row => row[key] === value); return q },
      gte(key, value) { filters.push(row => row[key] != null && row[key] >= value); return q },
      lt(key, value) { filters.push(row => row[key] != null && row[key] < value); return q },
      order(key, options = {}) { orders.push([key, options.ascending === true]); return q }, limit(value) { limit = value; return q },
      maybeSingle: async () => resolve(true), then(done, failed) { return Promise.resolve().then(() => resolve()).then(done, failed) },
      insert() { assert.fail('Workout persistence must retain the existing RPC boundary.') },
      update() { assert.fail('No generated plan or broad history update is allowed.') },
    }
    function resolve(single = false) {
      let found = (table === 'clients' ? [member] : rows).filter(row => filters.every(filter => filter(row)))
      for (const [key, ascending] of [...orders].reverse()) found = [...found].sort((left, right) => String(left[key] || '').localeCompare(String(right[key] || '')) * (ascending ? 1 : -1))
      found = found.slice(0, limit)
      return { data: structuredClone(single ? found[0] || null : found), error: null }
    }
    return q
  }, async rpc(name, args) {
    assert.equal(name, 'save_daily_workout')
    const payload = structuredClone(args.p_payload)
    assert.equal(payload.client_id, client.client_id); assert.equal(payload.auth_user_id, owner)
    assert.equal(payload.program, client.program)
    assert.ok(payload.workout_date >= args.p_day_start && payload.workout_date < args.p_day_end)
    // This is the existing RPC identity, including full local date and ordered occurrence keys.
    let row = rows.find(saved => saved.auth_user_id === owner && saved.client_id === payload.client_id &&
      saved.workout_date === payload.workout_local_date && saved.day_name === payload.day_name &&
      saved.workout_source === payload.workout_source && matchingWorkoutPlan(saved.exercise_logs, workoutSessionKeys(payload.exercise_logs)))
    const update = { ...payload, workout_date: payload.workout_local_date, workout_started_at: row?.workout_started_at || payload.workout_date }
    // The existing SQL RPC names its update columns explicitly. Classification
    // is database-owned: new rows get the default and updates cannot replace it.
    delete update.generated_origin_version
    if (row) Object.assign(row, update)
    else { row = { id: `saved-session-${rows.length + 1}`, ...update, generated_origin_version: 1 }; rows.push(row) }
    writes.push({ name, payload })
    return { data: structuredClone(row), error: null }
  } }
  globalThis.assignedWorkoutOriginDb = db
  return { db, rows, writes }
}

const request = body => new Request('https://assigned-origin.test/api/workout-log', { method: 'POST', body: JSON.stringify(body) })
const bodyFor = (assigned, patch = {}) => ({ client_id: client.client_id, program: client.program, day_name: assigned.day_name,
  workout_source: 'recommended', workout_date: instant, planned_exercises: assigned.exercises,
  exercise_logs: completedLogs(assigned.exercises), completed: false, ...patch })
const readEvidence = (history, patch = {}) => generatedWorkoutCompletionEvidence({ userId: owner, client, date,
  plannedWorkout: planned, plannedExercises: sourceExercises, history, now: new Date(instant), ...patch })
const generatedEvent = (evidence, selectedDate = date) => dailyPlanToScheduleEvents({ userId: owner, client, workoutCompletion: evidence,
  dailyPlan: { date: selectedDate, timezone: client.timezone, timing: {}, workoutCompleted: true } })
  .find(event => event.id === `virtual-workout-${selectedDate}`)

function dayProjection(events, evidence) {
  const logic = { program: 'ignite', client: { id: client.client_id }, assessments: { dailyCompleted: false },
    hydration: { target: 80, remaining: 80, consumed: 0, status: 'ready' }, nutrition: { dataStatus: 'known' }, symptoms: { redFlag: false },
    workout: { assigned: true }, workoutDecision: { canTrain: true, assignedWorkout: { workout_state: 'planned' }, reasonForModification: 'Saved plan.' },
    execution: { workoutComplete: true, generatedWorkoutCompletion: evidence, nutritionLogged: false, recoveryComplete: false } }
  const schedule = { date, timezone: client.timezone, now: instant, events, dailyGuide: { date, activities: {} } }
  const model = buildTodayDaySections(logic, schedule, buildTodayActivities(logic, schedule).activities)
  return [...model.sections.flatMap(section => section.items), ...model.untimed]
}

test('real low-capacity, reordered and reduced assigned prescriptions save and complete their originating generated day', async () => {
  const original = structuredClone(planned)
  const freeze = value => { if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(freeze) } }
  freeze(planned)
  for (const kind of ['low-capacity', 'reordered', 'reduced']) {
    const assigned = assignment(kind)
    if (kind === 'low-capacity') {
      const direct = getWorkoutForToday({ inputs: inputs(), recoveryStatus: 'normal_training_day', fuelReadiness: { status: 'well_fueled' },
        capacityStatus: 'low_capacity', plannedWorkout: planned, assignedExercises: sourceExercises })
      assert.equal(direct.exercises.length, 6)
      assert.equal(assigned.day_name, 'Low-Capacity Strength Workout'); assert.equal(assigned.exercises.length, 6)
    } else if (kind === 'reordered') {
      assert.notDeepEqual(workoutSessionKeys(assigned.exercises), workoutSessionKeys(sourceExercises))
      assert.equal(assigned.exercises.length, 3)
    } else assert.equal(assigned.exercises.length, 2)
    const beforeAssigned = structuredClone(assigned), signed = withOrigin(assigned), storage = database()
    assert.deepEqual(assigned, beforeAssigned, 'issuance cannot mutate the assigned prescription')
    assert.equal(typeof signed.exercises[0].generated_workout_origin, 'string')
    const response = await route.POST(request(bodyFor(signed)))
    assert.equal(response.status, 200, await response.clone().text())
    const saved = (await response.json()).session
    assert.equal(workoutRecordComplete(saved), true)
    assert.equal(workoutCompletion(saved.exercise_logs, saved.planned_exercises).completed, true)
    assert.equal(saved.planned_exercises[0].generated_workout_origin, signed.exercises[0].generated_workout_origin)
    const history = await loadWorkoutHistory({ supabase: storage.db, client, authUserId: owner, startDate: date })
    assert.equal(history.error, null)
    const evidence = readEvidence(history.data)
    assert.equal(evidence.sessionId, saved.id, kind)
    const generated = generatedEvent(evidence)
    assert.equal(generated.status, 'completed')
    assert.equal(dayProjection([generated], evidence).some(item => item.eventId === generated.id), false)
    assert.deepEqual(planned, original)
    assert.equal(storage.writes.length, 1)
  }
})

test('saved assigned provenance survives readiness changes and resume without recomputing the prior prescription', async () => {
  const signed = withOrigin(assignment('low-capacity')), storage = database()
  let response = await route.POST(request(bodyFor(signed)))
  assert.equal(response.status, 200)
  const first = (await response.json()).session, savedPlan = structuredClone(first.planned_exercises)
  const laterAssignment = assignment('reordered')
  assert.notEqual(laterAssignment.day_name, first.day_name)
  assert.notDeepEqual(workoutSessionKeys(laterAssignment.exercises), workoutSessionKeys(first.planned_exercises))
  const params = new URLSearchParams({ clientId: client.client_id, dayName: first.day_name, source: 'recommended', planKeys: JSON.stringify(workoutSessionKeys(first.exercise_logs)) })
  const reopened = await (await route.GET(new Request(`https://assigned-origin.test/api/workout-log?${params}`))).json()
  assert.equal(reopened.session.id, first.id)
  assert.deepEqual(reopened.session.planned_exercises, savedPlan)
  response = await route.POST(request({ ...bodyFor(signed), planned_exercises: reopened.session.planned_exercises, exercise_logs: reopened.session.exercise_logs }))
  assert.equal(response.status, 200)
  assert.equal(storage.rows.length, 1)
  assert.deepEqual(storage.rows[0].planned_exercises, savedPlan)
  assert.equal(readEvidence(storage.rows).sessionId, first.id)
})

test('assigned completion leaves independent same-day workouts, adjacent days and another week untouched', async () => {
  const signed = withOrigin(assignment('low-capacity')), storage = database()
  assert.equal((await route.POST(request(bodyFor(signed)))).status, 200)
  const before = structuredClone(storage.rows), evidence = readEvidence(storage.rows), generated = generatedEvent(evidence)
  const separate = { ...generated, id: 'separate-evening-class', source: 'external_calendar', virtual: false,
    calendar_event_id: 'calendar-evening', external_event_id: 'provider-evening', title: 'Evening class',
    start_at: `${date}T18:00:00Z`, end_at: `${date}T19:00:00Z`, status: 'scheduled', completed_at: null }
  assert.ok(dayProjection([generated, separate], evidence).some(item => item.eventId === separate.id))
  for (const selectedDate of ['2026-11-10', '2026-11-12', '2026-11-18']) {
    assert.equal(generatedEvent(evidence, selectedDate).status, 'scheduled')
    assert.equal(readEvidence(storage.rows, { date: selectedDate }).sessionId, null)
  }
  const manual = structuredClone(storage.rows[0]); manual.workout_source = 'manual'
  assert.equal(readEvidence([manual]).sessionId, null)
  assert.deepEqual(storage.rows, before)
})

test('altered signed assigned identity/dose or foreign owner/date cannot claim the generated occurrence', async () => {
  const signed = withOrigin(assignment('low-capacity'))
  const variants = [
    assigned => { assigned.exercises[0].generated_workout_origin += 'tampered' },
    assigned => { assigned.exercises[0].session_key = 'another-assigned-occurrence' },
    assigned => { assigned.exercises[0].sets = Number(assigned.exercises[0].sets) + 1 },
    assigned => { assigned.day_name = 'Another assigned title' },
  ]
  for (const alter of variants) {
    const changed = structuredClone(signed); alter(changed)
    const storage = database(), response = await route.POST(request(bodyFor(changed)))
    if (response.ok) assert.equal(readEvidence(storage.rows).sessionId, null)
    else assert.equal(storage.rows.length, 0)
  }
  const foreign = withOrigin(assignment('low-capacity'), { userId: 'foreign-owner', client: { ...client, auth_user_id: 'foreign-owner' } })
  let storage = database(), response = await route.POST(request(bodyFor(foreign)))
  if (response.ok) assert.equal(readEvidence(storage.rows).sessionId, null)
  else assert.equal(storage.rows.length, 0)
  const otherDate = withOrigin(assignment('low-capacity'), { date: '2026-11-18', now: new Date('2026-11-18T16:00:00Z') })
  storage = database(); response = await route.POST(request(bodyFor(otherDate)))
  if (response.ok) assert.equal(readEvidence(storage.rows).sessionId, null)
  else assert.equal(storage.rows.length, 0)
})

test('legacy exact-prescription and half-set completion stay valid while adapted legacy origin remains unconfirmed', () => {
  const exact = { id: 'legacy-exact', client_id: client.client_id, auth_user_id: owner, program: client.program,
    day_name: planned.day_name, workout_source: 'recommended', workout_date: date, workout_started_at: null, updated_at: null,
    planned_exercises: structuredClone(sourceExercises), exercise_logs: sourceExercises.map(exercise => ({ ...exercise, completed: true })), completed: true }
  assert.equal(workoutRecordComplete(exact), true)
  assert.equal(readEvidence([exact]).sessionId, exact.id)
  const halfLogs = completedLogs(sourceExercises)
  halfLogs[1].set_logs = halfLogs[1].set_logs.slice(0, 2); halfLogs[1].completed = false
  halfLogs[2].set_logs = []; halfLogs[2].completed = false
  const half = { ...exact, id: 'half-saved', exercise_logs: halfLogs, completed: false }
  assert.equal(workoutCompletion(halfLogs, sourceExercises).completedSets, 5)
  assert.equal(workoutRecordComplete(half), true)
  assert.equal(readEvidence([half]).sessionId, half.id)
  halfLogs[1].set_logs = halfLogs[1].set_logs.slice(0, 1)
  assert.equal(readEvidence([{ ...half, completed: true }]).sessionId, null)
  const adapted = assignment('low-capacity')
  const legacyAdapted = { ...exact, id: 'legacy-unlinked-adapted', day_name: adapted.day_name,
    planned_exercises: adapted.exercises, exercise_logs: completedLogs(adapted.exercises), completed: true }
  assert.equal(workoutRecordComplete(legacyAdapted), true)
  assert.equal(readEvidence([legacyAdapted]).sessionId, null)
})

test('adapted origin and the real save/read path retain the member-local generated date across UTC midnight', async () => {
  const late = '2026-11-12T04:30:00.000Z', chicago = { ...client, timezone: 'America/Chicago' }
  mock.timers.setTime(Date.parse(late))
  try {
    const signed = withOrigin(assignment('low-capacity'), { client: chicago, now: new Date(late) })
    const storage = database(chicago)
    const logs = completedLogs(signed.exercises).map(log => ({ ...log,
      ...(log.confirmed_at ? { confirmed_at: late } : {}),
      set_logs: log.set_logs.map(set => ({ ...set, completed_at: late })),
    }))
    const response = await route.POST(request(bodyFor(signed, { workout_date: late, exercise_logs: logs })))
    assert.equal(response.status, 200, await response.clone().text())
    const row = (await response.json()).session
    assert.equal(row.workout_date, date)
    assert.equal(row.workout_started_at, late)
    const history = await loadWorkoutHistory({ supabase: storage.db, client: chicago, authUserId: owner, startDate: date })
    const evidence = readEvidence(history.data, { client: chicago, now: new Date(late) })
    assert.equal(evidence.sessionId, row.id)
    assert.equal(readEvidence(history.data, { client: chicago, date: '2026-11-12', now: new Date(late) }).sessionId, null)
    const scheduled = dailyPlanToScheduleEvents({ userId: owner, client: chicago, workoutCompletion: evidence,
      dailyPlan: { date, timezone: chicago.timezone, timing: {} } }).find(event => event.id === `virtual-workout-${date}`)
    assert.equal(scheduled.status, 'completed')
  } finally { mock.timers.setTime(Date.parse(instant)) }
})

const fourSetWednesday = { day_name: 'Wednesday', day_intent: 'training', exercises: [
  { id: 'same-squat', session_key: 'same-squat:0', exercise: 'Squat', exercise_category: 'strength', sets: 4, reps: 8, recommended_weight: 20 },
] }
const signedFourSetWednesday = () => withOrigin(fourSetWednesday, { plannedWorkout: fourSetWednesday })
const fourSetEvidence = rows => readEvidence(rows, { plannedWorkout: fourSetWednesday, plannedExercises: fourSetWednesday.exercises })
const withoutOriginMetadata = exercises => exercises.map(exercise => Object.fromEntries(Object.entries(exercise)
  .filter(([key]) => !key.startsWith('generated_workout_origin'))))
async function reopenSaved(row) {
  const params = new URLSearchParams({ clientId: client.client_id, dayName: row.day_name, source: 'recommended',
    planKeys: JSON.stringify(workoutSessionKeys(row.exercise_logs)) })
  const response = await route.GET(new Request(`https://assigned-origin.test/api/workout-log?${params}`))
  assert.equal(response.status, 200)
  return (await response.json()).session
}

test('same-title/key rejected dose saves actual work but cannot regain legacy authority through stripped resume retries', async () => {
  const original = structuredClone(fourSetWednesday), signed = signedFourSetWednesday()
  const changed = structuredClone(signed)
  changed.exercises[0].sets = 1
  assert.equal(changed.day_name, fourSetWednesday.day_name)
  assert.deepEqual(workoutSessionKeys(changed.exercises), workoutSessionKeys(fourSetWednesday.exercises))
  assert.equal(readGeneratedWorkoutOrigin({ userId: owner, client, date, dayName: changed.day_name, plan: changed.exercises,
    now: new Date(instant) }), null, 'only the prescribed dose changed; its retained signature is invalid')
  const storage = database()
  let response = await route.POST(request(bodyFor(changed)))
  assert.equal(response.status, 200, await response.clone().text())
  let row = (await response.json()).session
  const savedId = row.id
  assert.equal(workoutRecordComplete(row), true, 'the one recorded set completes this saved one-set session')
  assert.equal(workoutCompletion(row.exercise_logs, fourSetWednesday.exercises).completed, false, 'one set does not complete the original four-set generated prescription')
  let history = await loadWorkoutHistory({ supabase: storage.db, client, authUserId: owner, startDate: date })
  assert.equal(fourSetEvidence(history.data).sessionId, null)
  for (const retry of ['stripped', 'forged-legacy', 'fresh-valid-proof']) {
    const resumed = await reopenSaved(row)
    let postedPlan = withoutOriginMetadata(resumed.planned_exercises)
    if (retry === 'forged-legacy') postedPlan[0].generated_workout_origin_status = 'legacy'
    if (retry === 'fresh-valid-proof') postedPlan = signedFourSetWednesday().exercises
    response = await route.POST(request(bodyFor(changed, { planned_exercises: postedPlan,
      exercise_logs: withoutOriginMetadata(resumed.exercise_logs) })))
    assert.equal(response.status, 200, await response.clone().text())
    row = (await response.json()).session
    assert.equal(row.id, savedId)
    assert.equal(row.planned_exercises[0].sets, 1, 'the retained original saved snapshot must not be reinterpreted by a retry')
    assert.equal(workoutRecordComplete(row), true)
    history = await loadWorkoutHistory({ supabase: storage.db, client, authUserId: owner, startDate: date })
    const evidence = fourSetEvidence(history.data), event = generatedEvent(evidence)
    assert.equal(evidence.sessionId, null, retry)
    assert.equal(event.status, 'scheduled')
    assert.ok(dayProjection([event], evidence).some(item => item.eventId === event.id))
  }
  assert.equal(storage.rows.length, 1)
  assert.deepEqual(fourSetWednesday, original)
})

test('new absent, removed or client-labeled legacy provenance stays unverified while a valid exact proof confirms completion', async () => {
  for (const kind of ['absent', 'removed', 'client-legacy-label']) {
    let unsigned = kind === 'absent' ? structuredClone(fourSetWednesday) : signedFourSetWednesday()
    unsigned = { ...unsigned, exercises: withoutOriginMetadata(unsigned.exercises) }
    if (kind === 'client-legacy-label') unsigned.exercises[0].generated_workout_origin_status = 'legacy'
    const storage = database()
    let response = await route.POST(request(bodyFor(unsigned)))
    assert.equal(response.status, 200, await response.clone().text())
    let row = (await response.json()).session
    assert.equal(workoutRecordComplete(row), true)
    assert.equal(workoutCompletion(row.exercise_logs, fourSetWednesday.exercises).completed, true)
    assert.equal(fourSetEvidence(storage.rows).sessionId, null, `${kind}: a new unsigned row must not masquerade as historical legacy`)
    const resumed = await reopenSaved(row)
    response = await route.POST(request(bodyFor(unsigned, { planned_exercises: withoutOriginMetadata(resumed.planned_exercises),
      exercise_logs: withoutOriginMetadata(resumed.exercise_logs) })))
    assert.equal(response.status, 200, await response.clone().text())
    row = (await response.json()).session
    assert.equal(row.id, resumed.id)
    assert.equal(fourSetEvidence(storage.rows).sessionId, null, `${kind}: removing metadata on a later save cannot restore legacy authority`)
    assert.equal(storage.rows.length, 1)
  }
  const storage = database(), signed = signedFourSetWednesday()
  const response = await route.POST(request(bodyFor(signed)))
  assert.equal(response.status, 200, await response.clone().text())
  const row = (await response.json()).session, evidence = fourSetEvidence(storage.rows), event = generatedEvent(evidence)
  assert.equal(evidence.sessionId, row.id)
  assert.equal(event.status, 'completed')
  assert.equal(dayProjection([event], evidence).some(item => item.eventId === event.id), false)
})

test('preexisting genuine legacy prescription remains authoritative through normal saves without changing another history row', async () => {
  const storage = database(), original = structuredClone(fourSetWednesday)
  const legacy = { id: 'genuine-preexisting-legacy', client_id: client.client_id, auth_user_id: owner, program: client.program,
    day_name: fourSetWednesday.day_name, workout_source: 'recommended', workout_date: date, workout_started_at: null, updated_at: null,
    planned_exercises: structuredClone(fourSetWednesday.exercises),
    exercise_logs: fourSetWednesday.exercises.map(exercise => ({ ...exercise, completed: true })), completed: true }
  const otherWeek = { ...structuredClone(legacy), id: 'another-week-history', workout_date: '2026-11-04' }
  storage.rows.push(legacy, otherWeek)
  const otherBefore = structuredClone(otherWeek), planBefore = structuredClone(legacy.planned_exercises)
  assert.equal(fourSetEvidence(storage.rows).sessionId, legacy.id)
  const resumed = await reopenSaved(legacy)
  const halfLogs = completedLogs(resumed.planned_exercises).map(log => ({ ...log, completed: false, set_logs: log.set_logs.slice(0, 2) }))
  assert.equal(workoutCompletion(halfLogs, fourSetWednesday.exercises).completed, true)
  const response = await route.POST(request(bodyFor(fourSetWednesday, { planned_exercises: resumed.planned_exercises, exercise_logs: halfLogs })))
  assert.equal(response.status, 200, await response.clone().text())
  const saved = (await response.json()).session
  assert.equal(saved.id, legacy.id)
  assert.equal(workoutRecordComplete(saved), true)
  assert.deepEqual(saved.planned_exercises, planBefore, 'saving a genuine legacy session retains its trusted existing prescribed snapshot')
  assert.equal(fourSetEvidence(storage.rows).sessionId, legacy.id)
  assert.equal(generatedEvent(fourSetEvidence(storage.rows)).status, 'completed')
  assert.deepEqual(otherWeek, otherBefore)
  assert.deepEqual(fourSetWednesday, original)
  assert.equal(storage.rows.length, 2)
  assert.equal(storage.writes.length, 1)
})

test('database-owned new-row classification prevents legacy fallback even if all retained JSON provenance is removed', async () => {
  const changed = signedFourSetWednesday()
  changed.exercises = structuredClone(changed.exercises)
  changed.exercises[0].sets = 1
  const storage = database()
  const response = await route.POST(request(bodyFor(changed, { generated_origin_version: null })))
  assert.equal(response.status, 200, await response.clone().text())
  const saved = (await response.json()).session
  assert.equal(saved.generated_origin_version, 1, 'a client cannot label a newly saved row as legacy')
  const stripped = { ...structuredClone(saved), planned_exercises: withoutOriginMetadata(saved.planned_exercises),
    exercise_logs: withoutOriginMetadata(saved.exercise_logs) }
  assert.equal(workoutRecordComplete(stripped), true)
  assert.equal(workoutCompletion(stripped.exercise_logs, fourSetWednesday.exercises).completed, false)
  assert.equal(stripped.generated_origin_version, 1)
  assert.equal(fourSetEvidence([stripped]).sessionId, null, 'JSON loss does not change this database-classified new row into legacy evidence')

  const genuineLegacy = { ...structuredClone(stripped), id: 'genuine-null-classification', generated_origin_version: null,
    planned_exercises: structuredClone(fourSetWednesday.exercises), exercise_logs: completedLogs(fourSetWednesday.exercises) }
  assert.equal(workoutRecordComplete(genuineLegacy), true)
  assert.equal(fourSetEvidence([genuineLegacy]).sessionId, genuineLegacy.id, 'a real preexisting NULL-classified exact legacy prescription retains its established evidence')
})
