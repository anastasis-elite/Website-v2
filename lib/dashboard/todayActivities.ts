import { getTierCapabilities } from '@/lib/entitlements'
import type { ProgramLogicOutput, StreakItem } from './logic/types'
import type { DailyScheduleState, ScheduleEventType } from '@/lib/schedule/types'
import { mealEntryHref, WATER_ENTRY_HREF } from '@/lib/nutrition/loggingRoutes'
import { getScheduleStructureVersion, scheduleStructureTaskHref } from '@/lib/assessment/scheduleStructure'
import { getScheduleEventCapabilities, healthEventTypes, isInformationalScheduleEvent } from '@/lib/schedule/actions'
import { getActionRouteForEvent } from '@/lib/schedule/engine'

export const TODAY_ACTIVITY_IDS = ['check-in', 'water', 'schedule', 'nutrition', 'workout', 'recovery'] as const
export type TodayActivityId = typeof TODAY_ACTIVITY_IDS[number] | `assessment:${string}` | `schedule-event:${string}`
export type TodayActivityStatus = 'available' | 'upcoming' | 'in_progress' | 'completed' | 'deferred' | 'skipped'
export type DailyGuidePreference = { status: 'deferred' | 'skipped' | 'reviewed'; until?: string }
export type DailyGuideState = { date: string; activities: Partial<Record<TodayActivityId, DailyGuidePreference>> }
export type TodayActivity = {
  id: TodayActivityId
  category: string
  title: string
  detail: string
  href: string
  status: TodayActivityStatus
  countsTowardProgress: boolean
  canSkip: boolean
  canDefer: boolean
  canResume: boolean
  deferredUntil?: string
}
export type TodayActivities = { activities: TodayActivity[]; completed: number; total: number }

export function readDailyGuide(value: unknown, date: string): DailyGuideState {
  const guide = value as Partial<DailyGuideState> | null
  const activities: DailyGuideState['activities'] = {}
  if (guide?.date === date && guide.activities && typeof guide.activities === 'object') {
    for (const id of TODAY_ACTIVITY_IDS) {
      const preference = guide.activities[id]
      if (!preference || !['deferred', 'skipped', 'reviewed'].includes(preference.status)) continue
      if (preference.status === 'reviewed' && id !== 'schedule') continue
      if (preference.status === 'deferred' && (!preference.until || !Number.isFinite(Date.parse(preference.until)))) continue
      activities[id] = { status: preference.status, ...(preference.until ? { until: preference.until } : {}) }
    }
  }
  return { date, activities }
}

const requirementById: Partial<Record<TodayActivityId, StreakItem>> = {
  'check-in': 'dailyCheckIn', water: 'hydration', nutrition: 'nutrition', workout: 'workoutOrMovement', recovery: 'recovery',
}
const eventTypeById: Partial<Record<TodayActivityId, ScheduleEventType>> = {
  'check-in': 'check_in', water: 'hydration', nutrition: 'meal', workout: 'workout', recovery: 'recovery',
}

// A presentation adapter for recorded actions; it never changes targets or readiness.
export function buildTodayActivities(logic: ProgramLogicOutput, schedule: Pick<DailyScheduleState, 'date' | 'timezone' | 'now' | 'events' | 'dailyGuide'>): TodayActivities {
  const capabilities = getTierCapabilities(logic.program)
  const guide = readDailyGuide(schedule.dailyGuide, schedule.date)
  const now = Date.parse(schedule.now)
  const required: Partial<Record<StreakItem, boolean>> = logic.flameState?.requirements?.requiredItems || { dailyCheckIn: true }
  const activities: TodayActivity[] = []
  const add = (id: TodayActivityId, title: string, detail: string, href: string, complete: boolean, inProgress = false) => {
    const requirement = requirementById[id]
    const countsTowardProgress = Boolean(requirement && required[requirement])
    const safetyRecovery = id === 'recovery' && logic.symptoms.redFlag
    const preference = guide.activities[id]
    const events = schedule.events.filter(event => event.event_type === eventTypeById[id] && event.status !== 'cancelled')
    const acceptedLater = events.find(event => !['completed', 'skipped'].includes(event.status) && !event.suggested &&
      Boolean(event.adjusted_start_at || event.status === 'deferred') && Date.parse(event.adjusted_start_at || event.start_at) > now)
    const skippedBySchedule = events.length > 0 && events.every(event => event.status === 'skipped')
    const heldByGuide = preference?.status === 'skipped' || (preference?.status === 'deferred' && Date.parse(preference.until!) > now)
    let status: TodayActivityStatus = complete ? 'completed' : inProgress ? 'in_progress' : 'available'
    let deferredUntil: string | undefined
    if (!complete && !safetyRecovery) {
      if (preference?.status === 'skipped' || skippedBySchedule) status = 'skipped'
      else if (preference?.status === 'deferred' && Date.parse(preference.until!) > now) {
        status = 'deferred'
        deferredUntil = preference.until
      } else if (acceptedLater) {
        status = 'deferred'
        deferredUntil = acceptedLater.adjusted_start_at || acceptedLater.start_at
      } else if (!inProgress && id === 'workout' && events.length > 0 && events.every(event => Date.parse(event.adjusted_start_at || event.start_at) > now)) status = 'upcoming'
    }
    activities.push({ id, category: id === 'water' ? 'hydration' : id === 'check-in' ? 'check_in' : id,
      title, detail, href, status, countsTowardProgress, canSkip: !complete && !countsTowardProgress && !safetyRecovery,
      canDefer: !complete && !safetyRecovery,
      canResume: !complete && !safetyRecovery && Boolean(heldByGuide) && !acceptedLater && !skippedBySchedule,
      ...(deferredUntil ? { deferredUntil } : {}) })
  }
  add('check-in', 'Daily check-in', logic.assessments.dailyCompleted ? 'Your check-in is saved.' : 'Start with how you feel. The other questions can wait.', '/dashboard/check-in', logic.assessments.dailyCompleted)
  if (Number.isFinite(logic.hydration.target) && logic.hydration.target > 0) {
    const complete = logic.hydration.status !== 'needs_input' && logic.hydration.remaining <= 0
    add('water', 'Hydration', complete ? 'Your recorded water meets today’s target.' : logic.hydration.consumed > 0 ? `${Math.round(logic.hydration.consumed)} oz saved. Add what you drink when it suits you.` : 'Add the water you have already had.', WATER_ENTRY_HREF, complete, logic.hydration.consumed > 0)
  }
  if (capabilities.calendar) add('schedule', 'Schedule review', 'See your commitments and leave room for the rest.', '/dashboard/schedule', guide.activities.schedule?.status === 'reviewed')
  for (const event of schedule.events) {
    if (getScheduleStructureVersion(event) === null || ['cancelled', 'skipped'].includes(event.status)) continue
    const complete = event.status === 'completed'
    activities.push({ id: `assessment:${event.id}`, category: 'assessment', title: event.title,
      detail: complete ? 'Your assessment is submitted and saved.' : 'Submit your daily rhythm and training capacity to complete this assessment.',
      href: scheduleStructureTaskHref(event)!, status: complete ? 'completed' : 'available',
      countsTowardProgress: true, canSkip: false, canDefer: false, canResume: false })
  }
  for (const event of schedule.events) {
    if (!event.required || event.suggested || event.status === 'cancelled' || healthEventTypes.has(event.event_type) || isInformationalScheduleEvent(event)) continue
    const capabilities = getScheduleEventCapabilities(event)
    const complete = event.status === 'completed'
    const later = Date.parse(event.adjusted_start_at || event.start_at) > now
    activities.push({ id: `schedule-event:${event.id}`, category: event.event_type, title: event.title,
      detail: complete ? 'Your completion is saved.' : event.status === 'skipped' ? 'Skipped; this does not count as completed.' : later ? 'Saved for its scheduled time.' : 'Record what happened or choose a supported new time.',
      href: getActionRouteForEvent(event, logic.program), status: complete ? 'completed' : event.status === 'skipped' ? 'skipped' : later ? 'upcoming' : 'available',
      countsTowardProgress: true, canSkip: capabilities.canSkip, canDefer: capabilities.canReschedule, canResume: false })
  }
  if (capabilities.nutritionTracking) add('nutrition', capabilities.nutritionMealLogging ? 'Meal logging' : 'Nutrition', logic.execution.nutritionLogged ? 'Today’s intake is saved. You can add more whenever you need.' : capabilities.nutritionMealLogging ? 'Log your next meal or reuse a saved entry.' : 'Your guidance and quick macro entry are available.', mealEntryHref(logic.program), logic.execution.nutritionLogged)
  if (capabilities.workoutDisplay && (logic.execution.workoutComplete || (logic.workout.assigned && logic.workoutDecision.canTrain))) {
    add('workout', 'Movement', logic.execution.workoutComplete ? 'Your completed workout is saved.' : logic.execution.workoutInProgress ? 'Your saved workout is ready to resume.' : logic.workoutDecision.reasonForModification,
      `/dashboard/program/${logic.program}/workout`, logic.execution.workoutComplete, Boolean(logic.execution.workoutInProgress))
  }
  if (capabilities.recoveryBasic) add('recovery', 'Recovery', logic.execution.recoveryComplete ? 'Your recovery activity is saved.' : capabilities.recoveryRecommendation ? 'Choose from your existing recovery options.' : 'A quiet moment is available when you need it.', '/dashboard/recovery', logic.execution.recoveryComplete)
  const counted = activities.filter(activity => activity.countsTowardProgress)
  return { activities, completed: counted.filter(activity => activity.status === 'completed').length, total: counted.length }
}
