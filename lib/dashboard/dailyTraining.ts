import type { ProgramLogicOutput } from './logic/types'
import { strengthTrainingPaused } from '@/lib/assessment/strengthWorkoutState'

export type DailyTraining = {
  mode: 'normal_training' | 'reduced_capacity' | 'recovery_only' | 'rest' | 'unavailable'
  label: string
  readiness: 'not_logged' | 'partial' | 'confirmed'
  readinessNote: string
  reason: string
}

// All screens describe the assigned decision, rather than independently naming
// the original workout, a recovery subscore, or missing inputs.
export function getDailyTraining(logic: Pick<ProgramLogicOutput, 'workoutDecision' | 'assessments' | 'symptoms' | 'recoveryCheck' | 'sleep'>): DailyTraining {
  const decision = logic.workoutDecision
  const dayState = decision.assignedWorkout?.workout_state
  const recoveryOnly = !decision.canTrain || logic.symptoms.redFlag || decision.assignedWorkout?.workout_state === 'recovery'
  const signals = [logic.recoveryCheck?.energy, logic.recoveryCheck?.stress, logic.recoveryCheck?.soreness, logic.sleep?.hours, logic.sleep?.quality]
  const hasInputs = signals.some(value => value !== null && value !== undefined)
  const readiness = logic.assessments.dailyCompleted && signals.every(value => value !== null && value !== undefined) ? 'confirmed' : hasInputs ? 'partial' : 'not_logged'
  const strength = logic.assessments.strength
  const scheduledStrength = strength && !strength.unavailable && (strength.isWorkoutDay || strength.completedToday)
  const strengthPaused = scheduledStrength && strengthTrainingPaused(logic)
  const assessmentWorkout = scheduledStrength && !strengthPaused
  const mode = strengthPaused ? 'recovery_only' : dayState === 'rest' ? 'rest' : dayState === 'unavailable' ? 'unavailable' : recoveryOnly ? 'recovery_only' : decision.adjustmentLevel === 'level_0_full_plan' ? 'normal_training' : 'reduced_capacity'
  return {
    mode,
    label: assessmentWorkout ? 'Strength assessment' : mode === 'rest' ? 'Rest day' : mode === 'unavailable' ? 'Workout unavailable' : mode === 'recovery_only' ? 'Recovery-only day' : mode === 'reduced_capacity' ? 'Reduced-capacity training' : 'Normal training',
    readiness,
    readinessNote: readiness === 'confirmed' ? 'Today’s check-in is saved.' : readiness === 'partial' ? logic.assessments.dailyCompleted ? 'Your check-in is saved with partial inputs. Readiness remains provisional.' : 'Some inputs are available. Today’s check-in is incomplete; readiness is provisional.' : 'Today’s check-in is not logged. Readiness is not confirmed.',
    reason: strengthPaused ? 'Strength testing is paused. Review today’s recovery guidance.' : decision.reasonForModification,
  }
}
