import type {
  CapacityStatus,
  FuelReadinessResult,
  ProgramLogicInputs,
  RecoveryStatus,
  WorkoutDecisionResult,
} from '@/lib/dashboard/logic/types'
import { getClientLocalDate } from '@/lib/timezone'

type WorkoutState = 'planned' | 'recovery' | 'starter'

type WorkoutForToday = {
  type: WorkoutState
  title: string
  exercises: any[]
  completionEligible: boolean
  reason: string
}

const universalCues = [
  'Move with intention.',
  'Breathe before moving.',
  'Finish feeling better than you started.',
]

function exercise({
  name,
  reps,
  durationLabel,
  sets = 1,
  rpe = 'Easy effort',
}: {
  name: string
  reps: number
  durationLabel?: string
  sets?: number
  rpe?: string
}) {
  return {
    exercise: name,
    name,
    display_name: name,
    duration_label: durationLabel,
    sets,
    reps,
    recommended_reps: reps,
    baseline_reps: reps,
    recommended_weight: 0,
    baseline_weight: 0,
    calculated_weight: 0,
    selected_variant_id: 'bodyweight',
    selected_variant_name: name,
    selected_equipment: 'bodyweight',
    equipment: 'bodyweight',
    load_type: 'bodyweight',
    available_variants: [
      {
        id: 'bodyweight',
        name,
        equipment: 'bodyweight',
        load_type: 'bodyweight',
        equipment_modifier: 1,
      },
    ],
    client_cues: universalCues,
    rest_seconds: 0,
    rpe_target: rpe,
  }
}

export function getStarterWorkout(): WorkoutForToday {
  return {
    type: 'starter',
    title: 'Starter Workout',
    completionEligible: true,
    reason: 'A starter workout keeps today actionable while training history builds.',
    exercises: [
      exercise({ name: 'March in place', reps: 60, durationLabel: '60 seconds' }),
      exercise({ name: 'Bodyweight squat to chair', reps: 8 }),
      exercise({ name: 'Wall push-up', reps: 8 }),
      exercise({ name: 'Standing hip hinge', reps: 8 }),
      exercise({ name: 'Wall slides', reps: 8 }),
      exercise({ name: 'Hip flexor stretch', reps: 30, durationLabel: '30 seconds per side', rpe: 'Each side' }),
    ],
  }
}

export function getRecoveryWorkout(): WorkoutForToday {
  return {
    type: 'recovery',
    title: 'Recovery Day',
    completionEligible: true,
    reason: 'Recovery readiness is low today, so the workout becomes a complete recovery movement session.',
    exercises: [
      exercise({ name: 'Easy walk or march in place', reps: 10, durationLabel: '10 minutes' }),
      exercise({ name: 'Cat-cow', reps: 8 }),
      exercise({ name: 'Child’s pose breathing', reps: 60, durationLabel: '60 seconds' }),
      exercise({ name: 'Thoracic rotation — 6 reps per side', reps: 6, rpe: 'Per side' }),
      exercise({ name: 'Hip flexor stretch', reps: 30, durationLabel: '30 seconds per side', rpe: 'Each side' }),
      exercise({ name: 'Standing hamstring stretch', reps: 30, durationLabel: '30 seconds per side', rpe: 'Each side' }),
    ],
  }
}

function localDateOffset(client: any, offset: number) {
  const timeZone = client?.timezone || client?.onboarding_data?.timezone || 'America/Chicago'
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function previousFuelingCommitment(inputs: ProgramLogicInputs) {
  const dates = [-1, -2, -3].map((offset) => localDateOffset(inputs.client, offset))
  const logs = inputs.nutritionLogs || []
  const completedCount = dates.filter((date) =>
    logs.some((row: any) => String(row.log_date) === date && (row.completed || (Array.isArray(row.meals) && row.meals.length > 0)))
  ).length

  return { dates, completedCount, hasEnoughHistory: completedCount >= 3 }
}

function hasUsableExercises(exercises: unknown) {
  return Array.isArray(exercises) && exercises.length > 0
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
  const localDate = getClientLocalDate(inputs.client)
  const fueling = previousFuelingCommitment(inputs)
  const noHistory = !inputs.workoutHistory.length && !fueling.hasEnoughHistory

  if (recoveryStatus === 'full_recovery_or_red_flag' || recoveryStatus === 'active_recovery') {
    return getRecoveryWorkout()
  }

  if (fueling.completedCount <= 1 && inputs.workoutHistory.length > 0) {
    return {
      ...getRecoveryWorkout(),
      reason: 'Recent fueling commitment is low, so today is assigned as recovery movement.',
    }
  }

  if (noHistory) {
    return getStarterWorkout()
  }

  if (!plannedWorkout || !hasUsableExercises(assignedExercises)) {
    return {
      ...getStarterWorkout(),
      reason: `No complete generated workout was available for ${localDate}, so the starter workout is assigned.`,
    }
  }

  if (fuelReadiness.status === 'depleted' && capacityStatus === 'low_capacity') {
    return {
      ...getRecoveryWorkout(),
      reason: 'Fuel and capacity are both low, so today is assigned as recovery movement.',
    }
  }

  return {
    type: 'planned',
    title: plannedWorkout.day_name || 'Today’s Workout',
    exercises: assignedExercises,
    completionEligible: true,
    reason: 'Readiness supports today’s planned workout.',
  }
}

export function workoutFallbackAdjustmentLevel(type: WorkoutState): WorkoutDecisionResult['adjustmentLevel'] {
  return type === 'planned' ? 'level_0_full_plan' : 'level_3_recovery_training'
}
