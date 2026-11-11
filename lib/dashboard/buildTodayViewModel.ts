import 'server-only'

import type { ProgramLogicOutput } from './logic/types'
import type { DailyScheduleState } from '@/lib/schedule/types'
import type { TodayViewModel } from './todayViewModelTypes'
import { buildTodayActivities, presentTodayActivities } from './todayActivities'
import { buildDailyRecommendation } from './dailyRecommendation'
import { getStreakRequirementProgress } from './logic/streakRequirementProgress'
import { getRecoveryPresentation } from '@/lib/recovery/todayCompletion'
import { getRecoveryRewardForPresentation } from '@/lib/recovery/rewardPresentation'
import { isStrengthWorkout, strengthTrainingPaused } from '@/lib/assessment/strengthWorkoutState'

export function buildTodayViewModel(logic: ProgramLogicOutput, schedule: DailyScheduleState): TodayViewModel {
  const today = buildTodayActivities(logic, schedule)
  const presentedActivities = presentTodayActivities(logic, schedule, today.activities)
  const recommendation = buildDailyRecommendation(logic, schedule, { today, presented: presentedActivities })
  const streakProgress = getStreakRequirementProgress(logic.flameState, schedule.date, { programTier: logic.program, now: schedule.now, timezone: schedule.timezone })
  const recovery = logic.execution.recoveryEvidence ? getRecoveryPresentation({ evidence: logic.execution.recoveryEvidence, schedule }) : null
  const now = Date.parse(schedule.now)
  const presentationBoundary = Math.min(...[logic.nutrition.pacing?.nextRefreshAt, logic.hydration.presentationPacing?.nextRefreshAt, recovery?.nextRefreshAt]
    .flatMap(value => value && Number.isFinite(Date.parse(value)) ? [Date.parse(value)] : []))
  const returnAt = Math.min(...Object.values(schedule.dailyGuide?.activities || {}).flatMap(value =>
    value?.status === 'deferred' && value.until && Date.parse(value.until) > now ? [Date.parse(value.until)] : []))
  const state = logic.workoutDecision.assignedWorkout?.workout_state || null
  const scheduledStrength = isStrengthWorkout(logic.assessments.strength, schedule.date)
  const strengthPaused = scheduledStrength && strengthTrainingPaused(logic)
  const strengthWorkout = scheduledStrength && !strengthPaused
  const candidate = getRecoveryRewardForPresentation({ logic, schedule, presentedActivities })
  const recoveryRewardSuggestion = recommendation.primary.id !== 'safety' || candidate?.kind === 'safety' ? candidate : undefined
  // Already validated safety guidance stays visible independently of optional
  // recovery timing. No note text is interpreted on this display surface.
  if (recoveryRewardSuggestion?.kind === 'safety') {
    recommendation.primary = { id: 'safety', category: 'recovery', title: recoveryRewardSuggestion.title,
      reason: recoveryRewardSuggestion.description, href: '/dashboard/recovery', availability: 'confirmed', completed: false }
    recommendation.supporting = recommendation.supporting.filter(action => action.category !== 'workout')
    recommendation.training = { ...recommendation.training, mode: 'recovery_only', label: 'Recovery-only day', reason: recoveryRewardSuggestion.description }
  }
  return {
    version: 1, date: schedule.date, timezone: schedule.timezone, generatedAt: schedule.now,
    clientId: logic.client.id, tier: logic.program, today, presentedActivities: recoveryRewardSuggestion?.kind === 'safety'
      ? presentedActivities.filter(activity => activity.category !== 'workout' && activity.id !== 'assessment:strength') : presentedActivities,
    recommendation, streakProgress,
    nextRefreshAt: Number.isFinite(presentationBoundary) ? new Date(presentationBoundary).toISOString() : null,
    deferredReturnAt: Number.isFinite(returnAt) ? new Date(returnAt).toISOString() : null,
    quiet: schedule.preferences?.carouselStyle === 'step',
    workout: { state: recoveryRewardSuggestion?.kind === 'safety' ? 'recovery' : strengthPaused ? 'recovery' : strengthWorkout ? 'assessment' : state, inactive: recoveryRewardSuggestion?.kind === 'safety' || strengthPaused || !strengthWorkout && (state === 'rest' || state === 'unavailable'), title: recoveryRewardSuggestion?.kind === 'safety' || strengthPaused ? 'Training paused' : strengthWorkout ? 'Strength assessment' : logic.workout.title,
      reason: recoveryRewardSuggestion?.kind === 'safety' ? recoveryRewardSuggestion.description : strengthPaused ? 'Strength testing is paused. Review today’s recovery guidance.' : logic.workoutDecision.reasonForModification, inProgress: strengthWorkout ? logic.assessments.strength.state === 'draft' && !logic.assessments.strength.completedToday : Boolean(logic.execution.workoutInProgress) },
    macroReminder: logic.nutrition.macroReminder?.message || null,
    ...(recoveryRewardSuggestion ? { recoveryRewardSuggestion } : {}),
  }
}
