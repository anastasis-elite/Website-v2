import { getCycleStatus } from '@/lib/cycle/getCycleStatus'

type CycleTrainingAdjustment = {
  cycleStatus: any
  weightMultiplier: number
  repAdjustment: number
  label: string
  note: string
  cautionActive: boolean
}

export function getCycleTrainingAdjustment(client: any): CycleTrainingAdjustment {
  const cycleStatus = getCycleStatus(client)

  const program = client.program || 'ignite'

  let weightMultiplier = 1
  let repAdjustment = 0
  let label = 'Baseline training load'
  let note = 'Training loads are using the current program baseline.'
  let cautionActive = false

  if (!cycleStatus.enabled) {
    return {
      cycleStatus,
      weightMultiplier,
      repAdjustment,
      label,
      note,
      cautionActive,
    }
  }

  const cycleDay = Number(cycleStatus.cycleDay || 0)
  const cycleLength = Number(client.average_cycle_length || 28)

  const daysBeforeExpectedPeriod = cycleLength - cycleDay

  const isBeforePeriodWindow =
    daysBeforeExpectedPeriod >= 0 &&
    daysBeforeExpectedPeriod <= 3

  const isDuringPeriod = cycleStatus.phase === 'menstrual'

  const isExtendedCycle = cycleStatus.phase === 'extended_cycle'

  const isFollicular = cycleStatus.phase === 'follicular'

  const isOvulatory = cycleStatus.phase === 'ovulatory'

  const isLuteal = cycleStatus.phase === 'luteal'

  const programModifier =
    program === 'ember'
      ? 0.98
      : program === 'phoenix'
      ? 1.02
      : 1

  if (isDuringPeriod) {
    weightMultiplier = 0.85 * programModifier
    repAdjustment = -2
    label = 'Cycle-aware reduced load'
    cautionActive = true
    note =
      'Cycle-aware load reduction is active today. The system is lowering assigned weights and reps slightly to reduce unnecessary stress while symptoms may be present.'
  } else if (isBeforePeriodWindow) {
    weightMultiplier = 0.9 * programModifier
    repAdjustment = -1
    label = 'Pre-period load adjustment'
    cautionActive = true
    note =
      'The system is slightly reducing assigned weights and reps near the expected start of your period to support recovery and execution.'
  } else if (isExtendedCycle) {
    weightMultiplier = 0.9 * programModifier
    repAdjustment = -1
    label = 'Conservative cycle-aware load'
    cautionActive = true
    note =
      'Your cycle appears extended based on the last period start date. The system is using a conservative load adjustment until clearer cycle data is available.'
  } else if (isFollicular) {
    weightMultiplier = 1.03 * programModifier
    repAdjustment = 0
    label = 'Progressive training load'
    note =
      'The system may allow a small progressive load increase when cycle caution is not active and the current program baseline supports it.'
  } else if (isOvulatory) {
    weightMultiplier = 1.02 * programModifier
    repAdjustment = 0
    label = 'Strong but controlled training load'
    note =
      'The system supports strong output today while still prioritizing control, form, and joint stability.'
  } else if (isLuteal) {
    weightMultiplier = 0.95 * programModifier
    repAdjustment = -1
    label = 'Steady training load'
    note =
      'The system is keeping today’s training steady instead of aggressively pushing intensity.'
  }

  return {
    cycleStatus,
    weightMultiplier,
    repAdjustment,
    label,
    note,
    cautionActive,
  }
}

export function applyCycleTrainingAdjustment({
  exercise,
  adjustment,
}: {
  exercise: any
  adjustment: CycleTrainingAdjustment
}) {
  const baselineWeight =
    Number(
      exercise.calculated_weight ||
        exercise.recommended_weight ||
        exercise.weight ||
        exercise.weight_goal ||
        0
    ) || 0

  const baselineReps =
    Number(
      exercise.reps ||
        exercise.target_reps ||
        exercise.recommended_reps ||
        exercise.rep_goal ||
        0
    ) || 0

  const adjustedWeight = baselineWeight
    ? Math.max(0, Math.round(baselineWeight * adjustment.weightMultiplier))
    : null

  const adjustedReps = baselineReps
    ? Math.max(1, baselineReps + adjustment.repAdjustment)
    : null

  return {
    ...exercise,

    baseline_weight: baselineWeight || null,
    baseline_reps: baselineReps || null,

    cycle_adjusted_weight: adjustedWeight,
    cycle_adjusted_reps: adjustedReps,

    recommended_weight: adjustedWeight || baselineWeight || null,
    recommended_reps: adjustedReps || baselineReps || null,

    cycle_adjustment_label: adjustment.label,
    cycle_adjustment_note: adjustment.note,
    cycle_caution_active: adjustment.cautionActive,
  }
}
