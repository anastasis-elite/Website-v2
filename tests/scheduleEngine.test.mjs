import assert from 'node:assert/strict'
import test from 'node:test'
import {importTs} from './typescriptModule.mjs'

const { buildDailyScheduleState, getActionRouteForEvent } = await importTs('lib/schedule/engine.ts')
const { nextScheduleBoundary } = await importTs('lib/schedule/refresh.ts')
const { scheduleConflict } = await importTs('lib/schedule/actions.ts')

function event(overrides = {}) {
  return {
    id: overrides.id || 'event-1',
    user_id: 'user-a',
    client_id: 'client-a',
    title: overrides.title || 'Event',
    description: null,
    event_type: overrides.event_type || 'custom',
    source: overrides.source || 'manual',
    start_at: overrides.start_at || '2026-08-17T15:00:00.000Z',
    end_at: overrides.end_at || '2026-08-17T15:30:00.000Z',
    timezone: 'America/Chicago',
    all_day: false,
    status: overrides.status || 'scheduled',
    completed_at: overrides.completed_at || null,
    flexibility_type: overrides.flexibility_type || 'flexible',
    priority: overrides.priority || 'medium',
    required: Boolean(overrides.required),
    movable: overrides.movable ?? true,
    approval_required: overrides.approval_required ?? false,
    earliest_start_at: overrides.earliest_start_at || null,
    latest_end_at: overrides.latest_end_at || null,
    preferred_time: null,
    estimated_duration_minutes: overrides.estimated_duration_minutes || 30,
    external_provider_name: null,
    external_contact_type: null,
    external_contact_value: null,
    external_event_id: overrides.external_event_id || null,
    external_calendar_source: overrides.external_calendar_source || null,
    reschedule_allowed: overrides.reschedule_allowed ?? true,
    reschedule_requires_approval: overrides.reschedule_requires_approval ?? false,
    last_reschedule_requested_at: null,
    delegation_status: null,
    delegation_notes: null,
    adaptive_reason: null,
    adjusted_start_at: null,
    adjusted_end_at: null,
    adjusted_duration_minutes: null,
    action_route: overrides.action_route || null,
    virtual: Boolean(overrides.virtual),
    calendar_event_id: overrides.calendar_event_id,
    busy: overrides.busy,
  }
}

test('next action chooses the current fixed event without moving it', () => {
  const state = buildDailyScheduleState({
    date: '2026-08-17',
    timezone: 'America/Chicago',
    now: new Date('2026-08-17T15:10:00.000Z'),
    dayStart: new Date('2026-08-17T05:00:00.000Z'),
    dayEnd: new Date('2026-08-18T05:00:00.000Z'),
    events: [
      event({
        id: 'doctor',
        title: 'Doctor appointment',
        event_type: 'medical',
        flexibility_type: 'fixed',
        movable: false,
        approval_required: true,
        required: true,
        priority: 'critical',
      }),
    ],
    logic: { capacityStatus: { status: 'low_capacity' } },
  })

  assert.equal(state.nextAction.id, 'doctor')
  assert.equal(state.fixedEvents.length, 1)
  assert.equal(state.adjustments.some((item) => item.event_id === 'doctor'), false)
})

const stateFor = (events, now = '2026-08-17T16:00:00Z') => buildDailyScheduleState({
  date: '2026-08-17', timezone: 'America/Chicago', now: new Date(now),
  dayStart: new Date('2026-08-17T05:00:00Z'), dayEnd: new Date('2026-08-18T05:00:00Z'), events, logic: {},
})

test('work, school, appointments and custom events route to details rather than hydration', () => {
  for (const type of ['work', 'school', 'appointment', 'medical', 'dental', 'personal', 'household', 'custom']) {
    assert.equal(getActionRouteForEvent(event({ id: type, event_type: type })), `/dashboard/schedule#event-${type}`)
  }
  assert.equal(getActionRouteForEvent(event({ event_type: 'work', virtual: true, action_route: '/dashboard/assessment/daily-structure' })), '/dashboard/assessment/daily-structure')
  assert.equal(getActionRouteForEvent(event({ event_type: 'work', calendar_event_id: 'calendar-a' })), '/dashboard/schedule#calendar-event-calendar-a')
  assert.equal(getActionRouteForEvent(event({ event_type: 'meal', action_route: '/dashboard/nutrition#aos-food-logger' }), 'ember'), '/dashboard/nutrition')
})

test('current commitments win over later high-priority actions without changing chronological upcoming order', () => {
  const current = event({ id: 'work', event_type: 'work', flexibility_type: 'fixed', movable: false, priority: 'low', start_at: '2026-08-17T15:00:00Z', end_at: '2026-08-17T17:00:00Z' })
  const later = event({ id: 'workout', event_type: 'workout', priority: 'critical', start_at: '2026-08-17T22:00:00Z', end_at: '2026-08-17T22:30:00Z' })
  const state = stateFor([later, current])
  assert.equal(state.nextAction.id, 'work')
  assert.equal(state.nextAction.urgency, 'now')
  assert.equal(state.nextAction.can_defer, false)
  assert.deepEqual(state.upcomingEvents.map(item => item.id), ['work', 'workout'])
})

test('overdue flexible actions remain actionable with an unconfirmed rescheduling suggestion', () => {
  const missed = event({ id: 'admin', source: 'manual', start_at: '2026-08-17T13:00:00Z', end_at: '2026-08-17T13:30:00Z' })
  const state = stateFor([missed, event({ id: 'later', priority: 'low', start_at: '2026-08-17T22:00:00Z', end_at: '2026-08-17T22:30:00Z' })])
  assert.equal(state.nextAction.id, 'admin')
  assert.equal(state.nextAction.urgency, 'overdue')
  assert.equal(state.nextAction.overdue, true)
  assert.equal(state.nextAction.can_complete, true)
  assert.equal(state.nextAction.can_defer, true)
  assert.equal(state.adjustments.find(item => item.event_id === 'admin').applied, false)
  assert.equal(state.events.find(item => item.id === 'admin').adjusted_start_at, null)
  const historicalDeferred = stateFor([{ ...missed, status: 'deferred' }])
  assert.equal(historicalDeferred.nextAction.can_defer, true)
  assert.equal(historicalDeferred.adjustments[0].event_id, 'admin')
})

test('important upcoming activities precede overdue items while overdue outcomes remain accessible', () => {
  const overdue = event({ id: 'dropoff', event_type: 'school', virtual: true, required: true,
    flexibility_type: 'fixed', movable: false, start_at: '2026-08-17T13:00:00Z', end_at: '2026-08-17T13:30:00Z' })
  const pickup = event({ id: 'pickup', event_type: 'school', required: true,
    start_at: '2026-08-17T20:00:00Z', end_at: '2026-08-17T20:30:00Z' })
  const state = stateFor([overdue, pickup])
  assert.equal(state.nextAction.id, 'pickup')
  assert.deepEqual(state.overdueEvents.map(item => item.id), ['dropoff'])
  const resolution = stateFor([overdue])
  assert.equal(resolution.nextAction.id, 'dropoff')
  assert.equal(resolution.nextAction.can_complete, true)
  assert.equal(resolution.nextAction.can_defer, false)
})

test('calendar dismissals stay in history without completion or changing occupied time', () => {
  const info = event({ id: 'info', source: 'external_calendar', calendar_event_id: 'provider-event' })
  const state = stateFor([{ ...info, dismissed_from_today: '2026-08-17' }])
  assert.equal(state.nextAction.id, 'none')
  assert.equal(state.events[0].status, 'scheduled')
  assert.equal(state.completedEvents.length, 0)
  assert.equal(state.openWindows.some(window => Date.parse(window.start_at) < Date.parse(info.end_at) && Date.parse(window.end_at) > Date.parse(info.start_at)), false)
})

test('completion and skipped/cancelled states remove actions; activity completion uses its logging surface', () => {
  const finished = ['completed', 'skipped', 'cancelled'].map(status => event({ id: status, status }))
  const state = stateFor(finished)
  assert.equal(state.nextAction.id, 'none')
  assert.deepEqual(state.overdueEvents, [])
  assert.equal(stateFor([event({ event_type: 'workout' })]).nextAction.can_complete, false)
  assert.equal(stateFor([event({ calendar_event_id: 'calendar-a', event_type: 'custom' })]).nextAction.can_complete, false)
  assert.equal(stateFor([event({ event_type: 'custom', virtual: true })]).nextAction.can_defer, true)
})

test('future selection follows the soonest event and event end is an exclusive boundary', () => {
  const state = stateFor([event({ id: 'soon', start_at: '2026-08-17T17:00:00Z', end_at: '2026-08-17T17:30:00Z', priority: 'low' }), event({ id: 'later', start_at: '2026-08-17T22:00:00Z', end_at: '2026-08-17T22:30:00Z', priority: 'critical' })])
  assert.equal(state.nextAction.id, 'soon')
  assert.equal(stateFor([event()], '2026-08-17T15:30:00Z').nextAction.urgency, 'overdue')
})

test('free calendar entries do not prevent a confirmed rescheduling window', () => {
  const free = event({ id: 'free', busy: false })
  assert.equal(scheduleConflict([free], 'new', new Date(free.start_at), new Date(free.end_at), 10), null)
})

test('screen refresh follows daypart, adjusted event and local midnight boundaries', () => {
  const eventState = { date: '2026-08-17', timezone: 'America/Chicago', events: [{ ...event(), adjusted_start_at: '2026-08-17T17:00:00Z', adjusted_end_at: '2026-08-17T17:30:00Z' }] }
  assert.equal(nextScheduleBoundary(eventState, Date.parse('2026-08-17T16:00:00Z')), Date.parse('2026-08-17T17:00:00Z'))
  assert.equal(nextScheduleBoundary(eventState, Date.parse('2026-08-17T16:59:59Z')), Date.parse('2026-08-17T17:00:00Z'))
  for (const [date, now, expected] of [['2026-03-08', '2026-03-09T04:59:59Z', '2026-03-09T05:00:00Z'], ['2026-11-01', '2026-11-02T05:59:59Z', '2026-11-02T06:00:00Z']]) {
    assert.equal(nextScheduleBoundary({ date, timezone: 'America/Chicago', events: [] }, Date.parse(now)), Date.parse(expected))
  }
  const today = Date.parse('2026-08-18T15:00:00Z')
  assert.equal(nextScheduleBoundary({ date: '2026-08-17', timezone: 'America/Chicago', events: [] }, today), today)
})

test('low capacity suggests a shorter flexible workout without moving fixed obligations', () => {
  const state = buildDailyScheduleState({
    date: '2026-08-17',
    timezone: 'America/Chicago',
    now: new Date('2026-08-17T13:00:00.000Z'),
    dayStart: new Date('2026-08-17T05:00:00.000Z'),
    dayEnd: new Date('2026-08-18T05:00:00.000Z'),
    events: [
      event({
        id: 'workout',
        title: 'Workout',
        event_type: 'workout',
        source: 'program',
        start_at: '2026-08-17T15:00:00.000Z',
        end_at: '2026-08-17T16:00:00.000Z',
        estimated_duration_minutes: 60,
      }),
      event({
        id: 'school',
        title: 'School pickup',
        event_type: 'school',
        start_at: '2026-08-17T20:00:00.000Z',
        end_at: '2026-08-17T20:30:00.000Z',
        flexibility_type: 'fixed',
        movable: false,
        approval_required: true,
      }),
    ],
    logic: { capacityStatus: { status: 'low_capacity' } },
  })

  const workoutAdjustment = state.adjustments.find((item) => item.event_id === 'workout')
  assert.equal(workoutAdjustment?.adjustment_type, 'reduce_duration')
  assert.equal(workoutAdjustment?.suggested_duration_minutes, 30)
  assert.equal(workoutAdjustment?.automatic, false)
  assert.equal(workoutAdjustment?.applied, false)
  assert.equal(state.events.find((item) => item.id === 'workout')?.adjusted_duration_minutes, null)
  assert.equal(state.events.find((item) => item.id === 'workout')?.adjusted_end_at, null)
  assert.equal(state.adjustments.some((item) => item.event_id === 'school'), false)
})

test('missed flexible event receives a suggested open window', () => {
  const state = buildDailyScheduleState({
    date: '2026-08-17',
    timezone: 'America/Chicago',
    now: new Date('2026-08-17T16:10:00.000Z'),
    dayStart: new Date('2026-08-17T05:00:00.000Z'),
    dayEnd: new Date('2026-08-18T05:00:00.000Z'),
    events: [
      event({
        id: 'missed',
        title: 'Admin block',
        start_at: '2026-08-17T13:00:00.000Z',
        end_at: '2026-08-17T13:30:00.000Z',
      }),
      event({
        id: 'fixed',
        title: 'Work meeting',
        start_at: '2026-08-17T16:30:00.000Z',
        end_at: '2026-08-17T17:00:00.000Z',
        flexibility_type: 'fixed',
        movable: false,
        approval_required: true,
      }),
    ],
    logic: {},
  })

  const move = state.adjustments.find((item) => item.event_id === 'missed')
  assert.equal(move?.adjustment_type, 'suggest_move')
  assert.equal(move?.automatic, false)
  assert.equal(move?.applied, false)
  assert.equal(move?.suggested_start_at, '2026-08-17T17:00:00.000Z')
})

test('hydration and nutrition next action routes target execution surfaces', () => {
  const hydrationState = buildDailyScheduleState({
    date: '2026-08-17',
    timezone: 'America/Chicago',
    now: new Date('2026-08-17T13:00:00.000Z'),
    dayStart: new Date('2026-08-17T05:00:00.000Z'),
    dayEnd: new Date('2026-08-18T05:00:00.000Z'),
    events: [
      event({
        id: 'water',
        title: 'Hydration',
        event_type: 'hydration',
        start_at: '2026-08-17T13:00:00.000Z',
        end_at: '2026-08-17T13:10:00.000Z',
        priority: 'high',
      }),
    ],
    logic: {},
  })

  assert.equal(hydrationState.nextAction.action_route, '/dashboard/nutrition?log=water')

  const mealState = buildDailyScheduleState({
    date: '2026-08-17',
    timezone: 'America/Chicago',
    now: new Date('2026-08-17T13:00:00.000Z'),
    dayStart: new Date('2026-08-17T05:00:00.000Z'),
    dayEnd: new Date('2026-08-18T05:00:00.000Z'),
    events: [
      event({
        id: 'meal',
        title: 'Lunch',
        event_type: 'meal',
        start_at: '2026-08-17T13:00:00.000Z',
        end_at: '2026-08-17T13:30:00.000Z',
      }),
    ],
    logic: {},
  })

  assert.equal(mealState.nextAction.action_route, '/dashboard/nutrition?log=meal&meal=lunch')
})

test('workout route respects current program', () => {
  const state = buildDailyScheduleState({
    date: '2026-08-17',
    timezone: 'America/Chicago',
    now: new Date('2026-08-17T13:00:00.000Z'),
    dayStart: new Date('2026-08-17T05:00:00.000Z'),
    dayEnd: new Date('2026-08-18T05:00:00.000Z'),
    events: [
      event({
        id: 'workout',
        title: 'Workout',
        event_type: 'workout',
        start_at: '2026-08-17T15:00:00.000Z',
        end_at: '2026-08-17T15:30:00.000Z',
      }),
    ],
    logic: { program: 'phoenix' },
  })

  assert.equal(state.nextAction.action_route, '/dashboard/program/phoenix/workout')
})

test('fixed external event is never automatically adjusted', () => {
  const state = buildDailyScheduleState({
    date: '2026-08-17',
    timezone: 'America/Chicago',
    now: new Date('2026-08-17T13:00:00.000Z'),
    dayStart: new Date('2026-08-17T05:00:00.000Z'),
    dayEnd: new Date('2026-08-18T05:00:00.000Z'),
    events: [
      event({
        id: 'external',
        title: 'External appointment',
        event_type: 'appointment',
        source: 'external_calendar',
        start_at: '2026-08-17T15:00:00.000Z',
        end_at: '2026-08-17T16:00:00.000Z',
        flexibility_type: 'fixed',
        movable: false,
        approval_required: true,
        external_event_id: 'calendar-1',
        external_calendar_source: 'google',
      }),
    ],
    logic: { capacityStatus: { status: 'low_capacity' } },
  })

  assert.equal(state.adjustments.some((item) => item.event_id === 'external'), false)
  assert.equal(state.nextAction.can_defer, false)
})
