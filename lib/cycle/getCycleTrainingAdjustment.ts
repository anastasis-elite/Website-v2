import { getCycleStatus } from '@/lib/cycle/getCycleStatus'

export function getCycleTrainingAdjustment(client: any) {
  const cycleStatus = getCycleStatus(client)

  let weightMultiplier = 1
  let label = 'Baseline training load'
  let note =
    'Training loads are using the current program baseline.'

  if (!cycleStatus.enabled) {
    return {
      cycleStatus,
      weightMultiplier,
      label,
      note,
    }
  }

  const cycleDay = Number(cycleStatus.cycleDay || 0)
  const cycleLength = Number(client.average_cycle_length || 28)

  const daysBeforeExpectedPeriod =
    cycleLength - cycleDay

  const isBeforePeriodWindow =
    daysBeforeExpectedPeriod >= 0 &&
    daysBeforeExpectedPeriod <= 3

  const isDuringPeriod =
    cycleStatus.phase === 'menstrual'

  const isExtendedCycle =
    cycleStatus.phase === 'extended_cycle'

  if (isDuringPeriod) {
    weightMultiplier = 0.85
    label = 'Reduced training load'
    note =
      'Cycle-aware load reduction is active today. The system is lowering assigned weights to reduce unnecessary stress while symptoms may be present.'
  } else if (isBeforePeriodWindow) {
    weightMultiplier = 0.9
    label = 'Pre-period load adjustment'
    note =
      'The system is slightly reducing assigned weights near the expected start of your period to support recovery and execution.'
  } else if (isExtendedCycle) {
    weightMultiplier = 0.9
    label = 'Conservative cycle-aware load'
    note =
      'Your cycle appears extended based on the last period start date. The system is using a conservative load adjustment until clearer cycle data is available.'
  } else if (
    cycleStatus.phase === 'follicular' ||
    cycleStatus.phase === 'ovulatory'
  ) {
    weightMultiplier = 1.03
    label = 'Progressive training load'
    note =
      'The system may allow a small progressive load increase when cycle caution is not active and the current program baseline supports it.'
  }

  return {
    cycleStatus,
    weightMultiplier,
    label,
    note,
  }
}
