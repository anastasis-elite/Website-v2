import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'

const { generatedWorkoutCompletionEvidence, generatedWorkoutOccurrenceCompleted } = await importTs('lib/workout/occurrenceCompletion.ts')
const { dailyPlanToScheduleEvents } = await importTs('lib/schedule/dailyPlanAdapter.ts')
const { buildTodayDaySections } = await importTs('lib/dashboard/todayDaySections.ts')
const { buildTodayActivities } = await importTs('lib/dashboard/todayActivities.ts')
const { workoutRecordComplete } = await importTs('lib/workout/activity.ts')
const { projectStrengthWorkout } = await importTs('lib/assessment/strengthWorkout.ts')
const { strengthAssessmentStatusFromRecords } = await importTs('lib/assessment/getStrengthAssessmentStatus.ts')
const { strengthCadence } = await importTs('lib/assessment/strengthCadence.ts')
const { getClientDayRange } = await importTs('lib/schedule/time.ts')
const { getDailyScheduleState } = await importTs('lib/schedule/service.ts', {
  '@/lib/calendar/service': 'export const importedScheduleEvents = async () => { throw new Error("Use provided saved calendar source") }',
  '@/lib/day/getDailyExecutionPlan': 'export const getDailyExecutionPlan = async () => { throw new Error("Use provided saved day") }',
  '@/lib/dashboard/logic/getProgramLogicForClient': 'export const getProgramLogicForClient = async () => { throw new Error("Use provided logic") }',
})

const owner = '11111111-1111-4111-8111-111111111111'
const client = { client_id: 'QA-GENERATED-OCCURRENCE', auth_user_id: owner, program: 'ignite', timezone: 'UTC', preferred_workout_time: '08:00' }
const date = '2026-11-11'
const now = new Date('2026-11-11T23:00:00Z')
const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
// A retained generated week, with distinct saved prescribed occurrences per day.
const savedWeek = { days: weekdays.map(day_name => ({ day_name, day_intent: 'training', exercises: [
  { id: `${day_name.toLowerCase()}-squat`, session_key: `${day_name.toLowerCase()}-squat:0`, exercise: 'Squat', exercise_category: 'strength', sets: 4, reps: 8, recommended_weight: 20 },
] })) }
const generatedDay = selectedDate => savedWeek.days.find(day => day.day_name === new Date(`${selectedDate}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }))

function recordedSession({ selectedDate = date, plan = generatedDay(selectedDate), count = 2, patch = {} } = {}) {
  const planned = structuredClone(plan.exercises)
  return { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', client_id: client.client_id, auth_user_id: owner,
    program: 'ignite', day_name: plan.day_name, workout_source: 'recommended', workout_date: selectedDate,
    workout_started_at: `${selectedDate}T08:05:00Z`, updated_at: `${selectedDate}T08:25:00Z`, planned_exercises: planned,
    exercise_logs: planned.map(exercise => ({ ...exercise, completed: count === 4, skipped: false,
      set_logs: Array.from({ length: count }, (_, index) => ({ id: `set-${index + 1}`, set_number: index + 1,
        reps: 8, weight: 20, weight_unit: 'lb', completed_at: `${selectedDate}T08:${String(10 + index).padStart(2, '0')}:00Z` })) })),
    completed: count >= 2, ...patch }
}

function evidence(rows, selectedDate = date, selectedClient = client, instant = now) {
  const plan = generatedDay(selectedDate)
  return generatedWorkoutCompletionEvidence({ userId: owner, client: selectedClient, date: selectedDate,
    plannedWorkout: plan, plannedExercises: plan.exercises, history: rows, now: instant })
}

function generatedEvent(completion, selectedDate = date, selectedClient = client) {
  return dailyPlanToScheduleEvents({ userId: owner, client: selectedClient, workoutCompletion: completion,
    // This pre-existing aggregate can be true from another session. It is never an occurrence link.
    dailyPlan: { date: selectedDate, timezone: selectedClient.timezone, timing: {}, workoutCompleted: true } })
    .find(event => event.id === `virtual-workout-${selectedDate}`)
}

function otherWorkout(id = 'evening-class', patch = {}) {
  return { id, user_id: owner, client_id: client.client_id, title: 'Evening cycling class', event_type: 'workout',
    source: 'external_calendar', calendar_event_id: `calendar-${id}`, external_event_id: `provider-${id}`,
    start_at: `${date}T18:00:00Z`, end_at: `${date}T19:00:00Z`, timezone: 'UTC', schedule_date: date,
    status: 'scheduled', completed_at: null, description: 'A separate saved workout.', all_day: false,
    flexibility_type: 'fixed', adjusted_start_at: null, adjusted_end_at: null, ...patch }
}

function currentLogic(completed, strength) {
  return { program: 'ignite', client: { id: client.client_id }, assessments: { dailyCompleted: false, ...(strength ? { strength } : {}) },
    hydration: { target: 80, consumed: 0, remaining: 80, status: 'ready' }, nutrition: { dataStatus: 'known' },
    symptoms: { redFlag: false }, workout: { assigned: true },
    workoutDecision: { canTrain: true, adjustmentLevel: 'level_0_full_plan', assignedWorkout: { workout_state: 'planned' }, reasonForModification: 'Existing saved plan.' },
    execution: { workoutComplete: completed, nutritionLogged: false, recoveryComplete: false } }
}

function visible(events, completed, selectedDate = date, selectedClient = client, strength) {
  const logic = currentLogic(completed, strength)
  const schedule = { date: selectedDate, timezone: selectedClient.timezone, now: `${selectedDate}T23:00:00Z`, events,
    preferences: { carouselStyle: 'section' }, dailyGuide: { date: selectedDate, activities: {} } }
  const day = buildTodayDaySections(logic, schedule, buildTodayActivities(logic, schedule).activities)
  return { day, ids: [...day.sections.flatMap(section => section.items), ...day.untimed].map(item => item.eventId).filter(Boolean) }
}

test('a completed generated workout checks off its exact morning action while a separate same-day workout remains visible', () => {
  const row = recordedSession(), complete = workoutRecordComplete(row)
  assert.equal(complete, true)
  const completion = evidence([row])
  assert.equal(completion.sessionId, row.id)
  assert.equal(generatedWorkoutOccurrenceCompleted(completion, { userId: owner, clientId: client.client_id, date }), true)
  const generated = generatedEvent(completion), separate = otherWorkout()
  assert.equal(generated.status, 'completed')
  assert.equal(separate.status, 'scheduled')
  const result = visible([generated, separate], complete)
  assert.equal(result.ids.includes(generated.id), false)
  assert.equal(result.ids.includes(separate.id), true)
  assert.equal(result.day.sections[2].items.find(item => item.eventId === separate.id).startAt, `${date}T18:00:00.000Z`)
})

test('completion belongs to the performed generated day, preserving adjacent days and next week’s same weekday', () => {
  const row = recordedSession(), weekBefore = recordedSession({ selectedDate: '2026-11-04', patch: { id: 'prior-week-session' } })
  const history = [row, weekBefore], beforeWeek = structuredClone(savedWeek), beforeHistory = structuredClone(history)
  const freeze = value => { if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(freeze) } }
  freeze(savedWeek); freeze(history)
  for (const selectedDate of ['2026-11-10', date, '2026-11-12', '2026-11-18']) {
    const completion = evidence(history, selectedDate, client, new Date('2026-11-18T23:00:00Z'))
    const generated = generatedEvent(completion, selectedDate)
    const performed = selectedDate === date
    assert.equal(generated.status === 'completed', performed, selectedDate)
    assert.equal(visible([generated], true, selectedDate).ids.includes(generated.id), !performed, selectedDate)
  }
  assert.deepEqual(savedWeek, beforeWeek)
  assert.deepEqual(history, beforeHistory)
})

test('saved member-local date controls identity across UTC midnight and preserves legacy civil dates', () => {
  const chicago = { ...client, timezone: 'America/Chicago' }
  const night = recordedSession({ patch: { workout_date: '2026-11-12', workout_started_at: '2026-11-12T04:15:00Z', updated_at: '2026-11-12T04:25:00Z' } })
  const instant = new Date('2026-11-12T04:30:00Z')
  assert.equal(evidence([night], date, chicago, instant).sessionId, night.id)
  assert.equal(evidence([night], '2026-11-12', chicago, instant).sessionId, null)
  const legacy = recordedSession({ patch: { workout_started_at: null, workout_date: date, updated_at: null } })
  assert.equal(evidence([legacy], date, chicago, instant).sessionId, legacy.id)
  assert.equal(generatedEvent(evidence([legacy], date, chicago, instant), date, chicago).status, 'completed')
})

test('occurrence confirmation retains the existing half-set rule rather than trusting a submitted Boolean', () => {
  for (const [count, submitted, expected] of [[1, true, false], [2, false, true]]) {
    const row = recordedSession({ count, patch: { completed: submitted } })
    assert.equal(workoutRecordComplete(row), expected)
    const generated = generatedEvent(evidence([row]))
    assert.equal(generated.status === 'completed', expected)
    assert.equal(visible([generated], expected).ids.includes(generated.id), !expected)
  }
})

test('unmatched owner, source, program, day, prescription or absent history cannot check off an occurrence', () => {
  const base = recordedSession()
  const variants = [
    { ...base, auth_user_id: 'another-owner' }, { ...base, client_id: 'another-client' }, { ...base, program: 'phoenix' },
    { ...base, workout_source: 'manual' }, { ...base, day_name: 'Different saved workout' },
    { ...base, planned_exercises: [{ ...base.planned_exercises[0], session_key: 'different-plan:0' }] },
    { ...base, exercise_logs: [{ ...base.exercise_logs[0], session_key: 'different-performed-plan:0' }] },
    { ...base, workout_started_at: '2026-11-18T08:00:00Z', workout_date: '2026-11-18' },
  ]
  for (const rows of [...variants.map(row => [row]), []]) {
    const completion = evidence(rows), generated = generatedEvent(completion)
    assert.equal(completion.sessionId, null)
    assert.equal(generated.status, 'scheduled')
    assert.equal(visible([generated], true).ids.includes(generated.id), true)
  }
  const completion = evidence([base])
  for (const occurrence of [
    { userId: 'another-owner', clientId: client.client_id, date },
    { userId: owner, clientId: 'another-client', date },
    { userId: owner, clientId: client.client_id, date: '2026-11-18' },
  ]) assert.equal(generatedWorkoutOccurrenceCompleted(completion, occurrence), false)
})

test('manual completion cannot hide an untimed generated action and a generated event never duplicates its generic action', () => {
  const manual = recordedSession({ patch: { workout_source: 'manual', day_name: 'Manual strength session' } })
  const completion = evidence([manual])
  assert.equal(workoutRecordComplete(manual), true)
  assert.equal(completion.sessionId, null)
  const logic = currentLogic(workoutRecordComplete(manual))
  logic.execution.generatedWorkoutCompletion = completion
  const schedule = { date, timezone: 'UTC', now: now.toISOString(), events: [], dailyGuide: { date, activities: {} } }
  let day = buildTodayDaySections(logic, schedule, buildTodayActivities(logic, schedule).activities)
  const untimed = day.untimed.find(item => item.activityId === 'workout')
  assert.ok(untimed, 'an unrelated completed manual session leaves the generated prescription unconfirmed')
  assert.notEqual(untimed.status, 'completed')
  assert.match(untimed.detail, /could not be confirmed|not.*confirmed|unconfirmed/i)
  schedule.events = [generatedEvent(completion), otherWorkout()]
  day = buildTodayDaySections(logic, schedule, buildTodayActivities(logic, schedule).activities)
  const all = [...day.sections.flatMap(section => section.items), ...day.untimed]
  assert.equal(all.filter(item => item.eventId === `virtual-workout-${date}`).length, 1)
  assert.equal(all.some(item => item.id === 'activity:workout'), false)
  assert.equal(all.some(item => item.eventId === 'evening-class'), true)
})

function completedStrength() {
  const submittedAt = `${date}T09:00:00Z`
  const assessment = { id: 'saved-final-assessment', submitted_at: submittedAt, assessment_period: '2026-11-01' }
  return { ...strengthAssessmentStatusFromRecords({ period: '2026-11-01', assessment }),
    ...strengthCadence(client, submittedAt, now), latestCompletedAt: submittedAt }
}

test('a saved final strength assessment overlays only the generated slot and preserves imported and program workouts', () => {
  const strength = completedStrength(), generated = generatedEvent(evidence([]))
  const imported = otherWorkout(), program = otherWorkout('program-evening', { source: 'program', calendar_event_id: undefined, external_event_id: null })
  const events = projectStrengthWorkout({ status: strength, userId: owner, client, date, events: [generated, imported, program], now })
  const assessment = events.find(event => event.id === generated.id)
  assert.equal(assessment.title, 'Strength assessment'); assert.equal(assessment.status, 'completed')
  assert.equal(events.find(event => event.id === imported.id).status, 'scheduled')
  assert.equal(events.find(event => event.id === program.id).status, 'scheduled')
  const result = visible(events, strength.completedToday, date, client, strength)
  assert.equal(result.ids.includes(generated.id), false)
  assert.equal(result.ids.includes(imported.id), true)
  assert.equal(result.ids.includes(program.id), true)
})

test('multiple unlinked program slots remain unconfirmed when the assessment has no exact generated slot', () => {
  const strength = completedStrength()
  const first = otherWorkout('first-program', { source: 'program', calendar_event_id: undefined, external_event_id: null,
    start_at: `${date}T08:00:00Z`, end_at: `${date}T09:00:00Z` })
  const second = otherWorkout('second-program', { source: 'program', calendar_event_id: undefined, external_event_id: null })
  const original = structuredClone([first, second])
  const events = projectStrengthWorkout({ status: strength, userId: owner, client, date, events: [first, second], now })
  assert.equal(events.find(event => event.id === first.id).status, 'scheduled')
  assert.equal(events.find(event => event.id === second.id).status, 'scheduled')
  assert.deepEqual([first, second], original)
  const result = visible(events, strength.completedToday, date, client, strength)
  assert.equal(result.ids.includes(first.id), true)
  assert.equal(result.ids.includes(second.id), true)
})

test('a completed strength assessment cannot confirm even a single unlinked program workout by category alone', () => {
  const strength = completedStrength()
  const separate = otherWorkout('independent-program-workout', { source: 'program', calendar_event_id: undefined, external_event_id: null })
  const events = projectStrengthWorkout({ status: strength, userId: owner, client, date, events: [separate], now })
  assert.equal(events.find(event => event.id === separate.id).status, 'scheduled')
  assert.equal(events.find(event => event.title === 'Strength assessment').status, 'completed')
  assert.ok(visible(events, true, date, client, strength).ids.includes(separate.id))
})

test('Schedule assembly does not project a performed generated session onto separate persisted workouts', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: now.getTime() })
  const performed = recordedSession(), completion = evidence([performed])
  const logic = currentLogic(workoutRecordComplete(performed))
  logic.execution.generatedWorkoutCompletion = completion
  logic.nutrition = { dataStatus: 'known', calories: { percent: 100 }, protein: { percent: 100 } }
  logic.capacityStatus = { status: 'high_capacity' }
  logic.recoveryStatus = { reasoning: 'Existing recovery guidance.' }
  logic.workout.title = 'Existing saved generated day'
  const first = otherWorkout('separate-morning', { source: 'manual', calendar_event_id: undefined, external_event_id: null,
    start_at: `${date}T10:00:00Z`, end_at: `${date}T11:00:00Z` })
  const second = otherWorkout(), before = structuredClone([first, second])
  const reader = { from() { assert.fail('Provided saved sources must not issue database reads or writes.') } }
  const member = { ...client, daily_structure_reviewed_at: '2026-11-01T12:00:00Z' }
  const state = await getDailyScheduleState({ supabase: reader, user: { id: owner }, client: member, date, logic,
    dailyPlan: { date, timezone: 'UTC', timing: {}, workoutCompleted: true },
    sources: { reader, userId: owner, clientId: client.client_id, day: getClientDayRange(member, date),
      persistedEvents: [first, second], calendarEvents: [], blocks: [], checkoffs: [], unavailableSources: [] } })
  for (const event of [first, second]) {
    assert.equal(state.events.find(item => item.id === event.id).status, 'scheduled')
    assert.equal(state.completedEvents.some(item => item.id === event.id), false)
    const visible = [...state.todayViewModel.daySections.sections.flatMap(section => section.items), ...state.todayViewModel.daySections.untimed]
    assert.ok(visible.some(item => item.eventId === event.id))
  }
  assert.deepEqual([first, second], before)
})
