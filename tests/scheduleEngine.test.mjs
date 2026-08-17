import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

async function importTypescriptModule(path) {
  const source = readFileSync(path, 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2020,
      target: ts.ScriptTarget.ES2022,
    },
  })
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
}

const { buildDailyScheduleState } = await importTypescriptModule('lib/schedule/engine.ts')

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
    reschedule_allowed: false,
    reschedule_requires_approval: true,
    last_reschedule_requested_at: null,
    delegation_status: null,
    delegation_notes: null,
    adaptive_reason: null,
    adjusted_start_at: null,
    adjusted_end_at: null,
    adjusted_duration_minutes: null,
    action_route: overrides.action_route || null,
    virtual: Boolean(overrides.virtual),
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

test('low capacity reduces only flexible workout duration', () => {
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
  assert.equal(workoutAdjustment?.automatic, true)
  assert.equal(workoutAdjustment?.applied, true)
  assert.equal(state.events.find((item) => item.id === 'workout')?.adjusted_duration_minutes, 30)
  assert.equal(state.events.find((item) => item.id === 'workout')?.adjusted_end_at, '2026-08-17T15:30:00.000Z')
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

  assert.equal(hydrationState.nextAction.action_route, '/dashboard/nutrition#hydration')

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

  assert.equal(mealState.nextAction.action_route, '/dashboard/nutrition#aos-food-logger')
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
