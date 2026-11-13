import type { ProgramLogicOutput } from './logic/types'
import type { TodayActivity, TodayActivityId } from './todayActivityTypes'
import type { DailyScheduleState, ScheduleEvent, ScheduleEventType } from '@/lib/schedule/types'
import { getActionRouteForEvent } from '@/lib/schedule/engine'
import { getLocalParts, zonedDateTimeToUtc } from '@/lib/schedule/time'
import { addLocalDays } from '@/lib/timezone'
import { getTierCapabilities } from '@/lib/entitlements'
import { isStrengthWorkout, strengthTrainingPaused } from '@/lib/assessment/strengthWorkoutState'

export type TodayDaySectionId = 'morning' | 'midday' | 'evening'
export type TodayDayItem = {
  id: string
  title: string
  detail: string
  href: string
  category: string
  status: string
  activityId?: TodayActivityId
  eventId?: string
  startAt: string | null
  endAt: string | null
  timing: 'scheduled' | 'suggested' | 'all_day' | 'untimed'
  continuesFromPreviousDay: boolean
}
export type TodayDaySections = {
  sections: Array<{ id: TodayDaySectionId; title: string; range: string; items: TodayDayItem[] }>
  untimed: TodayDayItem[]
  currentSection: TodayDaySectionId | null
  nextBoundaryAt: string | null
}

const activityByEventType: Partial<Record<ScheduleEventType, TodayActivityId>> = {
  check_in: 'check-in', hydration: 'water', meal: 'nutrition', workout: 'workout', recovery: 'recovery',
}

function isAssignedWorkoutEvent(event: ScheduleEvent, logic: ProgramLogicOutput, schedule: DailyScheduleState) {
  if (!event.virtual || event.calendar_event_id || event.external_event_id) return false
  if (event.id === `virtual-workout-${schedule.date}` && event.source === 'program') return true
  const strength = logic.assessments.strength
  return isStrengthWorkout(strength, schedule.date) && Boolean(event.action_route &&
    [strength?.href, strength?.workoutHref].includes(event.action_route))
}

/** These are Today's approved presentation boundaries, not scheduling rules. */
export function todayDaySectionAt(value: string | Date, timezone: string): TodayDaySectionId | null {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return null
  try {
    const { hour } = getLocalParts(date, timezone)
    return hour < 10 ? 'morning' : hour < 15 ? 'midday' : 'evening'
  } catch { return null }
}

function recoveryEventCompletion(event: ScheduleEvent, events: ScheduleEvent[], logic: ProgramLogicOutput, schedule: DailyScheduleState): 'completed' | 'incomplete' | 'unconfirmed' {
  const evidence = logic.execution.recoveryEvidence
  if (!evidence?.available || evidence.date !== schedule.date || evidence.clientId !== logic.client.id ||
    evidence.unlinkedRecordCount > 0 || schedule.unavailableSources?.length || event.all_day ||
    event.user_id !== evidence.ownerUserId || event.client_id !== evidence.clientId) return 'unconfirmed'
  const owned = events.filter(item => item.event_type === 'recovery' && item.user_id === evidence.ownerUserId &&
    item.client_id === evidence.clientId && item.status !== 'cancelled')
  const now = Date.parse(schedule.now)
  if (!Number.isFinite(now) || owned.some(item => {
    const start = Date.parse(item.adjusted_start_at || item.start_at)
    const end = Date.parse(item.adjusted_end_at || item.end_at)
    return !Number.isFinite(start) || !Number.isFinite(end) || end <= start
  })) return 'unconfirmed'
  let ambiguous = false
  for (const recorded of evidence.completedAt) {
    const at = Date.parse(recorded)
    if (!Number.isFinite(at) || at > now) continue
    const matching = owned.filter(item => {
      const start = Date.parse(item.adjusted_start_at || item.start_at)
      const end = Date.parse(item.adjusted_end_at || item.end_at)
      return Number.isFinite(start) && Number.isFinite(end) && start <= at && at < end
    })
    if (matching.length === 1 && !matching[0].all_day && matching[0].id === event.id) return 'completed'
    if (matching.length > 1 && matching.some(item => item.id === event.id)) ambiguous = true
  }
  return ambiguous ? 'unconfirmed' : 'incomplete'
}

/** A read-only full-day projection. Completion and available actions come from
 * the existing owner-bound Schedule and Today evidence, never the clock/pace. */
export function buildTodayDaySections(logic: ProgramLogicOutput, schedule: DailyScheduleState, activities: TodayActivity[]): TodayDaySections {
  const result: TodayDaySections = {
    sections: [
      { id: 'morning', title: 'Morning', range: 'Before 10:00 a.m.', items: [] },
      { id: 'midday', title: 'Midday', range: '10:00 a.m. – before 3:00 p.m.', items: [] },
      { id: 'evening', title: 'Evening', range: '3:00 p.m. onward', items: [] },
    ],
    untimed: [], currentSection: todayDaySectionAt(schedule.now, schedule.timezone), nextBoundaryAt: null,
  }
  let dayStart: number, dayEnd: number
  try {
    dayStart = zonedDateTimeToUtc(schedule.date, '00:00', schedule.timezone).getTime()
    dayEnd = zonedDateTimeToUtc(addLocalDays(schedule.date, 1), '00:00', schedule.timezone).getTime()
    const now = Date.parse(schedule.now)
    result.nextBoundaryAt = ['10:00', '15:00'].map(time => zonedDateTimeToUtc(schedule.date, time, schedule.timezone).getTime())
      .filter(at => Number.isFinite(at) && at > now).sort((left, right) => left - right)
      .map(at => new Date(at).toISOString())[0] || null
  } catch {
    dayStart = dayEnd = NaN
    result.currentSection = null
  }
  const capability = getTierCapabilities(logic.program)
  const byActivity = new Map(activities.map(activity => [activity.id, activity]))
  const represented = new Set<TodayActivityId>()
  // A saved event identity must appear only once, even if source projections overlap.
  const byEvent = new Map<string, ScheduleEvent>()
  for (const event of schedule.events) {
    if (!event.id || event.status === 'cancelled' || event.schedule_date && event.schedule_date !== schedule.date ||
      event.client_id && event.client_id !== logic.client.id) continue
    const previous = byEvent.get(event.id)
    if (!previous || event.status === 'completed') byEvent.set(event.id, event)
  }
  const events = [...byEvent.values()].filter(event => {
    const start = Date.parse(event.adjusted_start_at || event.start_at)
    const end = Date.parse(event.adjusted_end_at || event.end_at)
    return !Number.isFinite(dayStart) || !Number.isFinite(start) || !Number.isFinite(end) || end <= start || start < dayEnd && end > dayStart
  })
  const add = (item: TodayDayItem, start: number) => {
    const section = item.category === 'check_in' ? 'morning' : item.timing === 'all_day' || item.timing === 'untimed' ? null
      : todayDaySectionAt(new Date(Math.max(start, dayStart)), schedule.timezone)
    if (!section) result.untimed.push(item)
    else result.sections.find(part => part.id === section)!.items.push(item)
  }
  for (const event of events) {
    const assignedWorkout = event.event_type === 'workout' && isAssignedWorkoutEvent(event, logic, schedule)
    const id = event.event_type === 'assessment' ? `assessment:${event.id}` as TodayActivityId
      : event.event_type === 'workout' && !assignedWorkout ? undefined : activityByEventType[event.event_type]
    const activity = byActivity.get(event.event_type === 'workout' ? 'workout' : id!)
    if (event.event_type === 'meal' && !capability.nutritionTracking || event.event_type === 'workout' && !capability.workoutDisplay ||
      event.event_type === 'recovery' && !capability.recoveryBasic || event.event_type === 'assessment' && !capability.assessmentsView) continue
    if (id) represented.add(id)
    // A daily nutrition log is not evidence that every saved meal is complete.
    // Recovery likewise requires its own event or unique recorded window.
    const dailyComplete = activity?.status === 'completed' && !['meal', 'recovery', 'workout'].includes(event.event_type)
    const recoveryCompletion = event.event_type === 'recovery' ? recoveryEventCompletion(event, events, logic, schedule) : null
    if (event.status === 'completed' || dailyComplete || recoveryCompletion === 'completed') continue
    const start = Date.parse(event.adjusted_start_at || event.start_at)
    const end = Date.parse(event.adjusted_end_at || event.end_at)
    const timed = !event.all_day && Number.isFinite(start) && Number.isFinite(end) && end > start
    const safetyHeld = event.event_type === 'workout' && (strengthTrainingPaused(logic) || !logic.workoutDecision.canTrain && !activity)
    const detail = safetyHeld ? 'Training is paused. Review your existing recovery guidance before choosing movement.'
      : recoveryCompletion === 'unconfirmed' ? 'This recovery block’s completion could not be confirmed. Open recovery to review it.'
        : event.event_type === 'workout' && (!assignedWorkout || activity?.status === 'completed') ? event.description || 'This saved workout is not confirmed complete. Open its workout flow to review or log it.'
        : event.description || activity?.detail || 'Your saved commitment.'
    add({ id: `event:${event.id}`, eventId: event.id, ...(id ? { activityId: id } : {}), title: event.title,
      detail, href: safetyHeld ? '/dashboard/recovery' : getActionRouteForEvent(event, logic.program),
      category: event.event_type, status: event.status, startAt: timed ? new Date(start).toISOString() : null,
      endAt: timed ? new Date(end).toISOString() : null,
      timing: event.all_day ? 'all_day' : timed ? event.suggested ? 'suggested' : 'scheduled' : 'untimed',
      continuesFromPreviousDay: timed && start < dayStart,
    }, start)
  }
  for (const activity of activities) {
    const evidence = logic.execution.generatedWorkoutCompletion
    const generatedAction = activity.id === 'workout' && !isStrengthWorkout(logic.assessments.strength, schedule.date) &&
      evidence?.date === schedule.date && evidence.clientId === logic.client.id && evidence.dayName && evidence.planKeys.length > 0
    const completed = generatedAction ? Boolean(evidence.sessionId) : activity.status === 'completed'
    if (activity.id === 'schedule' || completed || represented.has(activity.id)) continue
    const unconfirmedGenerated = generatedAction && activity.status === 'completed'
    const workoutHeld = activity.id === 'workout' && strengthTrainingPaused(logic)
    add({ id: `activity:${activity.id}`, activityId: activity.id, title: activity.title,
      detail: workoutHeld ? 'Training is paused. Review your existing recovery guidance before choosing movement.'
        : unconfirmedGenerated ? 'This day’s generated workout is still available. Its own completion has not been confirmed.' : activity.detail,
      href: workoutHeld ? '/dashboard/recovery' : activity.href, category: activity.category, status: unconfirmedGenerated ? 'available' : activity.status, startAt: null, endAt: null,
      timing: 'untimed', continuesFromPreviousDay: false }, NaN)
  }
  for (const section of result.sections) section.items.sort((left, right) => Date.parse(left.startAt!) - Date.parse(right.startAt!) || left.id.localeCompare(right.id))
  return result
}
