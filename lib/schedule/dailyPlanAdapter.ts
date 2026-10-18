import { mealEntryHref } from '@/lib/nutrition/loggingRoutes'
import type { ScheduleEvent } from './types'
import { zonedDateTimeToUtc } from './time'
import { addLocalDays } from '@/lib/timezone'
import { getCommitmentWeekdays, type CommitmentDayField } from '@/lib/assessment/commitmentWeekdays'

function commitmentOccursOn(client: any, field: CommitmentDayField, date: string) {
  const days = getCommitmentWeekdays(client, field)
  // The supplied date is already the member's local calendar date. Parsing at
  // UTC noon avoids interpreting it in the browser or server's timezone.
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay()
  return days === undefined || days.includes(weekday)
}

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
    action_route: `/dashboard/schedule?date=${date}#event-${id}`,
  }
}

export function dailyPlanToScheduleEvents({
  userId,
  client,
  dailyPlan,
  includeHealthActivities = true,
}: {
  userId: string
  client: any
  dailyPlan: any
  includeHealthActivities?: boolean
}): ScheduleEvent[] {
  const date = dailyPlan.date
  const timezone = dailyPlan.timezone || dailyPlan.timing?.timezone || 'America/Chicago'
  const events: ScheduleEvent[] = []

  if (client.work_start_time && client.work_end_time && commitmentOccursOn(client, 'work_days_of_week', date)) {
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

  if (client.school_dropoff_time && commitmentOccursOn(client, 'school_dropoff_days_of_week', date)) {
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

  if (client.school_pickup_time && commitmentOccursOn(client, 'school_pickup_days_of_week', date)) {
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

  if (!includeHealthActivities) return events

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
      completed_at: dailyPlan.completedWorkoutAt || null,
      suggested: !dailyPlan.workoutCompleted,
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

  for (const [key, label, time, route] of [
    ['midday', 'Lunch and hydration', client.lunch_window_time, mealEntryHref(client.program, 'lunch')],
    ['evening', 'Dinner and recovery landing', client.dinner_window_time, '/dashboard/day/evening'],
  ] as const) {
    if (!time) continue
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
      completed_at: null,
      suggested: !complete,
      flexibility_type: 'flexible',
      priority: 'medium',
      required: false,
      movable: true,
      approval_required: false,
      earliest_start_at: addMinutes(start, -120).toISOString(),
      latest_end_at: addMinutes(start, 180).toISOString(),
      action_route: route,
    })
  }

  return events
}

export function recurringCommitmentsToEvents({ userId, client, date, timezone, blocks }: { userId: string; client: any; date: string; timezone: string; blocks: any[] }): ScheduleEvent[] {
  const result: ScheduleEvent[] = []
  for (const localDate of [addLocalDays(date, -1), date]) {
    const weekday = new Date(`${localDate}T12:00:00Z`).getUTCDay()
    for (const block of blocks) {
      if (block.active === false || !block.days_of_week?.includes(weekday)) continue
      const startTime = String(block.start_time).slice(0, 5), endTime = String(block.end_time).slice(0, 5)
      const overnight = endTime <= startTime
      if (localDate !== date && !overnight) continue
      const endDate = overnight ? addLocalDays(localDate, 1) : localDate
      const start = zonedDateTimeToUtc(localDate, startTime, timezone), end = zonedDateTimeToUtc(endDate, endTime, timezone)
      const type = block.block_type === 'work' ? 'work' : block.block_type === 'sleep' ? 'sleep' : block.block_type.startsWith('school') ? 'school' : block.block_type === 'appointment' ? 'appointment' : 'personal'
      result.push({ ...fixedEvent({ id: `commitment-${block.id || block.block_type}-${localDate}`, userId, clientId: client.client_id,
        title: block.label || String(block.block_type).replaceAll('_', ' '), eventType: type, date: localDate, time: startTime, timezone, minutes: (end.getTime()-start.getTime())/60000 }), end_at: end.toISOString() })
    }
  }
  return result
}

/** One projection is shared by the daily schedule, availability and calendar. */
export function fixedCommitmentsForDate({ userId, client, date, timezone, blocks }: { userId: string; client: any; date: string; timezone: string; blocks: any[] }): ScheduleEvent[] {
  // A saved recurring template remains authoritative on its excluded days too.
  // Drop-off and pickup have distinct identities even though both are school.
  const templateKinds = new Set(blocks.filter(block => block.active !== false).map(block => block.block_type))
  const profile = [addLocalDays(date, -1), date].flatMap(originDate =>
    dailyPlanToScheduleEvents({ userId, client, dailyPlan: { date: originDate, timezone, timing: {} }, includeHealthActivities: false })
      .filter(event => {
        const kind = event.id === `virtual-work-${originDate}` ? 'work'
          : event.id === `virtual-school-dropoff-${originDate}` ? 'school_dropoff' : 'school_pickup'
        return !templateKinds.has(kind)
      }))
  const dayStart = zonedDateTimeToUtc(date, '00:00', timezone).getTime()
  const dayEnd = zonedDateTimeToUtc(addLocalDays(date, 1), '00:00', timezone).getTime()
  // A late anchor still belongs to its selected start day, even when part of
  // that occurrence continues into this day. Exact-midnight endings do not.
  return [...recurringCommitmentsToEvents({ userId, client, date, timezone, blocks }), ...profile]
    .filter(event => Date.parse(event.start_at) < dayEnd && Date.parse(event.end_at) > dayStart)
}
