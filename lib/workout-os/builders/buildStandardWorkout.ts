import type {
  RecoveryAction,
  WorkoutEngineInput,
  WorkoutEngineOutput,
} from '../types'

import { normalizeWorkout } from '../shared/exerciseUtils'
import { buildRecoveryActions } from '../shared/buildRecoveryActions'

export function buildStandardWorkout(
  input: WorkoutEngineInput,
): WorkoutEngineOutput {
  const exercises = normalizeWorkout(
    input.plannedExercises,
  )

  const recoveryActions: RecoveryAction[] =
    buildRecoveryActions({
      targetCount: 1,
      recoveryStatus: input.recoveryStatus,
      fuelStatus: input.fuelStatus,
      hydrationPercent:
        input.hydrationPercent ?? 100,
      sorenessRegions:
        input.sorenessExclusions,
    })

  return {
    mode: 'standard',

    title: 'Today\'s Workout',

    exercises,

    recoveryActions,

    displayWorkout: true,

    canTrain: true,

    completionEligible: true,

    adjustmentLevel:
      'level_0_full_plan',

    reason:
      'Recovery, capacity, and fuel support the planned workout.',

    excludedMuscles: [],

    capacityTriggers:
      input.capacityHistory.triggers,

    rationale: [
      'Standard workout selected.',
      'Capacity history supports full training.',
      'Recovery actions added after strength training.',
    ],

    allowLoadProgression:
      true,

    allowEnduranceProgression:
      true,
  }
}
