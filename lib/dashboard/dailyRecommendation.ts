import type { ProgramLogicOutput } from './logic/types'
import type { DailyScheduleState } from '@/lib/schedule/types'
import { getActionRouteForEvent, selectNextScheduleEvent } from '@/lib/schedule/engine'
import { isInformationalScheduleEvent } from '@/lib/schedule/actions'
import { getDailyTraining, type DailyTraining } from './dailyTraining'
import { buildTodayActivities, type TodayActivityId } from './todayActivities'
import { getLocalDaypart } from '@/lib/timezone'
import { mealEntryHref, WATER_ENTRY_HREF } from '@/lib/nutrition/loggingRoutes'

export type DataAvailability = 'not_logged' | 'partial' | 'confirmed' | 'completed'
export type DailyRecommendationAction = {
  id: string; category: string; title: string; reason: string; href: string
  availability: DataAvailability; eventId?: string; completed: boolean
}
export type DailyRecommendation = {
  date: string; timezone: string; generatedAt: string
  primary: DailyRecommendationAction; supporting: DailyRecommendationAction[]
  training: DailyTraining
  evidence: { food: DataAvailability; water: DataAvailability; workout: DataAvailability; checkIn: DataAvailability }
}

// This coordinates existing decisions. It does not calculate a health score or change doses.
export function buildDailyRecommendation(logic: ProgramLogicOutput, schedule: DailyScheduleState): DailyRecommendation {
  const food: DataAvailability = logic.nutrition.dataStatus === 'needs_input' ? 'not_logged' :
    logic.nutrition.calories.percent >= 95 && logic.nutrition.protein.percent >= 90 ? 'confirmed' : 'partial'
  const water: DataAvailability = logic.hydration.status === 'needs_input' ? 'not_logged' :
    logic.hydration.remaining <= 0 ? 'completed' : 'partial'
  const workout: DataAvailability = logic.execution.workoutComplete ? 'completed' : logic.execution.workoutInProgress ? 'partial' : 'not_logged'
  const checkIn: DataAvailability = logic.assessments.dailyCompleted ? 'completed' : 'not_logged'
  const today = buildTodayActivities(logic, schedule)
  const guideId = (id: string): TodayActivityId | undefined => id === 'food-input' ? 'nutrition' :
    ['check-in', 'water', 'schedule', 'workout', 'recovery'].includes(id) ? id as TodayActivityId : undefined
  const held = (id: string) => {
    const activity = today.activities.find(item => item.id === guideId(id))
    return activity?.status === 'deferred' || activity?.status === 'skipped'
  }
  const eventActivityId = (category: string) => category === 'check_in' ? 'check-in' : category === 'hydration' ? 'water' :
    category === 'workout' || category === 'recovery' ? category : undefined
  const eventUnavailable = (category: string) => {
    const id = eventActivityId(category)
    const activity = today.activities.find(item => item.id === id)
    return Boolean(id && (held(id) || activity?.status === 'completed'))
  }
  const candidates: DailyRecommendationAction[] = []
  const add = (id: string, category: string, title: string, reason: string, href: string, availability: DataAvailability, eventId?: string) => {
    if (id !== 'safety' && held(id)) return
    if (eventId && eventUnavailable(category)) return
    if (schedule.dailyGuide && guideId(id) && !today.activities.some(activity => activity.id === guideId(id))) return
    candidates.push({ id, category, title, reason, href, availability, eventId, completed: availability === 'completed' })
  }
  if (logic.symptoms.redFlag) {
    add('safety', 'recovery', 'Review today’s recovery guidance', logic.recoveryStatus.reasoning, '/dashboard/recovery', 'confirmed')
  }
  if (checkIn !== 'completed') {
    add('check-in', 'check_in', 'Daily check-in', 'Start with your energy. Your answers help today’s plan fit your actual capacity.', '/dashboard/check-in', 'not_logged')
  }
  if (!logic.workoutDecision.canTrain && !logic.symptoms.redFlag) {
    add('safety', 'recovery', 'Review today’s recovery guidance', logic.recoveryStatus.reasoning, '/dashboard/recovery', 'confirmed')
  }
  if (food === 'not_logged') {
    add('food-input', 'nutrition', logic.program === 'ember' ? 'Review your next meal' : 'Log your latest meal',
      logic.program === 'ember' ? 'Your nutrition guidance is ready when you need it.' : 'No food is logged today. That does not tell us what you’ve eaten.', mealEntryHref(logic.program), 'not_logged')
  }
  if (water !== 'completed' && !schedule.events.some(e => e.event_type === 'hydration' && e.status === 'skipped')) add('water', 'hydration', water === 'not_logged' ? 'Log the water you’ve had' : 'Have a little water when it suits you',
    water === 'not_logged' ? 'Water intake is not logged yet. Add what you’ve had so the plan can use it.' : `${Math.round(logic.hydration.consumed)} oz logged. Keep drinking steadily; you do not need to catch up all at once.`, WATER_ENTRY_HREF, water)
  const scheduleReview = today.activities.find(activity => activity.id === 'schedule')
  if (schedule.dailyGuide && scheduleReview?.status !== 'completed' && schedule.events.some(event => !event.suggested &&
    ['work', 'school', 'appointment', 'medical', 'dental', 'personal', 'household', 'custom'].includes(event.event_type) && !event.dismissed_from_today && !['completed', 'cancelled', 'skipped'].includes(event.status))) {
    add('schedule', 'schedule', 'Make a little room in your day', 'Review your saved commitments and choose what can wait.', '/dashboard/schedule', 'confirmed')
  }
  if (workout !== 'completed' && !schedule.events.some(e => e.event_type === 'workout' && e.status === 'skipped') && logic.workout.assigned && logic.workoutDecision.canTrain) {
    add('workout', 'workout', workout === 'partial' ? 'Resume today’s workout' : food === 'not_logged' ? 'Review today’s workout' : logic.workoutDecision.adjustmentLevel === 'level_0_full_plan' ? 'Open today’s workout' : 'A lighter workout fits today',
      logic.program === 'ember' ? `${logic.workoutDecision.reasonForModification} Meal intake is not tracked in EMBER; use your meal guidance and how you feel.` : food === 'not_logged' ? 'Food is not logged yet. Review the workout options and choose what fits how you feel.' : food === 'partial' ? 'Food is partly logged. Check that the plan fits how you feel before starting.' : logic.workoutDecision.reasonForModification,
      `/dashboard/program/${logic.program}/workout`, workout)
  }
  const evening = getLocalDaypart(new Date(schedule.now), schedule.timezone) === 'evening'
  if ((workout === 'completed' || evening || logic.capacityStatus?.status === 'low_capacity') && !logic.execution.recoveryComplete) add('recovery', 'recovery', 'Choose a recovery moment',
    workout === 'completed' ? `A completed workout is recorded${logic.execution.completedWorkoutTitle ? `: ${logic.execution.completedWorkoutTitle}` : ' today'}. Recovery options are available.` : 'Choose from the recovery options already available in your plan.', '/dashboard/recovery', 'confirmed')
  // Commitments and overdue items remain actionable even when food is not logged.
  const next = selectNextScheduleEvent(schedule.events.filter(event => !event.suggested &&
    (isInformationalScheduleEvent(event) || (!['hydration','meal'].includes(event.event_type) && !eventUnavailable(event.event_type))) &&
    !(event.event_type === 'workout' && new Date(event.adjusted_start_at || event.start_at) > new Date(schedule.now) && event.adjusted_start_at)), new Date(schedule.now))
  if (next) {
    const overdue = new Date(next.adjusted_end_at || next.end_at) <= new Date(schedule.now)
    const context = overdue ? isInformationalScheduleEvent(next) ? 'This calendar event has passed. Open it or dismiss it from Today.' : 'This item is overdue. Complete it, skip it, or choose a supported new time.' : 'This fits the next part of your schedule.'
    const action = { id: next.id, category: next.event_type, title: next.title, reason: `${next.source_label ? next.source_label + '. ' : ''}${context}`,
      href: getActionRouteForEvent(next, logic.program), availability: 'confirmed' as const, eventId: next.id, completed: false }
    const required = candidates.findIndex(candidate => !['safety', 'check-in'].includes(candidate.id) && !candidate.eventId)
    candidates.splice(required < 0 ? candidates.length : required, 0, action)
  }
  // The existing recommendation keeps safety and current commitments first.
  // For the guided view, the remaining choices follow a quiet daily sequence.
  {
    const order = evening || logic.capacityStatus?.status === 'low_capacity'
      ? ['check-in', 'recovery', 'water', 'schedule', 'food-input', 'workout']
      : ['check-in', 'water', 'schedule', 'food-input', 'workout', 'recovery']
    candidates.sort((a, b) => {
      const rank = (action: DailyRecommendationAction) => {
        if (action.id === 'safety') return logic.symptoms.redFlag ? -100 : -35
        // The available daily check-in retains its established first-entry flow.
        if (action.id === 'check-in') return -40
        if (action.eventId) {
          const event = schedule.events.find(item => item.id === action.eventId)!
          const now = Date.parse(schedule.now), start = Date.parse(event.adjusted_start_at || event.start_at), end = Date.parse(event.adjusted_end_at || event.end_at)
          return start <= now && end > now ? -30 : start > now &&
            (event.required || ['high', 'critical'].includes(event.priority) || start - now <= 60 * 60000) ? -20 : end <= now ? -5 : 20
        }
        return order.indexOf(action.id)
      }
      return rank(a) - rank(b)
    })
  }
  const fallback: DailyRecommendationAction = { id: 'pause', category: 'none', title: 'Leave a little room for yourself',
    reason: 'There is no additional action in your recorded plan right now. Leave the rest flexible.', href: '/dashboard/schedule', availability: 'completed', completed: true }
  return { date: schedule.date, timezone: schedule.timezone, generatedAt: schedule.now,
    primary: candidates[0] || fallback, supporting: candidates.slice(1, 4), training: getDailyTraining(logic), evidence: { food, water, workout, checkIn } }
}
