import type { MenstrualFlowBurdenResult } from '@/lib/cycle/menstrualFlow'

export const MENSTRUAL_ESCALATION_VERSION = 'menstrual_escalation_v1.0.0'

export type MenstrualEscalationInput = {
  date: string
  burden: MenstrualFlowBurdenResult
  bleedingDurationDays?: number | null
  symptoms?: Record<string, unknown> | null
  baselineDeviation?: 'increased' | 'decreased' | 'stable' | 'insufficient_data' | null
}

export type MenstrualEscalationResult = {
  algorithmVersion: string
  status: 'none' | 'watch' | 'consider_follow_up'
  reasons: string[]
  message: string | null
}

function symptomSeverity(symptoms: Record<string, unknown>, key: string) {
  const value = symptoms[key]
  if (value === 'severe') return 3
  if (value === 'moderate') return 2
  if (value === 'mild') return 1
  const numeric = Number(value)
  if (Number.isFinite(numeric)) {
    if (numeric >= 8) return 3
    if (numeric >= 5) return 2
    if (numeric > 0) return 1
  }
  if (value === true) return 2
  return 0
}

export function evaluateMenstrualFlowEscalation(input: MenstrualEscalationInput): MenstrualEscalationResult {
  const symptoms = input.symptoms || {}
  const reasons: string[] = []
  const burden = input.burden

  if (burden.burdenBand === 'very_high') reasons.push('very_high_flow_burden')
  if (burden.productCount >= 10) reasons.push('high_product_utilization')
  if (burden.fullySaturatedHighAbsorbencyCount >= 2) reasons.push('repeated_fully_saturated_high_absorbency_products')
  if (burden.overflowEvents >= 2) reasons.push('frequent_overflow_or_leak_events')
  if (burden.frequentChangeEvents >= 3) reasons.push('very_frequent_changing')
  if (Number(input.bleedingDurationDays || 0) >= 8) reasons.push('persistently_prolonged_bleeding')
  if (input.baselineDeviation === 'increased') reasons.push('major_deviation_from_user_baseline')

  const energyValue = Number(symptoms.energy)
  const severeLowEnergy = Number.isFinite(energyValue) && energyValue > 0 && energyValue <= 3
  const severeFatigue = symptomSeverity(symptoms, 'fatigue') >= 3 || severeLowEnergy
  const severeWeakness = symptomSeverity(symptoms, 'weakness') >= 3
  const severeDizziness = symptomSeverity(symptoms, 'dizziness') >= 3 || symptomSeverity(symptoms, 'lightheadedness') >= 3
  const severeShortnessOfBreath = symptomSeverity(symptoms, 'shortness_of_breath') >= 3

  if (burden.burdenScore >= 8 && severeFatigue) reasons.push('high_flow_with_severe_fatigue_or_low_energy')
  if (burden.burdenScore >= 8 && severeWeakness) reasons.push('high_flow_with_weakness')
  if (burden.burdenScore >= 8 && severeDizziness) reasons.push('high_flow_with_dizziness_or_lightheadedness')
  if (burden.burdenScore >= 8 && severeShortnessOfBreath) reasons.push('high_flow_with_shortness_of_breath')

  const status =
    reasons.some((reason) =>
      [
        'very_high_flow_burden',
        'repeated_fully_saturated_high_absorbency_products',
        'frequent_overflow_or_leak_events',
        'persistently_prolonged_bleeding',
        'high_flow_with_severe_fatigue_or_low_energy',
        'high_flow_with_weakness',
        'high_flow_with_dizziness_or_lightheadedness',
        'high_flow_with_shortness_of_breath',
      ].includes(reason),
    )
      ? 'consider_follow_up'
      : reasons.length
        ? 'watch'
        : 'none'

  return {
    algorithmVersion: MENSTRUAL_ESCALATION_VERSION,
    status,
    reasons,
    message:
      status === 'consider_follow_up'
        ? 'Your recent cycle data shows a repeated or notable high-flow pattern alongside recovery symptoms. Anastasis cannot determine the cause, but this pattern may be worth discussing with your healthcare professional.'
        : status === 'watch'
          ? 'Anastasis will continue watching this cycle pattern over time and will keep recommendations conservative when your recovery signals are lower.'
          : null,
  }
}
