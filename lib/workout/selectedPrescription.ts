import { getFounderSelectedExercise } from '@/lib/program/generateProgram'
import { applyCycleTrainingAdjustment, getCycleTrainingAdjustment } from '@/lib/cycle/getCycleTrainingAdjustment'
import {
  runCapacityEngine, runFuelReadinessEngine, runHydrationEngine, runNutritionEngine,
  runPostureCompensationEngine, runRecoveryEngine, runSymptomEngine, runWorkoutDecisionEngine,
} from '@/lib/dashboard/logic/engines'
import type { ProgramLogicInputs } from '@/lib/dashboard/logic/types'
import type { SelectedPrescriptionResponse } from './selectedPrescriptionTypes'

export function selectedFounderBase(args: Parameters<typeof getFounderSelectedExercise>[0]) {
  return getFounderSelectedExercise(args)
}

/** Apply the same cycle, capacity, fuel, symptom and structural rules as a saved day. */
export function buildSelectedPrescription({ inputs, exercise, variantId }: {
  inputs: ProgramLogicInputs; exercise: any; variantId: string
}): SelectedPrescriptionResponse {
  const cycleAdjustment = getCycleTrainingAdjustment(inputs.client)
  const adjusted = applyCycleTrainingAdjustment({ exercise, adjustment: cycleAdjustment })
  // The daily decision path retains the converted, cycle-adjusted load for
  // this exact selected variant, then applies the existing safety rules once.
  const safetyExercise = adjusted
  const selectedInputs: ProgramLogicInputs = {
    ...inputs, cycleAdjustment, plannedExercises: [safetyExercise],
    plannedWorkout: { day_name: 'Selected exercise', day_intent: 'training', exercises: [safetyExercise] },
  }
  const symptoms = runSymptomEngine(selectedInputs)
  const capacity = runCapacityEngine(selectedInputs, symptoms)
  const recovery = runRecoveryEngine(selectedInputs, symptoms)
  const hydration = runHydrationEngine(selectedInputs)
  const nutrition = runNutritionEngine(selectedInputs)
  const fuel = runFuelReadinessEngine(selectedInputs, hydration, nutrition, recovery)
  const posture = runPostureCompensationEngine(selectedInputs)
  const decision = runWorkoutDecisionEngine(selectedInputs, capacity, recovery, fuel, hydration, symptoms, posture)
  const assigned = decision.assignedWorkout?.exercises?.find((item: any) => item.id === exercise.id &&
    item.exercise === exercise.exercise && item.selected_variant_id === variantId)
  if (!decision.canTrain || !assigned || ['rest', 'unavailable', 'recovery', 'starter'].includes(decision.assignedWorkout?.workout_state)) {
    return { status: 'blocked', message: 'Recommendation unavailable for this selection with today’s saved training guidance.', setupHref: '/dashboard/recovery' }
  }
  const bodyweight = exercise.load_type === 'bodyweight'
  const weight = bodyweight ? 0 : assigned.recommended_weight
  if (!Number.isSafeInteger(assigned.sets) || assigned.sets <= 0 || !Number.isSafeInteger(assigned.recommended_reps) ||
    assigned.recommended_reps <= 0 || typeof weight !== 'number' || !Number.isFinite(weight) || weight < 0 || (!bodyweight && weight === 0)) {
    return { status: 'unavailable', message: 'Recommendation unavailable. Review your saved strength assessment.', setupHref: '/dashboard/assessment/start2' }
  }
  return { status: 'available', prescription: {
    version: 'founder-selected-v1', exerciseId: String(exercise.id), variantId,
    sets: assigned.sets, reps: assigned.recommended_reps, weightLb: weight, loadType: String(exercise.load_type),
  } }
}
