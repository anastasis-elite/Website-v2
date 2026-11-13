import 'server-only'
import type { ProgramLogicOutput } from './logic/types'
import type { DailyScheduleState, ScheduleEvent } from '@/lib/schedule/types'
import { getActionRouteForEvent, getScheduleEventPrompt } from '@/lib/schedule/engine'
import { canRespondToScheduleEvent } from '@/lib/schedule/actions'
import { getDailyTraining } from './dailyTraining'
import { buildTodayActivities, presentTodayActivities, type TodayActivityId } from './todayActivities'
import { getLocalDaypart, localDateKey } from '@/lib/timezone'
import { mealEntryHref, WATER_ENTRY_HREF } from '@/lib/nutrition/loggingRoutes'
import { getRecoveryPresentation } from '@/lib/recovery/todayCompletion'
import { getStreakRequirementProgress } from './logic/streakRequirementProgress'
import { isStrengthWorkout, strengthTrainingPaused } from '@/lib/assessment/strengthWorkoutState'

import type { DailyRecommendation, DailyRecommendationAction, DataAvailability } from './dailyRecommendationTypes'
import type { TodayActivities, TodayActivity } from './todayActivityTypes'
export type { DailyRecommendation, DailyRecommendationAction, DataAvailability } from './dailyRecommendationTypes'

const isBreakfastOccurrence = (event: ScheduleEvent) => event.schedule_response_kind === 'breakfast' && canRespondToScheduleEvent(event)

// This coordinates existing decisions. It does not calculate a health score or change doses.
export function buildDailyRecommendation(logic: ProgramLogicOutput, schedule: DailyScheduleState, prepared?: { today: TodayActivities; presented: TodayActivity[] }): DailyRecommendation {
  const food: DataAvailability = logic.nutrition.dataStatus === 'needs_input' ? 'not_logged' :
    logic.nutrition.calories.percent >= 95 && logic.nutrition.protein.percent >= 90 ? 'confirmed' : 'partial'
  const water: DataAvailability = logic.hydration.status === 'needs_input' ? 'not_logged' :
    logic.hydration.remaining <= 0 ? 'completed' : 'partial'
  const workout: DataAvailability = logic.execution.workoutComplete ? 'completed' : logic.execution.workoutInProgress ? 'partial' : 'not_logged'
  const checkIn: DataAvailability = logic.assessments.dailyCompleted ? 'completed' : 'not_logged'
  const scheduledStrength = isStrengthWorkout(logic.assessments.strength, schedule.date)
  const strengthPaused = scheduledStrength && strengthTrainingPaused(logic)
  const strengthWorkout = scheduledStrength && !strengthPaused
  const emptyWorkoutDay = !strengthWorkout && ['rest', 'unavailable'].includes(logic.workoutDecision.assignedWorkout?.workout_state)
  const today = prepared?.today || buildTodayActivities(logic, schedule)
  const presented = prepared?.presented || presentTodayActivities(logic, schedule, today.activities)
  const recovery = logic.execution.recoveryEvidence ? getRecoveryPresentation({ evidence: logic.execution.recoveryEvidence, schedule }) : null
  const recoveryDue = presented.some(activity => activity.id === 'recovery')
  const nutritionPacing = logic.nutrition.pacing
  const nutritionDue = nutritionPacing ? presented.some(activity => activity.id === 'nutrition') : food === 'not_logged'
  // The same presentation decision drives the water card and recommendation.
  // Readiness pacing tolerances remain in their existing hydration engine.
  const waterPacing = logic.hydration.presentationPacing
  const waterDue = presented.some(activity => activity.id === 'water')
  const waterActionAvailability = water === 'completed' && waterPacing && waterPacing.state !== 'complete' ? 'partial' : water
  const guideId = (id: string): TodayActivityId | undefined => id === 'food-input' ? 'nutrition' :
    ['check-in', 'water', 'schedule', 'workout', 'recovery'].includes(id) ? id as TodayActivityId : undefined
  const held = (id: string) => {
    const activity = presented.find(item => item.id === guideId(id)) || today.activities.find(item => item.id === guideId(id))
    return activity?.status === 'deferred' || activity?.status === 'skipped'
  }
  const eventActivityId = (category: string) => category === 'check_in' ? 'check-in' : category === 'hydration' ? 'water' :
    category === 'meal' || category === 'nutrition' ? 'nutrition' : category === 'workout' || category === 'recovery' ? category : undefined
  const eventUnavailable = (category: string, eventId?: string) => {
    // Breakfast occurrence check-ins are independent of logged food and its
    // pacing; a saved meal entry cannot answer whether this breakfast happened.
    if (eventId && schedule.events.some(event => event.id === eventId && isBreakfastOccurrence(event))) return false
    if (category === 'workout' && strengthPaused) return true
    if (category === 'workout' && emptyWorkoutDay) return true
    if (category === 'hydration') return !waterDue || held('water')
    if (category === 'meal' || category === 'nutrition') return !nutritionDue || held('food-input')
    if (category === 'recovery' && recovery) {
      if (recovery.state === 'no_event') return true
      return !recoveryDue || held('recovery') || recovery.state !== 'due' || eventId !== recovery.eventId
    }
    const id = eventActivityId(category)
    const activity = today.activities.find(item => item.id === id)
    return Boolean(id && (held(id) || activity?.status === 'completed'))
  }
  const candidates: DailyRecommendationAction[] = []
  const add = (id: string, category: string, title: string, reason: string, href: string, availability: DataAvailability, eventId?: string) => {
    if (id !== 'safety' && held(id)) return
    if (eventId && eventUnavailable(category, eventId)) return
    if (schedule.dailyGuide && guideId(id) && !today.activities.some(activity => activity.id === guideId(id))) return
    candidates.push({ id, category, title, reason, href, availability, eventId, completed: availability === 'completed' })
  }
  if (logic.symptoms.redFlag) {
    add('safety', 'recovery', 'Review today’s recovery guidance', logic.recoveryStatus.reasoning, '/dashboard/recovery', 'confirmed')
  }
  if (checkIn !== 'completed') {
    add('check-in', 'check_in', 'Daily check-in', 'Start with your energy. Your answers help today’s plan fit your actual capacity.', '/dashboard/check-in', 'not_logged')
  }
  if (!logic.symptoms.redFlag && (strengthPaused || !scheduledStrength && !logic.workoutDecision.canTrain && !emptyWorkoutDay)) {
    add('safety', 'recovery', 'Review today’s recovery guidance', logic.recoveryStatus.reasoning, '/dashboard/recovery', 'confirmed')
  }
  const active = schedule.events.find(e => !eventUnavailable(e.event_type, e.id) && e.flexibility_type === 'fixed' && e.status === 'scheduled' &&
    new Date(e.adjusted_start_at || e.start_at) <= new Date(schedule.now) && new Date(e.adjusted_end_at || e.end_at) > new Date(schedule.now))
  if (active) add(active.id, active.event_type, active.title, `${active.source_label ? active.source_label + '. ' : ''}${getScheduleEventPrompt(active, new Date(schedule.now))}`,
    getActionRouteForEvent(active, logic.program), active.checkoff?.status === 'in_progress' ? 'partial' : 'confirmed', active.id)

  if (nutritionDue) {
    add('food-input', 'nutrition', nutritionPacing ? 'Log what you’ve had' : logic.program === 'ember' ? 'Review your next meal' : 'Log your latest meal',
      nutritionPacing?.prompt || (logic.program === 'ember' ? 'Your nutrition guidance is ready when you need it.' : 'No food is logged today. That does not tell us what you’ve eaten.'), mealEntryHref(logic.program), food)
  }
  if (waterDue) add('water', 'hydration', water === 'not_logged' ? 'Log the water you’ve had' : 'Water logging',
    waterPacing?.prompt || (water === 'not_logged' ? 'Water intake is not logged yet. Add what you’ve had so the plan can use it.' : `${Math.round(logic.hydration.consumed)} oz logged. Follow your individual fluid guidance.`), WATER_ENTRY_HREF, waterActionAvailability)
  const scheduleReview = today.activities.find(activity => activity.id === 'schedule')
  if (schedule.dailyGuide && scheduleReview?.status !== 'completed' && schedule.events.some(event => !event.suggested &&
    ['work', 'school', 'appointment', 'medical', 'dental', 'personal', 'household', 'custom'].includes(event.event_type) && !['cancelled', 'skipped'].includes(event.status))) {
    add('schedule', 'schedule', 'Make a little room in your day', 'Review your saved commitments and choose what can wait.', '/dashboard/schedule', 'confirmed')
  }
  if (workout !== 'completed' && strengthWorkout && !schedule.events.some(e => e.event_type === 'workout' && e.status === 'skipped')) {
    add('workout', 'workout', 'Strength assessment', 'Your eligible strength assessment takes the place of today’s workout. Record only the movements you test.',
      logic.assessments.strength.href, logic.assessments.strength.state === 'draft' ? 'partial' : 'not_logged')
  } else if (!scheduledStrength && workout !== 'completed' && !schedule.events.some(e => e.event_type === 'workout' && e.status === 'skipped') && logic.workout.assigned && logic.workoutDecision.canTrain) {
    add('workout', 'workout', workout === 'partial' ? 'Resume today’s workout' : food === 'not_logged' ? 'Review today’s workout' : logic.workoutDecision.adjustmentLevel === 'level_0_full_plan' ? 'Open today’s workout' : 'A lighter workout fits today',
      logic.program === 'ember' ? `${logic.workoutDecision.reasonForModification} Meal intake is not tracked in EMBER; use your meal guidance and how you feel.` : food === 'not_logged' ? 'Food is not logged yet. Review the workout options and choose what fits how you feel.' : food === 'partial' ? 'Food is partly logged. Check that the plan fits how you feel before starting.' : logic.workoutDecision.reasonForModification,
      `/dashboard/program/${logic.program}/workout`, workout)
  }
  const evening = getLocalDaypart(new Date(schedule.now), schedule.timezone) === 'evening'
  const recoveryEventDue = recovery?.state === 'due'
  const unscheduledRecoveryDue = (!recovery || recovery.state === 'no_event') && !logic.execution.recoveryComplete
  if (recoveryDue && !candidates.some(action => action.category === 'recovery') && (recoveryEventDue || (workout === 'completed' || evening || logic.capacityStatus?.status === 'low_capacity') && unscheduledRecoveryDue)) add('recovery', 'recovery', logic.program === 'ember' ? 'A little reward, just for you.' : 'Choose a recovery moment',
    logic.program === 'ember' ? 'Put on a podcast, get comfortable, or choose your own way to unwind.'
      : workout === 'completed' ? `A completed workout is recorded${logic.execution.completedWorkoutTitle ? `: ${logic.execution.completedWorkoutTitle}` : ' today'}. Recovery options are available.` : 'Choose from the recovery options already available in your plan.', '/dashboard/recovery', 'confirmed')
  // Commitments and overdue items remain actionable even when food is not logged.
  const next = schedule.nextActionableEvent
  if (next && !['completed','cancelled','skipped'].includes(next.status) && !next.suggested &&
    (isBreakfastOccurrence(next) || !['hydration','meal'].includes(next.event_type)) && !candidates.some(c => c.eventId === next.id) &&
    !eventUnavailable(next.event_type, next.id) && !(next.event_type === 'workout' && new Date(next.adjusted_start_at || next.start_at) > new Date(schedule.now) && next.adjusted_start_at)) {
    const action: DailyRecommendationAction = { id: next.id, category: next.event_type, title: next.title,
      reason: getScheduleEventPrompt(next, new Date(schedule.now)), href: getActionRouteForEvent(next, logic.program),
      availability: next.checkoff?.status === 'in_progress' ? 'partial' : 'confirmed', eventId: next.id, completed: false }
    const required = candidates.findIndex(candidate => !['safety', 'check-in'].includes(candidate.id) && !candidate.eventId)
    candidates.splice(required < 0 ? candidates.length : required, 0, action)
  }
  // The existing recommendation keeps safety and current commitments first.
  // For the guided view, the remaining choices follow a quiet daily sequence.
  if (schedule.dailyGuide) {
    const order = evening || logic.capacityStatus?.status === 'low_capacity'
      ? ['check-in', 'recovery', 'water', 'schedule', 'food-input', 'workout']
      : ['check-in', 'water', 'schedule', 'food-input', 'workout', 'recovery']
    candidates.sort((a, b) => {
      const rank = (action: DailyRecommendationAction) => action.id === 'safety' ? -3 : action.id === 'check-in' ? -2 : action.eventId ? -1 : order.indexOf(action.id)
      return rank(a) - rank(b)
    })
  }
  const streakProgress = getStreakRequirementProgress(logic.flameState, schedule.date, { programTier: logic.program, now: schedule.now, timezone: schedule.timezone })
  const dayCompleted = streakProgress.available && streakProgress.secured && localDateKey(new Date(schedule.now), schedule.timezone) === schedule.date
  const fallback: DailyRecommendationAction = { id: 'pause', category: 'none', title: dayCompleted ? 'Day completed' : 'A little moment, just for you.',
    reason: dayCompleted ? 'Reward yourself with a little treat.' : 'You’ve made space for yourself today. Enjoy a warm cup of coffee or tea, a little dessert, or whatever feels like a treat to you. You deserve to enjoy it.',
    href: '/dashboard/schedule', availability: dayCompleted ? 'completed' : 'confirmed', completed: dayCompleted }
  return { date: schedule.date, timezone: schedule.timezone, generatedAt: schedule.now,
    primary: candidates[0] || fallback, supporting: candidates.slice(1, 4), training: getDailyTraining(logic), evidence: { food, water, workout, checkIn } }
}
