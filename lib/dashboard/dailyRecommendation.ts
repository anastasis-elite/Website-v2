import type { ProgramLogicOutput } from './logic/types'
import type { DailyScheduleState } from '@/lib/schedule/types'
import { getActionRouteForEvent } from '@/lib/schedule/engine'
import { getDailyTraining, type DailyTraining } from './dailyTraining'

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
  const candidates: DailyRecommendationAction[] = []
  const add = (id: string, category: string, title: string, reason: string, href: string, availability: DataAvailability, eventId?: string) =>
    candidates.push({ id, category, title, reason, href, availability, eventId, completed: availability === 'completed' })
  if (!logic.workoutDecision.canTrain || logic.symptoms.redFlag) {
    add('safety', 'recovery', 'Review today’s recovery guidance', logic.recoveryStatus.reasoning, '/dashboard/recovery', 'confirmed')
  }
  const active = schedule.events.find(e => e.flexibility_type === 'fixed' && e.status === 'scheduled' &&
    new Date(e.adjusted_start_at || e.start_at) <= new Date(schedule.now) && new Date(e.adjusted_end_at || e.end_at) > new Date(schedule.now))
  if (active) add(active.id, active.event_type, active.title, `${active.source_label ? active.source_label + '. ' : ''}This is your current commitment. Keep your other actions flexible.`, getActionRouteForEvent(active, logic.program), 'confirmed', active.id)
  if (checkIn !== 'completed') {
    add('check-in', 'check_in', 'Tell us how you feel', 'A quick energy check helps today’s plan fit your actual capacity.', '/dashboard/check-in', 'not_logged')
  }

  if (food === 'not_logged') {
    add('food-input', 'nutrition', logic.program === 'ember' ? 'Review your next meal' : 'Log your latest meal',
      logic.program === 'ember' ? 'Your nutrition guidance is ready when you need it.' : 'No food is logged today. That does not tell us what you’ve eaten.', '/dashboard/nutrition', 'not_logged')
  }
  if (water !== 'completed' && !schedule.events.some(e => e.event_type === 'hydration' && e.status === 'skipped')) add('water', 'hydration', water === 'not_logged' ? 'Log the water you’ve had' : 'Have a little water when it suits you',
    water === 'not_logged' ? 'Water intake is not logged yet. Add what you’ve had so the plan can use it.' : `${Math.round(logic.hydration.consumed)} oz logged. Keep drinking steadily; you do not need to catch up all at once.`, '/dashboard/nutrition#hydration', water)
  if (workout !== 'completed' && !schedule.events.some(e => e.event_type === 'workout' && e.status === 'skipped') && logic.workout.assigned && logic.workoutDecision.canTrain) {
    add('workout', 'workout', workout === 'partial' ? 'Resume today’s workout' : food === 'not_logged' ? 'Review today’s workout' : logic.workoutDecision.adjustmentLevel === 'level_0_full_plan' ? 'Open today’s workout' : 'A lighter workout fits today',
      logic.program === 'ember' ? `${logic.workoutDecision.reasonForModification} Meal intake is not tracked in EMBER; use your meal guidance and how you feel.` : food === 'not_logged' ? 'Food is not logged yet. Review the workout options and choose what fits how you feel.' : food === 'partial' ? 'Food is partly logged. Check that the plan fits how you feel before starting.' : logic.workoutDecision.reasonForModification,
      `/dashboard/program/${logic.program}/workout`, workout)
  }
  if (workout === 'completed' && !logic.execution.recoveryComplete) add('recovery', 'recovery', 'Choose a recovery moment',
    `A completed workout is recorded${logic.execution.completedWorkoutTitle ? `: ${logic.execution.completedWorkoutTitle}` : ' today'}. Recovery options are available.`, '/dashboard/recovery', 'confirmed')
  // Commitments and overdue items remain actionable even when food is not logged.
  const next = schedule.nextActionableEvent
  if (next && !next.suggested && !['hydration','meal'].includes(next.event_type) && !candidates.some(c => c.eventId === next.id)) {
    const overdue = new Date(next.adjusted_end_at || next.end_at) <= new Date(schedule.now)
    const action = { id: next.id, category: next.event_type, title: next.title, reason: schedule.nextAction?.id === next.id ? schedule.nextAction.reason : overdue ? 'This item is overdue. Review it, reschedule it, or record its outcome.' : 'This fits the next part of your schedule.',
      href: getActionRouteForEvent(next, logic.program), availability: 'confirmed' as const, eventId: next.id, completed: false }
    const required = candidates.findIndex(candidate => !['safety', 'check-in'].includes(candidate.id) && !candidate.eventId)
    candidates.splice(required < 0 ? candidates.length : required, 0, action)
  }
  const fallback: DailyRecommendationAction = { id: 'pause', category: 'none', title: 'Leave a little room for yourself',
    reason: 'There is no additional action in your recorded plan right now. Leave the rest flexible.', href: '/dashboard/schedule', availability: 'completed', completed: true }
  return { date: schedule.date, timezone: schedule.timezone, generatedAt: schedule.now,
    primary: candidates[0] || fallback, supporting: candidates.slice(1, 4), training: getDailyTraining(logic), evidence: { food, water, workout, checkIn } }
}
