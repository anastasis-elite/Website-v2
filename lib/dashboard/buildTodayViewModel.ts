import 'server-only'

import type { ProgramLogicOutput } from './logic/types'
import type { DailyScheduleState } from '@/lib/schedule/types'
import type { TodayViewModel } from './todayViewModelTypes'
import { buildTodayActivities, presentTodayActivities } from './todayActivities'
import { buildDailyRecommendation } from './dailyRecommendation'
import { getStreakRequirementProgress } from './logic/streakRequirementProgress'
import { getRecoveryPresentation } from '@/lib/recovery/todayCompletion'

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
  return {
    version: 1, date: schedule.date, timezone: schedule.timezone, generatedAt: schedule.now,
    clientId: logic.client.id, tier: logic.program, today, presentedActivities, recommendation, streakProgress,
    nextRefreshAt: Number.isFinite(presentationBoundary) ? new Date(presentationBoundary).toISOString() : null,
    deferredReturnAt: Number.isFinite(returnAt) ? new Date(returnAt).toISOString() : null,
    quiet: schedule.preferences?.carouselStyle === 'step',
    workout: { state, inactive: state === 'rest' || state === 'unavailable', title: logic.workout.title,
      reason: logic.workoutDecision.reasonForModification, inProgress: Boolean(logic.execution.workoutInProgress) },
    macroReminder: logic.nutrition.macroReminder?.message || null,
  }
}
