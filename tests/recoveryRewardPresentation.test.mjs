import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'

const { getRecoveryRewardForPresentation: present } = await importTs('lib/recovery/rewardPresentation.ts')
const { buildTodayActivities } = await importTs('lib/dashboard/todayActivities.ts')
const { recoveryCompletionEvidence } = await importTs('lib/recovery/todayCompletion.ts')
const userId = 'REWARD-OWNER', clientId = 'REWARD-CLIENT', date = '2026-11-11'
const suggestion = (patch = {}) => ({ version: 1, clientId, date, timezone: 'UTC', kind: 'reward', id: 'high-stress',
  title: 'Let the day soften.', description: 'Settle into a comfortable spot with a podcast you enjoy.', ...patch })
const row = (at, patch = {}) => ({ user_id: userId, client_id: clientId, log_date: date, created_at: `${date}T${at}:00Z`, ...patch })
const event = (id, start, end, patch = {}) => ({ id, user_id: userId, client_id: clientId, event_type: 'recovery',
  title: `${id} recovery`, status: 'scheduled', all_day: false, flexibility_type: 'fixed', required: false, suggested: false,
  start_at: `${date}T${start}:00Z`, end_at: `${date}T${end}:00Z`, ...patch })
const morning = () => event('morning', '08:00', '08:30')
const evening = () => event('evening', '18:00', '18:30')
const state = (at = '18:05', events = []) => ({ date, timezone: 'UTC', now: `${date}T${at}:00Z`, events,
  nextActionableEvent: events.at(-1), dailyGuide: { date, activities: {} } })
const logic = (rows = [], patch = {}) => ({ program: 'ignite', client: { id: clientId, timezone: 'UTC' },
  hydration: { target: 80, consumed: 80, remaining: 0, status: 'ready' },
  nutrition: { dataStatus: 'known', calories: { percent: 100 }, protein: { percent: 100 }, pacing: { state: 'complete' } },
  flameState: { requirements: { requiredItems: { dailyCheckIn: true, hydration: true, nutrition: true, workoutOrMovement: true, recovery: true } } },
  assessments: { dailyCompleted: true }, workout: { assigned: false },
  workoutDecision: { canTrain: true, assignedWorkout: { workout_state: 'rest' }, adjustmentLevel: 'level_0_full_plan' },
  capacityStatus: { status: 'moderate_capacity' }, symptoms: { redFlag: false },
  recoveryStatus: { status: 'normal_training_day', reasoning: 'Existing verified guidance.' },
  recoveryRewardSuggestion: suggestion(),
  execution: { workoutComplete: true, nutritionLogged: true, recoveryComplete: rows.length > 0,
    recoveryEvidence: recoveryCompletionEvidence({ userId, clientId, date, rows }) }, ...patch })
const show = (current, schedule = state()) => present({ logic: current, schedule })

// This gate uses the existing canonical completion and distinct-window
// presentation decisions, rather than creating a second recovery schedule.
test('unscheduled optional rewards disappear after saved recovery and stay hidden when completion evidence is unread', () => {
  const current = logic(), before = structuredClone(current)
  assert.equal(show(current), current.recoveryRewardSuggestion)
  assert.equal(show(logic([row('08:10')])), undefined)
  const unknown = logic();unknown.execution.recoveryEvidence.available = false
  assert.equal(show(unknown), undefined)
  const missing = logic();delete missing.execution.recoveryEvidence
  assert.equal(show(missing), undefined)
  assert.deepEqual(current, before)
})

test('morning completion suppresses its reward until a distinct later recovery block becomes due', () => {
  const current = logic([row('08:10')]), schedule = state('09:00', [morning(), evening()])
  const before = structuredClone(current), canonical = buildTodayActivities(current, schedule)
  assert.equal(canonical.activities.find(item => item.id === 'recovery').status, 'completed')
  assert.equal(show(current, schedule), undefined)
  assert.equal(show(current, state('17:59', [morning(), evening()])), undefined)
  assert.equal(show(current, state('18:00', [morning(), evening()])), current.recoveryRewardSuggestion)
  assert.equal(show(logic([row('08:10'), row('18:07')]), state('18:10', [morning(), evening()])), undefined)
  assert.deepEqual(buildTodayActivities(current, state('18:05', [morning(), evening()])), canonical,
    'Showing a later reward does not rewrite saved daily completion or streak requirements.')
  assert.deepEqual(current, before)
})

test('explicit completed, skipped and deferred recovery events suppress the optional reward', () => {
  for (const status of ['completed', 'skipped', 'deferred']) {
    const current = logic(), schedule = state('18:05', [evening()])
    schedule.events[0].status = status
    assert.equal(show(current, schedule), undefined, status)
    current.execution.recoveryEvidence.available = false
    assert.equal(show(current, schedule), undefined, `${status} remains authoritative through a read failure`)
  }
})

test('member skip and defer choices suppress both unscheduled and due-block rewards until an expired defer returns', () => {
  for (const events of [[], [evening()]]) {
    for (const preference of [{ status: 'skipped' }, { status: 'deferred', until: `${date}T19:00:00Z` }]) {
      const current = logic(), schedule = state('18:05', events)
      schedule.dailyGuide.activities.recovery = preference
      assert.equal(show(current, schedule), undefined)
      const before = structuredClone(schedule)
      show(current, schedule)
      assert.deepEqual(schedule, before, 'The reward gate never saves or clears a member choice.')
    }
    const current = logic(), schedule = state('19:01', events)
    schedule.dailyGuide.activities.recovery = { status: 'deferred', until: `${date}T19:00:00Z` }
    assert.equal(show(current, schedule), current.recoveryRewardSuggestion)
  }
})

test('future windows and accepted later reschedules do not show an early recovery reward', () => {
  const current = logic()
  assert.equal(show(current, state('09:00', [evening()])), undefined)
  const moved = morning();moved.adjusted_start_at = `${date}T19:00:00Z`;moved.adjusted_end_at = `${date}T19:30:00Z`
  assert.equal(show(current, state('18:45', [moved])), undefined)
  assert.equal(show(current, state('19:00', [moved])), current.recoveryRewardSuggestion)
})

test('ambiguous, all-day, unlinked or unavailable recovery evidence never advertises an optional reward', () => {
  const overlap = event('overlap', '18:00', '18:20')
  assert.equal(show(logic([row('18:07')]), state('18:10', [evening(), overlap])), undefined)
  assert.equal(show(logic(), state('18:05', [evening(), overlap])), undefined, 'Identical due starts remain ambiguous without a log.')
  assert.equal(show(logic(), state('18:05', [event('all-day', '00:00', '23:59', { all_day: true })])), undefined)
  assert.equal(show(logic([row('18:02', { created_at: null })]), state('18:05', [evening()])), undefined)
  const unread = state('18:05', [evening()]);unread.unavailableSources = ['calendar']
  assert.equal(show(logic(), unread), undefined)
  const evidenceFailure = logic();evidenceFailure.execution.recoveryEvidence.available = false
  assert.equal(show(evidenceFailure, state('18:05', [evening()])), undefined)
})

test('personalized optional rewards preserve existing program-tier recommendation boundaries', () => {
  for (const program of ['ignite', 'phoenix']) {
    const current = logic([], { program })
    assert.equal(show(current), current.recoveryRewardSuggestion, program)
  }
  for (const program of ['ember', 'tracker', 'unknown', null, undefined]) {
    assert.equal(show(logic([], { program })), undefined, String(program))
  }
})

test('existing verified safety decisions suppress an ordinary reward without changing completion', () => {
  for (const patch of [
    { symptoms: { redFlag: true } },
    { recoveryStatus: { status: 'full_recovery_or_red_flag' } },
    { workoutDecision: { canTrain: true, adjustmentLevel: 'level_4_rest_or_red_flag' } },
    { workoutDecision: { canTrain: false, assignedWorkout: { workout_state: 'recovery' } } },
  ]) {
    const current = logic([], patch), before = structuredClone(current)
    assert.equal(show(current), undefined)
    assert.deepEqual(current, before)
  }
  for (const workout_state of ['rest', 'unavailable']) {
    const current = logic([], { workoutDecision: { canTrain: false, assignedWorkout: { workout_state } } })
    assert.equal(show(current), current.recoveryRewardSuggestion, `Ordinary ${workout_state} is not a new safety restriction.`)
  }
})

test('validated scoped safety guidance survives completion, skip, defer, future windows, read failures and basic tiers', () => {
  for (const program of ['ember', 'ignite', 'phoenix']) for (const condition of ['completed', 'skipped', 'deferred', 'upcoming', 'unavailable']) {
    const current = logic(condition === 'completed' ? [row('08:10')] : [], { program,
      symptoms: { redFlag: true }, recoveryRewardSuggestion: suggestion({ kind: 'safety', id: 'safety-first', title: 'Your safety comes first.', description: 'Follow existing care guidance.' }) })
    const schedule = state(condition === 'upcoming' ? '09:00' : '18:05', [evening()])
    if (condition === 'skipped') schedule.dailyGuide.activities.recovery = { status: 'skipped' }
    if (condition === 'deferred') schedule.dailyGuide.activities.recovery = { status: 'deferred', until: `${date}T19:00:00Z` }
    if (condition === 'completed') schedule.events[0].status = 'completed'
    if (condition === 'unavailable') { current.execution.recoveryEvidence.available = false;schedule.unavailableSources = ['calendar'] }
    assert.equal(show(current, schedule), current.recoveryRewardSuggestion, `${program} ${condition}`)
  }
})

test('foreign, stale, malformed or missing suggestion and completion scopes remain suppressed', () => {
  for (const patch of [{ clientId: 'FOREIGN' }, { date: '2026-11-10' }, { timezone: 'America/Chicago' }, { version: 2 }]) {
    const current = logic([], { recoveryRewardSuggestion: suggestion(patch) })
    assert.equal(show(current), undefined)
  }
  assert.equal(show(logic([], { recoveryRewardSuggestion: undefined })), undefined)
  for (const patch of [{ clientId: 'FOREIGN' }, { date: '2026-11-10' }, { ownerUserId: '' }]) {
    const current = logic();Object.assign(current.execution.recoveryEvidence, patch)
    assert.equal(show(current), undefined)
  }
  const midnight = state();midnight.now = '2026-11-12T00:00:00Z'
  assert.equal(show(logic(), midnight), undefined, 'The previous local day cannot carry a reward across midnight.')
  const historical = state();historical.date = '2026-11-10'
  assert.equal(show(logic(), historical), undefined)
})


test('foreign or malformed recovery event ownership cannot masquerade as unscheduled member recovery', () => {
  for (const patch of [{ user_id: 'FOREIGN' }, { client_id: 'FOREIGN' }, { user_id: undefined },
    { client_id: undefined }, { schedule_date: '2026-11-10' }]) {
    assert.equal(show(logic(), state('18:05', [evening(), event('foreign', '08:00', '08:30', patch)])), undefined)
  }
  const current = logic(), cancelled = event('old', '08:00', '08:30', { user_id: 'FOREIGN', status: 'cancelled' })
  assert.equal(show(current, state('18:05', [cancelled])), current.recoveryRewardSuggestion,
    'A cancelled event does not replace the member’s known unscheduled recovery state.')
})
