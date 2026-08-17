import type {
  DailyScheduleState,
  NextScheduleAction,
  OpenWindow,
  ScheduleAdjustment,
  ScheduleEvent,
} from './types'

export const ACTION_ROUTES: Record<string, string> = {
  workout: '/dashboard/program/ignite/workout',
  meal: '/dashboard/nutrition#aos-food-logger',
  hydration: '/dashboard/nutrition#hydration',
  recovery: '/dashboard/recovery',
  check_in: '/dashboard/check-in',
  assessment: '/dashboard/assessment/start',
  sleep: '/dashboard/sleep',
}

function minutesBetween(start: Date, end: Date) {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000))
}

function eventStart(event: ScheduleEvent) {
  return new Date(event.adjusted_start_at || event.start_at)
}

function eventEnd(event: ScheduleEvent) {
  return new Date(event.adjusted_end_at || event.end_at)
}

function isActionable(event: ScheduleEvent) {
  return !['cancelled', 'completed', 'skipped'].includes(event.status)
}

function canMove(event: ScheduleEvent) {
  return (
    event.flexibility_type === 'flexible' &&
    event.movable &&
    !event.approval_required &&
    event.status === 'scheduled'
  )
}

function isInternalControlled(event: ScheduleEvent) {
  return (
    ['anastasis', 'program', 'system', 'mobile'].includes(event.source) &&
    !event.external_event_id &&
    !event.external_calendar_source
  )
}

function canAutoApply(event: ScheduleEvent) {
  return canMove(event) && isInternalControlled(event)
}

function priorityRank(event: ScheduleEvent) {
  const ranks = { critical: 4, high: 3, medium: 2, low: 1 }
  return ranks[event.priority] || 0
}

export function getOpenWindows(
  events: ScheduleEvent[],
  dayStart: Date,
  dayEnd: Date,
  minimumMinutes = 10,
): OpenWindow[] {
  const occupied = events
    .filter((event) => event.status !== 'cancelled')
    .map((event) => [
      Math.max(dayStart.getTime(), eventStart(event).getTime()),
      Math.min(dayEnd.getTime(), eventEnd(event).getTime()),
    ] as const)
    .filter(([start, end]) => end > start)
    .sort((a, b) => a[0] - b[0])

  const merged: Array<[number, number]> = []
  for (const [start, end] of occupied) {
    const last = merged.at(-1)
    if (last && start <= last[1]) last[1] = Math.max(last[1], end)
    else merged.push([start, end])
  }

  const windows: OpenWindow[] = []
  let cursor = dayStart.getTime()
  for (const [start, end] of merged) {
    if (start - cursor >= minimumMinutes * 60000) {
      windows.push({
        start_at: new Date(cursor).toISOString(),
        end_at: new Date(start).toISOString(),
        minutes: Math.round((start - cursor) / 60000),
      })
    }
    cursor = Math.max(cursor, end)
  }

  if (dayEnd.getTime() - cursor >= minimumMinutes * 60000) {
    windows.push({
      start_at: new Date(cursor).toISOString(),
      end_at: dayEnd.toISOString(),
      minutes: Math.round((dayEnd.getTime() - cursor) / 60000),
    })
  }

  return windows
}

export function firstValidWindow(
  windows: OpenWindow[],
  event: ScheduleEvent,
  now: Date,
  durationMinutes: number,
): { start: Date; end: Date } | null {
  const earliest = event.earliest_start_at
    ? new Date(event.earliest_start_at)
    : now
  const latest = event.latest_end_at ? new Date(event.latest_end_at) : null

  for (const window of windows) {
    const start = new Date(window.start_at)
    const end = new Date(window.end_at)
    const usableStart = new Date(Math.max(start.getTime(), earliest.getTime(), now.getTime()))
    const usableEnd = new Date(usableStart.getTime() + durationMinutes * 60000)
    if (end >= usableEnd && (!latest || usableEnd <= latest)) {
      return { start: usableStart, end: usableEnd }
    }
  }

  return null
}

export function getActionRouteForEvent(event: ScheduleEvent, program = 'ignite') {
  if (event.action_route) return event.action_route
  if (event.event_type === 'workout') return `/dashboard/program/${program}/workout`
  return ACTION_ROUTES[event.event_type] || '/dashboard/schedule'
}

export function buildScheduleAdjustments({
  events,
  openWindows,
  now,
  capacity,
  recovery,
  symptoms,
}: {
  events: ScheduleEvent[]
  openWindows: OpenWindow[]
  now: Date
  capacity?: any
  recovery?: any
  symptoms?: any
}): ScheduleAdjustment[] {
  const lowCapacity =
    capacity?.status === 'low_capacity' ||
    recovery?.status === 'active_recovery' ||
    recovery?.status === 'full_recovery_or_red_flag' ||
    symptoms?.severity === 'moderate' ||
    symptoms?.severity === 'severe'

  const adjustments: ScheduleAdjustment[] = []

  if (lowCapacity) {
    const workout = events.find(
      (event) => event.event_type === 'workout' && canAutoApply(event),
    )
    if (workout) {
      const currentDuration =
        workout.estimated_duration_minutes ||
        minutesBetween(new Date(workout.start_at), new Date(workout.end_at))
      const suggestedDuration = Math.max(10, Math.min(currentDuration, 30))
      adjustments.push({
        event_id: workout.id,
        title: workout.title,
        adjustment_type: 'reduce_duration',
        reason:
          'Low recovery or capacity signals reduce flexible training load while preserving fixed obligations.',
        suggested_start_at: workout.start_at,
        suggested_end_at: new Date(
          new Date(workout.start_at).getTime() + suggestedDuration * 60000,
        ).toISOString(),
        suggested_duration_minutes: suggestedDuration,
        requires_approval: false,
        automatic: true,
        applied: true,
      })
    }

    if (!events.some((event) => event.event_type === 'recovery' && isActionable(event))) {
      const window = openWindows.find((item) => item.minutes >= 10)
      adjustments.push({
        event_id: 'suggested-recovery-block',
        title: 'Recovery buffer',
        adjustment_type: 'suggest_recovery',
        reason:
          'Low capacity signals call for a short recovery block before adding more output.',
        suggested_start_at: window?.start_at || now.toISOString(),
        suggested_end_at: window
          ? new Date(new Date(window.start_at).getTime() + 10 * 60000).toISOString()
          : new Date(now.getTime() + 10 * 60000).toISOString(),
        suggested_duration_minutes: 10,
        requires_approval: false,
        automatic: false,
        applied: false,
      })
    }
  }

  for (const event of events) {
    if (!canMove(event)) continue
    if (eventEnd(event) >= now || event.status !== 'scheduled') continue

    const duration =
      event.estimated_duration_minutes ||
      minutesBetween(new Date(event.start_at), new Date(event.end_at))
    const window = firstValidWindow(openWindows, event, now, duration)
    adjustments.push({
      event_id: event.id,
      title: event.title,
      adjustment_type: 'suggest_move',
      reason: 'This flexible item was missed; the next valid open window is suggested.',
      suggested_start_at: window?.start.toISOString() || null,
      suggested_end_at: window?.end.toISOString() || null,
      suggested_duration_minutes: duration,
      requires_approval: false,
      automatic: false,
      applied: false,
    })
  }

  return adjustments
}

export function applyAutomaticAdjustments(
  events: ScheduleEvent[],
  adjustments: ScheduleAdjustment[],
) {
  const automaticByEvent = new Map(
    adjustments
      .filter((item) => item.automatic && item.applied)
      .map((item) => [item.event_id, item]),
  )

  return events.map((event) => {
    const adjustment = automaticByEvent.get(event.id)
    if (!adjustment || !canAutoApply(event)) return event

    return {
      ...event,
      adjusted_start_at: adjustment.suggested_start_at || event.adjusted_start_at,
      adjusted_end_at: adjustment.suggested_end_at || event.adjusted_end_at,
      adjusted_duration_minutes:
        adjustment.suggested_duration_minutes || event.adjusted_duration_minutes,
      adaptive_reason: adjustment.reason,
    }
  })
}

export function buildNextAction({
  nextActionableEvent,
  adjustments,
  now,
  program = 'ignite',
}: {
  nextActionableEvent: ScheduleEvent | null
  adjustments: ScheduleAdjustment[]
  now: Date
  program?: string
}): NextScheduleAction {
  const recoverySuggestion = adjustments.find(
    (item) => item.adjustment_type === 'suggest_recovery',
  )
  if (recoverySuggestion && !nextActionableEvent) {
    return {
      id: recoverySuggestion.event_id,
      title: recoverySuggestion.title,
      category: 'recovery',
      start_at: recoverySuggestion.suggested_start_at,
      urgency: 'now',
      reason: recoverySuggestion.reason,
      action_route: '/dashboard/recovery',
      overdue: false,
      automatically_adjusted: false,
      can_complete: false,
      can_defer: false,
      short_reason: 'Low capacity calls for recovery before more output.',
    }
  }

  if (!nextActionableEvent) {
    return {
      id: 'none',
      title: 'No scheduled action',
      category: 'custom',
      start_at: null,
      urgency: 'none',
      reason: 'There are no remaining scheduled items for today.',
      action_route: null,
      overdue: false,
      automatically_adjusted: false,
      can_complete: false,
      can_defer: false,
      short_reason: 'No remaining scheduled items.',
    }
  }

  const start = eventStart(nextActionableEvent)
  const end = eventEnd(nextActionableEvent)
  const overdue = end < now
  const minutesUntil = Math.round((start.getTime() - now.getTime()) / 60000)
  const urgency = overdue
    ? 'overdue'
    : minutesUntil <= 0
      ? 'now'
      : minutesUntil <= 60
        ? 'soon'
        : 'upcoming'
  const adjustment = adjustments.find((item) => item.event_id === nextActionableEvent.id)
  const reason = adjustment?.reason || (overdue ? 'This scheduled item has passed and still needs attention.' : 'This is the next scheduled item that needs attention.')

  return {
    id: nextActionableEvent.id,
    title: nextActionableEvent.title,
    category: nextActionableEvent.event_type,
    start_at: nextActionableEvent.adjusted_start_at || nextActionableEvent.start_at,
    urgency,
    reason,
    action_route: getActionRouteForEvent(nextActionableEvent, program),
    overdue,
    automatically_adjusted: Boolean(adjustment?.automatic && adjustment.applied),
    can_complete: !nextActionableEvent.virtual && isActionable(nextActionableEvent),
    can_defer: !nextActionableEvent.virtual && canAutoApply(nextActionableEvent),
    short_reason: reason.length > 96 ? `${reason.slice(0, 93)}...` : reason,
  }
}

export function buildDailyScheduleState({
  date,
  timezone,
  now,
  dayStart,
  dayEnd,
  events,
  logic,
  program,
}: {
  date: string
  timezone: string
  now: Date
  dayStart: Date
  dayEnd: Date
  events: ScheduleEvent[]
  logic?: any
  program?: string
}): DailyScheduleState {
  const initiallySorted = [...events].sort((a, b) => eventStart(a).getTime() - eventStart(b).getTime())
  const initialOpenWindows = getOpenWindows(initiallySorted, dayStart, dayEnd, 10)
  const adjustments = buildScheduleAdjustments({
    events: initiallySorted,
    openWindows: initialOpenWindows,
    now,
    capacity: logic?.capacityStatus,
    recovery: logic?.recoveryStatus,
    symptoms: logic?.symptoms,
  })
  const sorted = applyAutomaticAdjustments(initiallySorted, adjustments)
    .sort((a, b) => eventStart(a).getTime() - eventStart(b).getTime())
  const completedEvents = sorted.filter((event) => event.status === 'completed')
  const remainingEvents = sorted.filter(isActionable)
  const upcomingEvents = remainingEvents.filter((event) => eventEnd(event) >= now)
  const overdueEvents = remainingEvents.filter((event) => eventEnd(event) < now)
  const fixedEvents = sorted.filter((event) => event.flexibility_type === 'fixed')
  const flexibleEvents = sorted.filter((event) => event.flexibility_type === 'flexible')
  const approvalRequiredEvents = sorted.filter((event) => event.flexibility_type === 'approval_required' || event.approval_required)
  const openWindows = getOpenWindows(sorted, dayStart, dayEnd, 10)
  const nextEvent = upcomingEvents[0] || null
  const nextActionableEvent =
    [...overdueEvents, ...upcomingEvents]
      .sort((a, b) => {
        if (eventEnd(a) < now && eventEnd(b) >= now) return -1
        if (eventEnd(a) >= now && eventEnd(b) < now) return 1
        return priorityRank(b) - priorityRank(a) || eventStart(a).getTime() - eventStart(b).getTime()
      })[0] || null

  return {
    date,
    timezone,
    now: now.toISOString(),
    events: sorted,
    completedEvents,
    upcomingEvents,
    overdueEvents,
    fixedEvents,
    flexibleEvents,
    approvalRequiredEvents,
    openWindows,
    adjustments,
    nextEvent,
    nextActionableEvent,
    nextAction: buildNextAction({
      nextActionableEvent,
      adjustments,
      now,
      program: program || logic?.program,
    }),
  }
}
