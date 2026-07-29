import type {
  RecoveryAction,
  WorkoutEngineInput,
  WorkoutEngineOutput,
  WorkoutExercise,
} from '../types'

import { buildRecoveryActions } from '../shared/buildRecoveryActions'
import {
  addCue,
  firstExercises,
  normalizeWorkout,
  reduceIntensity,
  reduceVolume,
} from '../shared/exerciseUtils'

const LOW_CAPACITY_EXERCISE_LIMIT = 3

/**
 * Used only when low capacity is detected but no valid planned strength
 * exercises are available.
 *
 * This ensures low capacity still receives a short strength session rather
 * than silently becoming a stretch-only or recovery-only day.
 */
function buildLowCapacityFallback(): WorkoutExercise[] {
  return [
    {
      name: 'Supported squat',
      sets: 2,
      reps: 8,
      rest_seconds: 75,
      rpe_target: '6–7',
      client_cues: [
        'Use a bench, rail, or stable support as needed.',
        'Stop each set before form begins to change.',
      ],
    },
    {
      name: 'Supported dumbbell row',
      sets: 2,
      reps: 8,
      rest_seconds: 75,
      rpe_target: '6–7',
      client_cues: [
        'Keep the torso supported and the neck relaxed.',
        'Use a load that leaves several clean repetitions available.',
      ],
    },
    {
      name: 'Glute bridge',
      sets: 2,
      reps: 10,
      rest_seconds: 60,
      rpe_target: '6–7',
      client_cues: [
        'Keep the ribs controlled as the hips rise.',
        'Stop before the lower back begins compensating.',
      ],
    },
  ] as WorkoutExercise[]
}

function prepareLowCapacityExercises(
  plannedExercises: WorkoutExercise[],
): WorkoutExercise[] {
  const normalizedExercises =
    normalizeWorkout(plannedExercises)

  const sourceExercises =
    normalizedExercises.length > 0
      ? firstExercises(
          normalizedExercises,
          LOW_CAPACITY_EXERCISE_LIMIT,
        )
      : buildLowCapacityFallback()

  return sourceExercises.map((exercise) => {
    const reducedVolumeExercise =
      reduceVolume(exercise)

    const reducedIntensityExercise =
      reduceIntensity(
        reducedVolumeExercise,
      )

    return addCue(
      reducedIntensityExercise,
      'Today is a reduced-capacity session. Prioritize control and stop before strain or compensation.',
    )
  })
}

export function buildLowCapacityWorkout(
  input: WorkoutEngineInput,
): WorkoutEngineOutput {
  const exercises =
    prepareLowCapacityExercises(
      input.plannedExercises,
    )

  const recoveryActions: RecoveryAction[] =
    buildRecoveryActions({
      targetCount: 3,
      recoveryStatus:
        input.recoveryStatus,
      fuelStatus: input.fuelStatus,
      hydrationPercent:
        input.hydrationPercent ?? 100,
      sorenessRegions:
        input.sorenessExclusions ?? [],
    })

  const capacityTriggers =
    input.capacityHistory.triggers ?? []

  return {
    mode: 'low_capacity',

    title: 'Reduced-Capacity Workout',

    exercises,

    recoveryActions,

    displayWorkout: true,

    canTrain: true,

    completionEligible: true,

    adjustmentLevel:
      'level_2_moderate_modify',

    reason:
      capacityTriggers.length > 0
        ? `Recent recovery history requires a reduced session: ${capacityTriggers.join(
            ', ',
          )}.`
        : 'Current capacity signals require a shorter, lower-demand strength session.',

    excludedMuscles: [],

    capacityTriggers,

    rationale: [
      'Low-capacity workout selected.',
      'Strength training is preserved rather than replaced with stretching.',
      'The session is limited to three exercises.',
      'Exercise volume and intensity are reduced.',
      'Three recovery actions are assigned.',
    ],

    allowLoadProgression: false,

    allowEnduranceProgression: false,
  }
}
