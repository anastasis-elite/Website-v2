import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'

const { buildTodayActivities, presentTodayActivities } = await importTs('lib/dashboard/todayActivities.ts')
const { buildDailyRecommendation } = await importTs('lib/dashboard/dailyRecommendation.ts')
const { recoveryCompletionEvidence } = await importTs('lib/recovery/todayCompletion.ts')
const owner = 'QA-OWNER', clientId = 'QA-CLIENT', date = '2026-11-02'
const event = (id, start, end, patch = {}) => ({ id, user_id: owner, client_id: clientId, title: `${id} recovery`,
  event_type: 'recovery', status: 'scheduled', all_day: false, flexibility_type: 'fixed', required: false,
  suggested: false, start_at: `${date}T${start}:00Z`, end_at: `${date}T${end}:00Z`, ...patch })
const morning = () => event('morning', '08:00', '08:30')
const evening = () => event('evening', '18:00', '18:30')
const state = (now = '09:00', events = [morning(), evening()]) => ({ date, timezone: 'UTC', now: `${date}T${now}:00Z`,
  events, nextActionableEvent: events.at(-1), dailyGuide: { date, activities: {} } })
const row = (at, patch = {}) => ({ user_id: owner, client_id: clientId, log_date: date, created_at: `${date}T${at}:00Z`, ...patch })
const logic = (rows = [row('08:10')], patch = {}) => ({ program: 'ignite', client: { id: clientId },
  hydration: { target: 80, consumed: 80, remaining: 0, status: 'ready' },
  nutrition: { dataStatus: 'known', calories: { percent: 100 }, protein: { percent: 100 }, pacing: { state: 'complete' } },
  flameState: { requirements: { requiredItems: { dailyCheckIn: true, hydration: true, nutrition: true, workoutOrMovement: true, recovery: true } } },
  assessments: { dailyCompleted: true }, workout: { assigned: false },
  workoutDecision: { canTrain: true, assignedWorkout: { workout_state: 'rest' } },
  capacityStatus: { status: 'moderate_capacity' }, symptoms: { redFlag: false }, recoveryStatus: { reasoning: 'Existing guidance.' },
  execution: { workoutComplete: true, nutritionLogged: true, recoveryComplete: rows.length > 0,
    recoveryEvidence: recoveryCompletionEvidence({ userId: owner, clientId, date, rows }), ...patch } })
const recovery = (current, schedule) => presentTodayActivities(current, schedule).find(item => item.id === 'recovery')
const actions = (current, schedule) => { const result = buildDailyRecommendation(current, schedule);return [result.primary, ...result.supporting] }

test('a linked morning completion hides only its current block and a separate later block returns without rewriting daily progress', () => {
  const current = logic(), morningState = state()
  const before = structuredClone(current), canonical = buildTodayActivities(current, morningState)
  assert.equal(canonical.activities.find(item => item.id === 'recovery').status, 'completed')
  assert.equal(recovery(current, morningState), undefined)
  assert.equal(actions(current, morningState).some(action => action.category === 'recovery'), false)
  const later = state('18:05')
  assert.equal(recovery(current, later).status, 'available')
  const next = actions(current, later).filter(action => action.category === 'recovery')
  assert.equal(next.length, 1)
  assert.equal(next[0].eventId, 'evening')
  assert.deepEqual([buildTodayActivities(current, later).completed, buildTodayActivities(current, later).total], [canonical.completed, canonical.total])
  assert.deepEqual(current, before)
  const completed = logic([row('08:10'), row('18:07')])
  assert.equal(recovery(completed, state('18:10')), undefined)
  assert.equal(actions(completed, state('18:10')).some(action => action.category === 'recovery'), false)
})

test('explicit recovery completion, skip and defer remain scoped to their own event and saved intent stays authoritative', () => {
  const completedEvent = evening();completedEvent.status = 'completed'
  assert.equal(recovery(logic([]), state('18:05', [morning(), completedEvent])), undefined)
  const unreadLogs = logic([]);unreadLogs.execution.recoveryEvidence.available = false
  assert.equal(recovery(unreadLogs, state('18:05', [morning(), completedEvent])), undefined)
  for (const status of ['skipped', 'deferred']) {
    const held = evening();held.status = status
    const current = logic(), schedule = state('18:05', [morning(), held])
    assert.equal(recovery(current, schedule).status, status)
    assert.equal(recovery(current, schedule).canResume, false)
    assert.equal(actions(current, schedule).some(action => action.category === 'recovery'), false)
    current.execution.recoveryEvidence.available = false
    assert.equal(recovery(current, schedule).status, status)
    assert.equal(actions(current, schedule).some(action => action.category === 'recovery'), false)
  }
  const current = logic(), deferred = state('18:05')
  deferred.dailyGuide.activities.recovery = { status: 'deferred', until: `${date}T19:00:00Z` }
  assert.equal(recovery(current, deferred).status, 'deferred')
  assert.equal(recovery(current, deferred).canResume, true)
  assert.equal(actions(current, deferred).some(action => action.category === 'recovery'), false)
})

test('future recovery and future reschedules do not revive a completed earlier block before their due boundary', () => {
  const futureOnly = state('09:00', [evening()])
  assert.equal(recovery(logic(), futureOnly), undefined)
  assert.equal(actions(logic(), futureOnly).some(action => action.category === 'recovery'), false)
  const moved = morning();moved.adjusted_start_at = `${date}T19:00:00Z`;moved.adjusted_end_at = `${date}T19:30:00Z`
  const schedule = state('18:45', [moved])
  assert.equal(recovery(logic(), schedule), undefined)
  assert.equal(actions(logic(), schedule).some(action => action.category === 'recovery'), false)
})

test('other-owner evidence, ambiguous timestamps and read errors never falsely complete a recovery event', () => {
  const schedule = state('18:10', [evening()])
  const foreignLog = logic([row('18:07', { user_id: 'OTHER' })])
  assert.equal(recovery(foreignLog, schedule).status, 'available')
  const foreignEvent = evening();foreignEvent.user_id = 'OTHER'
  assert.equal(actions(logic(), state('18:10', [foreignEvent])).some(action => action.eventId === foreignEvent.id), false)
  const overlap = event('overlap', '18:00', '18:20')
  const ambiguous = logic([row('18:07')])
  const overlapping = state('18:10', [evening(), overlap])
  assert.match(recovery(ambiguous, overlapping).detail, /could not be linked/)
  assert.equal(actions(ambiguous, overlapping).some(action => action.category === 'recovery'), false)
  const unavailable = logic();unavailable.execution.recoveryEvidence.available = false
  assert.match(recovery(unavailable, schedule).detail, /could not be confirmed/)
  assert.equal(actions(unavailable, schedule).some(action => action.category === 'recovery'), false)
})

test('known unscheduled recovery retains canonical daily completion without inventing new time blocks', () => {
  const schedule = state('18:10', [])
  assert.equal(recovery(logic(), schedule), undefined)
  assert.equal(actions(logic(), schedule).some(action => action.category === 'recovery'), false)
  assert.equal(recovery(logic([]), schedule).status, 'available')
  assert.equal(actions(logic([]), schedule).filter(action => action.category === 'recovery').length, 1)
})
