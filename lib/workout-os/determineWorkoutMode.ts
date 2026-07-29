import type {
  WorkoutModeDecision,
  WorkoutModeDecisionInput,
} from './types'

/**
 * Determines which workout builder owns the current day.
 *
 * This file does not build or modify exercises. Its only responsibility is
 * choosing the workout mode and assigning the top-level adjustment level.
 *
 * Priority:
 * 1. Safety and recovery red flags
 * 2. Rolling three-day capacity
 * 3. Current-day recovery modification
 * 4. Fuel availability
 * 5. Missing workout fallback
 * 6. Standard training
 */

function isRecoveryOnlyCondition({
  redFlag,
  recoveryStatus,
}: WorkoutModeDecisionInput): boolean {
  return (
    redFlag ||
    recoveryStatus === 'full_recovery_or_red_flag'
  )
}

function isLowCapacityCondition({
  capacityHistory,
  capacityStatus,
  recoveryStatus,
}: WorkoutModeDecisionInput): boolean {
  return (
    capacityHistory.workoutDayMode ===
      'low_capacity' ||
    capacityHistory.level === 'low' ||
    capacityStatus === 'low_capacity' ||
    recoveryStatus === 'active_recovery' ||
    recoveryStatus === 'modify_workout'
  )
}

function isLowFuelCondition(
  fuelStatus: WorkoutModeDecisionInput['fuelStatus'],
): boolean {
  return (
    fuelStatus === 'under_fueled' ||
    fuelStatus === 'depleted'
  )
}

function needsStarterWorkout({
  hasPlannedWorkout,
  hasStrengthExercises,
}: WorkoutModeDecisionInput): boolean {
  return (
    !hasPlannedWorkout ||
    !hasStrengthExercises
  )
}

export function determineWorkoutMode(
  input: WorkoutModeDecisionInput,
): WorkoutModeDecision {
  /**
   * A true safety or recovery red flag is the only state that automatically
   * removes strength training entirely.
   */
  if (isRecoveryOnlyCondition(input)) {
    return {
      mode: 'recovery_only',

      reason:
        'A recovery or safety red flag requires strength training to pause today.',

      adjustmentLevel:
        'level_4_rest_or_red_flag',
    }
  }

  /**
   * Capacity is evaluated before fuel and workout availability because it
   * controls the maximum size of today's prescription.
   *
   * The low-capacity builder can use starter exercises when no complete
   * planned workout exists, while still respecting the three-exercise limit.
   */
  if (isLowCapacityCondition(input)) {
    return {
      mode: 'low_capacity',

      reason:
        input.capacityHistory.triggers.length > 0
          ? `Recent recovery history indicates low capacity: ${input.capacityHistory.triggers.join(
              ', ',
            )}.`
          : 'Current recovery or capacity signals require a reduced training session.',

      adjustmentLevel:
        'level_2_moderate_modify',
    }
  }

  /**
   * Low fuel does not automatically become a recovery day.
   *
   * The low-fuel builder should preserve strength training while reducing
   * volume, intensity, and high-output conditioning.
   */
  if (isLowFuelCondition(input.fuelStatus)) {
    return {
      mode: 'low_fuel',

      reason:
        input.fuelStatus === 'depleted'
          ? 'Fuel availability is depleted, so training demand must be reduced.'
          : 'Fuel availability is below target, so training volume and intensity must be adjusted.',

      adjustmentLevel:
        input.fuelStatus === 'depleted'
          ? 'level_2_moderate_modify'
          : 'level_1_slight_modify',
    }
  }

  /**
   * Slightly under-fueled clients keep the standard workout route.
   *
   * The standard builder may still add a fueling cue, but this condition alone
   * does not warrant a separate reduced workout.
   */
  if (
    input.fuelStatus ===
    'slightly_under_fueled'
  ) {
    if (needsStarterWorkout(input)) {
      return {
        mode: 'starter',

        reason:
          'No valid planned strength workout is available, so a foundational workout is assigned.',

        adjustmentLevel:
          'level_1_slight_modify',
      }
    }

    return {
      mode: 'standard',

      reason:
        'The planned workout remains available with a pre-workout fueling recommendation.',

      adjustmentLevel:
        'level_1_slight_modify',
    }
  }

  /**
   * If there is no usable strength workout, assign a real starter strength
   * session rather than substituting a stretching routine.
   */
  if (needsStarterWorkout(input)) {
    return {
      mode: 'starter',

      reason:
        'No valid planned strength workout is available, so a foundational workout is assigned.',

      adjustmentLevel:
        'level_1_slight_modify',
    }
  }

  return {
    mode: 'standard',

    reason:
      'Capacity, recovery, and fuel availability support the planned strength workout.',

    adjustmentLevel:
      'level_0_full_plan',
  }
}
