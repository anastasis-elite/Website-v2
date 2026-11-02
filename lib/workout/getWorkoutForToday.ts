import type {
  CapacityStatus,
  FuelReadinessResult,
  ProgramLogicInputs,
  RecoveryStatus,
  WorkoutDecisionResult,
} from '@/lib/dashboard/logic/types'
import { getClientLocalDate } from '@/lib/timezone'

type WorkoutState = 'planned' | 'recovery' | 'starter' | 'reduced' | 'rest' | 'unavailable'

type WorkoutForToday = {
  type: WorkoutState
  title: string
  exercises: any[]
  completionEligible: boolean
  reason: string
}

const strengthCues = [
  'Move with control.',
  'Keep the target muscles engaged.',
  'Stop the set when form begins to change.',
]

const recoveryCues = [
  'Move gently.',
  'Do not force the range of motion.',
  'Finish feeling better than you started.',
]

function createExerciseId(name: string, prefix: string) {
  return `${prefix}-${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}`
}

function strengthExercise({
  name,
  reps,
  sets = 3,
  equipment = 'bodyweight',
  rpe = 'RPE 6',
}: {
  name: string
  reps: number
  sets?: number
  equipment?: string
  rpe?: string
}) {
  const id = createExerciseId(name, equipment)

  return {
    id,
    exercise: name,
    name,
    display_name: name,

    exercise_category: 'strength',
    movement_type: 'strength',

    sets,
    reps,
    recommended_reps: reps,
    baseline_reps: reps,

    recommended_weight: 0,
    baseline_weight: 0,
    calculated_weight: 0,

    selected_variant_id: id,
    selected_variant_name: name,
    selected_equipment: equipment,
    equipment,

    load_type:
      equipment === 'bodyweight'
        ? 'bodyweight'
        : 'external_load',

    available_variants: [
      {
        id,
        name,
        equipment,
        load_type:
          equipment === 'bodyweight'
            ? 'bodyweight'
            : 'external_load',
        equipment_modifier: 1,
      },
    ],

    client_cues: strengthCues,
    rest_seconds: 90,
    rpe_target: rpe,
  }
}

function recoveryExercise({
  name,
  reps,
  durationLabel,
  rpe = 'Easy effort',
}: {
  name: string
  reps: number
  durationLabel?: string
  rpe?: string
}) {
  const id = createExerciseId(name, 'recovery')

  return {
    id,
    exercise: name,
    name,
    display_name: name,

    exercise_category: 'recovery',
    movement_type: 'recovery',

    duration_label: durationLabel,

    sets: 1,
    reps,
    recommended_reps: reps,
    baseline_reps: reps,

    recommended_weight: 0,
    baseline_weight: 0,
    calculated_weight: 0,

    selected_variant_id: id,
    selected_variant_name: name,
    selected_equipment: 'bodyweight',
    equipment: 'bodyweight',
    load_type: 'bodyweight',

    available_variants: [
      {
        id,
        name,
        equipment: 'bodyweight',
        load_type: 'bodyweight',
        equipment_modifier: 1,
      },
    ],

    client_cues: recoveryCues,
    rest_seconds: 0,
    rpe_target: rpe,
  }
}

function getDefaultRecoveryActions() {
  return [
    recoveryExercise({
      name: 'Easy walk',
      reps: 10,
      durationLabel: '10 minutes',
    }),

    recoveryExercise({
      name: '90/90 breathing',
      reps: 5,
      durationLabel: '5 slow breaths',
    }),

    recoveryExercise({
      name: 'Gentle mobility flow',
      reps: 5,
      durationLabel: '5 minutes',
    }),
  ]
}

/**
 * Provides supported strength movements to the reduced-capacity builder.
 * Missing training plans and intentional rest days do not use this fallback.
 */
export function getStarterWorkout(): WorkoutForToday {
  return {
    type: 'starter',
    title: 'Starter Strength Workout',
    completionEligible: true,

    reason:
      'A foundational strength workout is assigned while training history develops.',

    exercises: [
      strengthExercise({
        name: 'Bodyweight squat to chair',
        sets: 3,
        reps: 8,
      }),

      strengthExercise({
        name: 'Incline push-up',
        sets: 3,
        reps: 8,
      }),

      strengthExercise({
        name: 'Supported split squat',
        sets: 3,
        reps: 8,
      }),

      strengthExercise({
        name: 'Standing hip hinge',
        sets: 3,
        reps: 10,
      }),

      strengthExercise({
        name: 'One-arm supported row',
        sets: 3,
        reps: 10,
        equipment: 'dumbbell',
      }),

      strengthExercise({
        name: 'Glute bridge',
        sets: 3,
        reps: 12,
      }),
    ],
  }
}

/**
 * Recovery days contain recovery actions only.
 *
 * This should only replace strength training when the engine identifies an
 * actual recovery or safety condition—not merely because fueling was imperfect.
 */
export function getRecoveryWorkout(): WorkoutForToday {
  return {
    type: 'recovery',
    title: 'Recovery Day',
    completionEligible: true,

    reason:
      'Training readiness requires a recovery-only day, so no lifting is assigned.',

    exercises: [
      recoveryExercise({
        name: 'Easy walk',
        reps: 10,
        durationLabel: '10 minutes',
      }),

      recoveryExercise({
        name: '90/90 breathing',
        reps: 5,
        durationLabel: '5 slow breaths',
      }),

      recoveryExercise({
        name: 'Cat-cow',
        reps: 8,
      }),

      recoveryExercise({
        name: 'Thoracic rotation',
        reps: 6,
        durationLabel: '6 repetitions per side',
        rpe: 'Per side',
      }),

      recoveryExercise({
        name: 'Gentle mobility flow',
        reps: 5,
        durationLabel: '5 minutes',
      }),
    ],
  }
}

function hasUsableExercises(
  exercises: unknown,
): exercises is any[] {
  if (!Array.isArray(exercises)) {
    return false
  }

  return exercises.some((exercise) => {
    if (!exercise) {
      return false
    }

    const name = String(
      exercise.display_name ||
        exercise.name ||
        exercise.exercise ||
        '',
    ).trim()

    return name.length > 0
  })
}

function isRecoveryCategory(exercise: any) {
  const category = String(
    exercise?.exercise_category ||
      exercise?.movement_type ||
      exercise?.category ||
      exercise?.type ||
      '',
  ).toLowerCase()

  return [
    'recovery',
    'mobility',
    'stretch',
    'stretching',
    'warmup',
    'warm-up',
    'cooldown',
    'cool-down',
  ].includes(category)
}

function looksLikeRecoveryExercise(exercise: any) {
  if (isRecoveryCategory(exercise)) {
    return true
  }

  const name = String(
    exercise?.display_name ||
      exercise?.name ||
      exercise?.exercise ||
      '',
  ).toLowerCase()

  return [
    'stretch',
    'breathing',
    'breathwork',
    'easy walk',
    'mobility flow',
    'foam roll',
    'child’s pose',
    "child's pose",
  ].some((term) => name.includes(term))
}

function getStrengthExercises(exercises: any[]) {
  return exercises
    .filter(Boolean)
    .filter(
      (exercise) =>
        !looksLikeRecoveryExercise(exercise),
    )
}

function normalizeNumber(
  value: unknown,
  fallback: number,
) {
  const parsed = Number(value)

  return Number.isFinite(parsed)
    ? parsed
    : fallback
}

function createLowCapacityWorkout(
  assignedExercises: any[],
  reason: string,
): WorkoutForToday {
  const plannedStrengthExercises =
    getStrengthExercises(assignedExercises)

  const fallbackStrengthExercises =
    getStarterWorkout().exercises

  const sourceExercises =
    plannedStrengthExercises.length >= 3
      ? plannedStrengthExercises
      : [
          ...plannedStrengthExercises,
          ...fallbackStrengthExercises,
        ]

  const selectedStrengthExercises =
    sourceExercises
      .filter((exercise, index, array) => {
        const name = String(
          exercise.display_name ||
            exercise.name ||
            exercise.exercise ||
            '',
        ).toLowerCase()

        return (
          name.length > 0 &&
          array.findIndex((candidate) => {
            const candidateName = String(
              candidate.display_name ||
                candidate.name ||
                candidate.exercise ||
                '',
            ).toLowerCase()

            return candidateName === name
          }) === index
        )
      })
      .slice(0, 3)
      .map((exercise) => {
        const originalSets = normalizeNumber(
          exercise.sets,
          3,
        )

        const originalReps = normalizeNumber(
          exercise.recommended_reps ??
            exercise.reps ??
            exercise.target_reps,
          8,
        )

        const reducedSets = Math.max(
          2,
          Math.min(originalSets, 3),
        )

        const reducedReps = Math.max(
          5,
          Math.min(originalReps, 10),
        )

        return {
          ...exercise,

          exercise_category:
            exercise.exercise_category ||
            'strength',

          movement_type:
            exercise.movement_type ||
            'strength',

          sets: reducedSets,
          reps: reducedReps,
          recommended_reps: reducedReps,

          rest_seconds: Math.max(
            90,
            normalizeNumber(
              exercise.rest_seconds,
              90,
            ),
          ),

          rpe_target: 'RPE 5–6',

          client_cues:
            Array.isArray(exercise.client_cues) &&
            exercise.client_cues.length
              ? exercise.client_cues
              : strengthCues,
        }
      })

  return {
    type: 'reduced',
    title: 'Low-Capacity Strength Workout',
    completionEligible: true,
    reason,

    /**
     * Low-capacity prescription:
     * 3 strength exercises
     * 3 recovery actions
     */
    exercises: [
      ...selectedStrengthExercises,
      ...getDefaultRecoveryActions(),
    ],
  }
}

export function getWorkoutForToday({
  inputs,
  recoveryStatus,
  fuelReadiness,
  capacityStatus,
  plannedWorkout,
  assignedExercises,
}: {
  inputs: ProgramLogicInputs
  recoveryStatus: RecoveryStatus
  fuelReadiness: FuelReadinessResult
  capacityStatus: CapacityStatus
  plannedWorkout: any
  assignedExercises: any[]
}): WorkoutForToday {
  const localDate =
    getClientLocalDate(inputs.client)

  if (
    plannedWorkout?.day_intent === 'rest' &&
    Array.isArray(plannedWorkout.exercises) &&
    plannedWorkout.exercises.length === 0 &&
    assignedExercises.length === 0
  ) {
    return {
      type: 'rest',
      title: 'Rest day',
      exercises: [],
      completionEligible: false,
      reason: 'Today is an intentional rest day in your program. No workout is assigned.',
    }
  }

  // Missing and incomplete training plans are unavailable, including a day
  // emptied by equipment filtering. Readiness must not invent a replacement.
  if (
    !plannedWorkout ||
    plannedWorkout.day_intent === 'rest' ||
    !hasUsableExercises(assignedExercises) ||
    !getStrengthExercises(assignedExercises).length
  ) {
    return {
      type: 'unavailable',
      title: 'Workout unavailable',
      exercises: [],
      completionEligible: false,
      reason: `Your training plan for ${localDate} is missing or incomplete. Contact your coach to review it.`,
    }
  }

  /**
   * Only a true recovery or safety red flag should remove lifting entirely.
   */
  if (
    recoveryStatus ===
    'full_recovery_or_red_flag'
  ) {
    return {
      ...getRecoveryWorkout(),
      completionEligible: false,

      reason:
        'A recovery or safety red flag requires training to pause today.',
    }
  }

  /**
   * Active recovery, depleted fuel, or low capacity should reduce the strength
   * session—not replace it with stretches.
   */
  if (
    recoveryStatus === 'active_recovery' ||
    fuelReadiness.status === 'depleted' ||
    capacityStatus === 'low_capacity'
  ) {
    return createLowCapacityWorkout(
      assignedExercises,
      'Capacity or recovery is reduced today, so the session includes three strength exercises and three recovery actions.',
    )
  }

  return {
    type: 'planned',

    title:
      plannedWorkout.day_name ||
      'Today’s Workout',

    exercises: assignedExercises,

    completionEligible: true,

    reason:
      'Readiness supports today’s planned workout.',
  }
}

export function workoutFallbackAdjustmentLevel(
  type: WorkoutState,
): WorkoutDecisionResult['adjustmentLevel'] {
  if (type === 'planned') {
    return 'level_0_full_plan'
  }

  return type === 'recovery' ? 'level_4_rest_or_red_flag' : type === 'reduced' ? 'level_3_recovery_training' : 'level_0_full_plan'
}
