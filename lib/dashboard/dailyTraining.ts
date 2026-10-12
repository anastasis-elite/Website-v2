import type { ProgramLogicOutput } from './logic/types'

export type DailyTraining = {
  mode: 'normal_training' | 'reduced_capacity' | 'recovery_only'
  label: string
  readiness: 'not_logged' | 'partial' | 'confirmed'
  readinessNote: string
  reason: string
}

// All screens describe the assigned decision, rather than independently naming
// the original workout, a recovery subscore, or missing inputs.
export function getDailyTraining(logic: Pick<ProgramLogicOutput, 'workoutDecision' | 'assessments' | 'symptoms' | 'recoveryCheck' | 'sleep'>): DailyTraining {
  const decision = logic.workoutDecision
  const recoveryOnly = !decision.canTrain || logic.symptoms.redFlag || decision.assignedWorkout?.workout_state === 'recovery'
  const mode = recoveryOnly ? 'recovery_only' : decision.adjustmentLevel === 'level_0_full_plan' ? 'normal_training' : 'reduced_capacity'
  const signals = [logic.recoveryCheck?.energy, logic.recoveryCheck?.stress, logic.recoveryCheck?.soreness, logic.sleep?.hours, logic.sleep?.quality]
  const hasInputs = signals.some(value => value !== null && value !== undefined)
  const readiness = logic.assessments.dailyCompleted && signals.every(value => value !== null && value !== undefined) ? 'confirmed' : hasInputs ? 'partial' : 'not_logged'
  return {
    mode,
    label: mode === 'recovery_only' ? 'Recovery-only day' : mode === 'reduced_capacity' ? 'Reduced-capacity training' : 'Normal training',
    readiness,
    readinessNote: readiness === 'confirmed' ? 'Today’s check-in is saved.' : readiness === 'partial' ? logic.assessments.dailyCompleted ? 'Your check-in is saved with partial inputs. Readiness remains provisional.' : 'Some inputs are available. Today’s check-in is incomplete; readiness is provisional.' : 'Today’s check-in is not logged. Readiness is not confirmed.',
    reason: decision.reasonForModification,
  }
}
