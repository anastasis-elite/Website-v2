import type { ScheduleEvent } from './types'
import { zonedDateTimeToUtc } from './time'

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60000)
}

function fixedEvent({
  id,
  userId,
  clientId,
  title,
  eventType,
  date,
  time,
  timezone,
  minutes,
}: {
  id: string
  userId: string
  clientId: string
  title: string
  eventType: ScheduleEvent['event_type']
  date: string
  time: string
  timezone: string
  minutes: number
}): ScheduleEvent {
  const start = zonedDateTimeToUtc(date, time, timezone)
  return {
    id,
    user_id: userId,
    client_id: clientId,
    title,
    description: null,
    event_type: eventType,
    source: 'anastasis',
    start_at: start.toISOString(),
    end_at: addMinutes(start, minutes).toISOString(),
    timezone,
    all_day: false,
    status: 'scheduled',
    completed_at: null,
    flexibility_type: 'fixed',
    priority: 'high',
    required: true,
    movable: false,
    approval_required: true,
    earliest_start_at: null,
    latest_end_at: null,
    preferred_time: time,
    estimated_duration_minutes: minutes,
    external_provider_name: null,
    external_contact_type: null,
    external_contact_value: null,
    external_event_id: null,
    external_calendar_source: null,
    reschedule_allowed: false,
    reschedule_requires_approval: true,
    last_reschedule_requested_at: null,
    delegation_status: null,
    delegation_notes: null,
    adaptive_reason: null,
    adjusted_start_at: null,
    adjusted_end_at: null,
    adjusted_duration_minutes: null,
    virtual: true,
    action_route: null,
  }
}

export function dailyPlanToScheduleEvents({
  userId,
  client,
  dailyPlan,
}: {
  userId: string
  client: any
  dailyPlan: any
}): ScheduleEvent[] {
  const date = dailyPlan.date
  const timezone = dailyPlan.timezone || dailyPlan.timing?.timezone || 'America/Chicago'
  const events: ScheduleEvent[] = []

  if (client.work_start_time && client.work_end_time) {
    const start = zonedDateTimeToUtc(date, String(client.work_start_time).slice(0, 5), timezone)
    const end = zonedDateTimeToUtc(date, String(client.work_end_time).slice(0, 5), timezone)
    if (end > start) {
      events.push({
        ...fixedEvent({
          id: `virtual-work-${date}`,
          userId,
          clientId: client.client_id,
          title: 'Work block',
          eventType: 'work',
          date,
          time: String(client.work_start_time).slice(0, 5),
          timezone,
          minutes: Math.round((end.getTime() - start.getTime()) / 60000),
        }),
        end_at: end.toISOString(),
      })
    }
  }

  if (client.school_dropoff_time) {
    events.push(fixedEvent({
      id: `virtual-school-dropoff-${date}`,
      userId,
      clientId: client.client_id,
      title: 'School drop-off',
      eventType: 'school',
      date,
      time: String(client.school_dropoff_time).slice(0, 5),
      timezone,
      minutes: 30,
    }))
  }

  if (client.school_pickup_time) {
    events.push(fixedEvent({
      id: `virtual-school-pickup-${date}`,
      userId,
      clientId: client.client_id,
      title: 'School pickup',
      eventType: 'school',
      date,
      time: String(client.school_pickup_time).slice(0, 5),
      timezone,
      minutes: 30,
    }))
  }

  const workoutTime = dailyPlan.timing?.workoutTime || client.preferred_workout_time
  if (workoutTime) {
    const minutes = Math.max(10, Number(client.current_workout_minutes_per_session || 30))
    events.push({
      ...fixedEvent({
        id: `virtual-workout-${date}`,
        userId,
        clientId: client.client_id,
        title: 'Today’s workout',
        eventType: 'workout',
        date,
        time: String(workoutTime).slice(0, 5),
        timezone,
        minutes,
      }),
      source: 'program',
      status: dailyPlan.workoutCompleted ? 'completed' : 'scheduled',
      completed_at: dailyPlan.workoutCompleted ? new Date().toISOString() : null,
      flexibility_type: 'flexible',
      priority: 'high',
      required: false,
      movable: true,
      approval_required: false,
      earliest_start_at: zonedDateTimeToUtc(date, '05:00', timezone).toISOString(),
      latest_end_at: zonedDateTimeToUtc(date, '21:30', timezone).toISOString(),
      action_route: `/dashboard/program/${client.program || 'ignite'}/workout`,
    })
  }

  const hydrationTime = client.wake_time || '08:00'
  const hydrationStart = zonedDateTimeToUtc(date, String(hydrationTime).slice(0, 5), timezone)
  const hydrationRemaining = Number(dailyPlan.dailyRemaining?.water ?? 1)
  const hydrationTarget = Number(dailyPlan.dailyTargets?.water ?? hydrationRemaining)
  events.push({
    ...fixedEvent({
      id: `virtual-hydration-${date}`,
      userId,
      clientId: client.client_id,
      title: 'Hydration quick add',
      eventType: 'hydration',
      date,
      time: String(hydrationTime).slice(0, 5),
      timezone,
      minutes: 10,
    }),
    source: 'program',
    status:
      hydrationTarget > 0 && hydrationRemaining <= hydrationTarget * 0.15
        ? 'completed'
        : 'scheduled',
    completed_at:
      hydrationTarget > 0 && hydrationRemaining <= hydrationTarget * 0.15
        ? new Date().toISOString()
        : null,
    flexibility_type: 'flexible',
    priority: 'high',
    required: true,
    movable: true,
    approval_required: false,
    earliest_start_at: addMinutes(hydrationStart, -60).toISOString(),
    latest_end_at: zonedDateTimeToUtc(date, '21:00', timezone).toISOString(),
    action_route: '/dashboard/nutrition#hydration',
  })

  for (const [key, label, time, route] of [
    ['morning', 'Morning fuel', client.wake_time || '08:00', '/dashboard/nutrition#aos-food-logger'],
    ['midday', 'Lunch and hydration', client.lunch_window_time || '12:00', '/dashboard/nutrition#aos-food-logger'],
    ['evening', 'Dinner and recovery landing', client.dinner_window_time || '18:00', '/dashboard/day/evening'],
  ] as const) {
    const complete = dailyPlan.completedDailyTasks?.includes(`${key}-complete`)
    const start = zonedDateTimeToUtc(date, String(time).slice(0, 5), timezone)
    events.push({
      ...fixedEvent({
        id: `virtual-${key}-${date}`,
        userId,
        clientId: client.client_id,
        title: label,
        eventType: key === 'evening' ? 'recovery' : 'meal',
        date,
        time: String(time).slice(0, 5),
        timezone,
        minutes: 30,
      }),
      source: 'program',
      status: complete ? 'completed' : 'scheduled',
      completed_at: complete ? new Date().toISOString() : null,
      flexibility_type: 'flexible',
      priority: key === 'morning' ? 'high' : 'medium',
      required: key !== 'evening',
      movable: true,
      approval_required: false,
      earliest_start_at: addMinutes(start, -120).toISOString(),
      latest_end_at: addMinutes(start, 180).toISOString(),
      action_route: route,
    })
  }

  return events
}
