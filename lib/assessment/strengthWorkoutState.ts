import type { StrengthAssessmentStatus } from './getStrengthAssessmentStatus'
import type { ProgramLogicOutput } from '@/lib/dashboard/logic/types'

type StrengthSafetyContext = Pick<ProgramLogicOutput, 'workoutDecision' | 'symptoms'> & Partial<Pick<ProgramLogicOutput, 'recoveryStatus'>>

// canTrain is also false for an ordinary rest/missing-plan day. Those states
// alone do not cancel the separately scheduled assessment. Existing safety and
// recovery-only decisions still take priority; no readiness is recalculated.
export function strengthTrainingPaused(logic: StrengthSafetyContext, hasSafetyFlags = false) {
  const decision = logic.workoutDecision
  const state = decision.assignedWorkout?.workout_state
  if (hasSafetyFlags || logic.symptoms?.redFlag || logic.recoveryStatus?.status === 'full_recovery_or_red_flag' ||
    decision.adjustmentLevel === 'level_4_rest_or_red_flag' || state === 'recovery') return true
  const ordinaryEmptyDay = state === 'rest' || state === 'unavailable'
  return decision.canTrain !== true && !ordinaryEmptyDay
}

// Display-only selection from the server's dated assessment status.
export function isStrengthWorkout(status: StrengthAssessmentStatus | undefined, date: string) {
  return Boolean(status && !status.unavailable && (status.scheduledDate === date && (!status.eligibleDate || status.eligibleDate <= date) ||
    status.completedToday && status.completedDate === date && status.latestCompletedAt && status.state === 'completed'))
}
