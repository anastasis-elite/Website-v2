export const BODY_ASSESSMENT_FORMULA_VERSION = 'body_regional_estimate_v0.1.0'

export type RegionalMeasurementInput = {
  region: string
  side?: 'left' | 'right' | 'midline' | null
  lengthCm?: number | null
  proximalCircumferenceCm?: number | null
  midpointCircumferenceCm?: number | null
  distalCircumferenceCm?: number | null
  skinfoldAttemptsMm?: number[]
  tissuePinchQuality?: 'easy' | 'moderate' | 'difficult' | 'not_recorded' | null
}

export type RegionalCompositionEstimate = {
  region: string
  side: 'left' | 'right' | 'midline' | null
  formulaVersion: string
  status: 'estimated' | 'insufficient_data'
  estimatedVolumeLiters: number | null
  estimatedSubcutaneousFatMassKg: number | null
  estimatedRemainingNonFatMassKg: number | null
  reconciliationNote: string
  qualityFlags: string[]
}

function numeric(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function round(value: number, places = 2) {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

function circumferenceToRadiusCm(circumferenceCm: number) {
  return circumferenceCm / (2 * Math.PI)
}

function frustumVolumeCm3(lengthCm: number, proximalCircumferenceCm: number, distalCircumferenceCm: number) {
  const r1 = circumferenceToRadiusCm(proximalCircumferenceCm)
  const r2 = circumferenceToRadiusCm(distalCircumferenceCm)
  return (Math.PI * lengthCm * (r1 ** 2 + r1 * r2 + r2 ** 2)) / 3
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
}

export function calculateRegionalCompositionEstimate(input: RegionalMeasurementInput): RegionalCompositionEstimate {
  const lengthCm = numeric(input.lengthCm)
  const proximal = numeric(input.proximalCircumferenceCm ?? input.midpointCircumferenceCm)
  const distal = numeric(input.distalCircumferenceCm ?? input.midpointCircumferenceCm)
  const midpoint = numeric(input.midpointCircumferenceCm)
  const qualityFlags: string[] = []

  if (!lengthCm || !proximal || !distal) {
    return {
      region: input.region,
      side: input.side ?? null,
      formulaVersion: BODY_ASSESSMENT_FORMULA_VERSION,
      status: 'insufficient_data',
      estimatedVolumeLiters: null,
      estimatedSubcutaneousFatMassKg: null,
      estimatedRemainingNonFatMassKg: null,
      reconciliationNote: 'Estimated regional composition requires segment length and at least proximal/distal or midpoint circumferences.',
      qualityFlags: ['missing_required_measurements'],
    }
  }

  const segmentVolumeCm3 = frustumVolumeCm3(lengthCm, proximal, distal)
  const skinfoldAttempts = (input.skinfoldAttemptsMm || []).map(numeric).filter((value): value is number => value !== null)
  const averageSkinfoldMm = average(skinfoldAttempts)

  if (skinfoldAttempts.length > 1) {
    const spread = Math.max(...skinfoldAttempts) - Math.min(...skinfoldAttempts)
    if (spread > 4) qualityFlags.push('skinfold_attempt_variance')
  }

  if (input.tissuePinchQuality === 'difficult') {
    qualityFlags.push('difficult_to_pinch_tissue_not_low_fat')
  }

  const circumferenceForSurface = midpoint || (proximal + distal) / 2
  const lateralSurfaceAreaCm2 = circumferenceForSurface * lengthCm
  const singleLayerThicknessCm = averageSkinfoldMm ? averageSkinfoldMm / 20 : null
  const estimatedFatVolumeCm3 = singleLayerThicknessCm ? lateralSurfaceAreaCm2 * singleLayerThicknessCm : null
  const estimatedSubcutaneousFatMassKg = estimatedFatVolumeCm3 ? (estimatedFatVolumeCm3 * 0.9) / 1000 : null
  const estimatedRemainingNonFatMassKg = (segmentVolumeCm3 - (estimatedFatVolumeCm3 || 0)) / 1000

  return {
    region: input.region,
    side: input.side ?? null,
    formulaVersion: BODY_ASSESSMENT_FORMULA_VERSION,
    status: 'estimated',
    estimatedVolumeLiters: round(segmentVolumeCm3 / 1000),
    estimatedSubcutaneousFatMassKg: estimatedSubcutaneousFatMassKg === null ? null : round(estimatedSubcutaneousFatMassKg),
    estimatedRemainingNonFatMassKg: round(Math.max(0, estimatedRemainingNonFatMassKg)),
    reconciliationNote:
      'Estimated remaining non-fat mass is not labeled as muscle. Scale weight is retained as a reconciliation constraint and residual mass is not silently assigned to fat.',
    qualityFlags,
  }
}
