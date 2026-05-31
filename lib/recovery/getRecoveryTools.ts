import { getCycleStatus } from '@/lib/cycle/getCycleStatus'

export function getRecoveryTools({
  client,
  recoveryLog,
  workoutCompleted,
  nutritionLogged,
}: {
  client: any
  recoveryLog?: any
  workoutCompleted?: boolean
  nutritionLogged?: boolean
}) {
  const cycleStatus = getCycleStatus(client)

  const sick = !!recoveryLog?.sick
  const dizzy = !!recoveryLog?.dizzy
  const overheated = !!recoveryLog?.overheated
  const unusuallyFatigued = !!recoveryLog?.unusually_fatigued

  const hydrationLevel = Number(recoveryLog?.hydration_level || 0)
  const stressLevel = Number(recoveryLog?.stress_level || 0)
  const sorenessLevel = Number(recoveryLog?.soreness_level || 0)

  const hardStop =
    sick ||
    dizzy ||
    overheated ||
    unusuallyFatigued ||
    cycleStatus.recoveryCaution

  const hydrationLow =
    hydrationLevel > 0 && hydrationLevel <= 4

  const stressHigh =
    stressLevel >= 7

  const sorenessHigh =
    sorenessLevel >= 7

  const saunaRecommended =
    !hardStop &&
    !hydrationLow &&
    !!workoutCompleted &&
    !!nutritionLogged

  const tubSoakRecommended =
    !sick &&
    !dizzy &&
    (
      stressHigh ||
      sorenessHigh ||
      cycleStatus.recoveryCaution
    )

  const mobilityRecommended =
    sorenessHigh || unusuallyFatigued || cycleStatus.recoveryCaution

  return {
    saunaRecommended,
    tubSoakRecommended,
    mobilityRecommended,
    cycleStatus,
  }
}
