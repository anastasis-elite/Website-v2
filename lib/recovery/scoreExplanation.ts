import type { ProgramLogicOutput } from '@/lib/dashboard/logic/types'

type RecoveryScoreInputs = Pick<ProgramLogicOutput, 'assessments' | 'recoveryCheck' | 'sleep' | 'recoveryStatus'>

export function getRecoveryScoreExplanation(logic: RecoveryScoreInputs) {
  const inputs = [
    ['Sleep duration', logic.sleep.hours],
    ['Sleep quality', logic.sleep.quality],
    ['Energy', logic.recoveryCheck.energy],
    ['Stress', logic.recoveryCheck.stress],
    ['Soreness', logic.recoveryCheck.soreness],
  ] as const
  const known = (value: number | null) => value !== null && value !== undefined && Number.isFinite(value)
  const missingInputs = inputs.filter(([, value]) => !known(value)).map(([label]) => label)
  const availableInputs = inputs.filter(([, value]) => known(value)).map(([label]) => label)
  const confirmed = logic.assessments.dailyCompleted && !missingInputs.length
  const score = confirmed && Number.isFinite(logic.recoveryStatus.score)
    ? Math.max(0, Math.min(100, Math.round(logic.recoveryStatus.score)))
    : null
  const summary = score !== null
    ? 'Your saved sleep, energy, stress, and soreness inputs inform this score, alongside symptom and fatigue signals.'
    : missingInputs.length
      ? 'Recovery is provisional until the missing check-in inputs are saved. Missing inputs stay unknown; they are not counted as good recovery.'
      : 'Save today’s daily check-in to confirm your recovery score.'

  return { score, summary, missingInputs, availableInputs }
}
