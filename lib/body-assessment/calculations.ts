export const BODY_ASSESSMENT_FORMULA_VERSION = 'body_mass_conserving_regional_v1.0.0'

export const TISSUE_DENSITY_G_PER_ML = {
  ADIPOSE: 0.91,
  BASELINE_NON_ADIPOSE: 1.05,
  WATER: 1.0,
} as const

export type BodyAssessmentSide = 'left' | 'right' | 'midline'
export type ConfidenceLevel = 'high' | 'moderate' | 'low' | 'insufficient'
export type EstimateStatus = 'estimated' | 'insufficient_data'

export type CircumferenceSiteInput = {
  site: string
  circumferenceCm?: number | null
  position?: number | null
}

export type SkinfoldSiteInput = {
  site: string
  skinfoldMm?: number | null
  position?: number | null
  surfaceShare?: number | null
}

export type RegionalMeasurementInput = {
  region: string
  side?: BodyAssessmentSide | null
  lengthCm?: number | null
  proximalCircumferenceCm?: number | null
  midpointCircumferenceCm?: number | null
  distalCircumferenceCm?: number | null
  circumferences?: CircumferenceSiteInput[]
  skinfoldAttemptsMm?: number[]
  skinfoldSites?: SkinfoldSiteInput[]
  tissuePinchQuality?: 'easy' | 'moderate' | 'difficult' | 'not_recorded' | null
}

export type RegionalCompositionEstimate = {
  region: string
  side: BodyAssessmentSide | null
  formulaVersion: string
  status: EstimateStatus
  segmentVolumeMl: number | null
  segmentVolumeLiters: number | null
  estimatedAdiposeVolumeMl: number | null
  estimatedNonAdiposeVolumeMl: number | null
  rawEstimatedSegmentMassKg: number | null
  estimatedAdiposeMassKg: number | null
  estimatedNonAdiposeMassKg: number | null
  finalSegmentMassKg: number | null
  finalNonAdiposeMassKg: number | null
  regionalFatMassPercentage: number | null
  regionalMassShare: number | null
  regionalFatDistribution: number | null
  confidence: ConfidenceLevel
  dataCompleteness: number
  reconciliationNote: string
  qualityFlags: string[]
  estimatedVolumeLiters: number | null
  estimatedSubcutaneousFatMassKg: number | null
  estimatedRemainingNonFatMassKg: number | null
}

export type BodyCompositionEstimate = {
  formulaVersion: string
  status: EstimateStatus
  measuredBodyWeightKg: number | null
  measuredBodyWeightLbs: number | null
  modeledRawMassKg: number
  modeledFinalMassKg: number
  totalEstimatedFatMassKg: number | null
  totalEstimatedFatMassLbs: number | null
  totalEstimatedNonFatMassKg: number | null
  totalEstimatedNonFatMassLbs: number | null
  wholeBodyFatPercentage: number | null
  unresolvedStructuralMassKg: number | null
  unresolvedStructuralMassLbs: number | null
  reconciliationMassKg: number | null
  segments: RegionalCompositionEstimate[]
  qualityFlags: string[]
  assumptions: string[]
}

export function inchesToCm(value: number) {
  return value * 2.54
}

export function mmToCm(value: number) {
  return value / 10
}

export function poundsToKg(value: number) {
  return value * 0.45359237
}

export function kgToPounds(value: number) {
  return value / 0.45359237
}

function numeric(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function finiteNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function round(value: number | null, places = 2) {
  if (value === null || !Number.isFinite(value)) return null
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

function circumferenceToRadiusCm(circumferenceCm: number) {
  return circumferenceCm / (2 * Math.PI)
}

export function frustumVolumeMl(lengthCm: number, proximalCircumferenceCm: number, distalCircumferenceCm: number) {
  const r1 = circumferenceToRadiusCm(proximalCircumferenceCm)
  const r2 = circumferenceToRadiusCm(distalCircumferenceCm)
  return (Math.PI * lengthCm * (r1 ** 2 + r1 * r2 + r2 ** 2)) / 3
}

type NormalizedCircumference = { site: string; circumferenceCm: number; position: number }

function withSegmentEndpoints(sites: NormalizedCircumference[]) {
  const sorted = [...sites].sort((a, b) => a.position - b.position)
  if (sorted.length <= 1) return sorted

  const expanded = [...sorted]
  const first = sorted[0]
  const last = sorted[sorted.length - 1]

  if (first.position > 0) expanded.unshift({ ...first, position: 0 })
  if (last.position < 1) expanded.push({ ...last, position: 1 })

  return expanded
}

function normalizedCircumferences(input: RegionalMeasurementInput) {
  const explicit = (input.circumferences || [])
    .map((site) => ({
      site: site.site,
      circumferenceCm: numeric(site.circumferenceCm),
      position: clamp(finiteNumber(site.position) ?? 0.5, 0, 1),
    }))
    .filter((site): site is NormalizedCircumference => site.circumferenceCm !== null)

  if (explicit.length) return withSegmentEndpoints(explicit)

  const fallback = [
    { site: 'proximal_circumference', circumferenceCm: numeric(input.proximalCircumferenceCm), position: 0 },
    { site: 'midpoint_circumference', circumferenceCm: numeric(input.midpointCircumferenceCm), position: 0.5 },
    { site: 'distal_circumference', circumferenceCm: numeric(input.distalCircumferenceCm), position: 1 },
  ].filter((site): site is NormalizedCircumference => site.circumferenceCm !== null)

  return withSegmentEndpoints(fallback)
}

export function segmentVolumeFromCircumferencesMl(lengthCm: number, circumferences: CircumferenceSiteInput[]) {
  const sites = withSegmentEndpoints(
    circumferences
      .map((site) => ({
        ...site,
        circumferenceCm: numeric(site.circumferenceCm),
        position: clamp(finiteNumber(site.position) ?? 0.5, 0, 1),
      }))
      .filter((site): site is NormalizedCircumference => site.circumferenceCm !== null),
  )

  if (!numeric(lengthCm) || !sites.length) return null
  if (sites.length === 1) return frustumVolumeMl(lengthCm, sites[0].circumferenceCm, sites[0].circumferenceCm)

  let volume = 0
  for (let index = 0; index < sites.length - 1; index += 1) {
    const current = sites[index]
    const next = sites[index + 1]
    const sectionLength = Math.max(0, (next.position - current.position) * lengthCm)
    volume += frustumVolumeMl(sectionLength, current.circumferenceCm, next.circumferenceCm)
  }

  return volume
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
}

function surfaceAreaApproximationCm2(lengthCm: number, circumferences: ReturnType<typeof normalizedCircumferences>) {
  if (circumferences.length === 1) return circumferences[0].circumferenceCm * lengthCm

  let area = 0
  for (let index = 0; index < circumferences.length - 1; index += 1) {
    const current = circumferences[index]
    const next = circumferences[index + 1]
    const sectionLength = Math.max(0, (next.position - current.position) * lengthCm)
    area += ((current.circumferenceCm + next.circumferenceCm) / 2) * sectionLength
  }

  return area
}

function adiposeVolumeFromSkinfoldsMl(
  lengthCm: number,
  circumferences: ReturnType<typeof normalizedCircumferences>,
  input: RegionalMeasurementInput,
) {
  const skinfoldSites = (input.skinfoldSites || [])
    .map((site) => ({
      site: site.site,
      position: site.position ?? null,
      skinfoldMm: numeric(site.skinfoldMm),
      surfaceShare: numeric(site.surfaceShare),
    }))
    .filter((site): site is { site: string; position: number | null; skinfoldMm: number; surfaceShare: number | null } => site.skinfoldMm !== null)

  const attemptValues = (input.skinfoldAttemptsMm || [])
    .map(numeric)
    .filter((value): value is number => value !== null)

  if (!skinfoldSites.length && !attemptValues.length) return null

  const surfaceAreaCm2 = surfaceAreaApproximationCm2(lengthCm, circumferences)
  if (!Number.isFinite(surfaceAreaCm2) || surfaceAreaCm2 <= 0) return null

  if (skinfoldSites.length) {
    const rawShareTotal = skinfoldSites.reduce((sum, site) => sum + (site.surfaceShare || 0), 0)
    const fallbackShare = rawShareTotal > 0 ? 0 : 1 / skinfoldSites.length

    return skinfoldSites.reduce((sum, site) => {
      const share = rawShareTotal > 0 ? (site.surfaceShare || 0) / rawShareTotal : fallbackShare
      const singleLayerThicknessCm = mmToCm(site.skinfoldMm) / 2
      return sum + surfaceAreaCm2 * share * singleLayerThicknessCm
    }, 0)
  }

  const averageSkinfoldMm = average(attemptValues)
  return averageSkinfoldMm === null ? null : surfaceAreaCm2 * (mmToCm(averageSkinfoldMm) / 2)
}

function confidenceFrom(flags: string[], hasLength: boolean, circumferenceCount: number, hasSkinfold: boolean) {
  let score = 0
  if (hasLength) score += 0.3
  if (circumferenceCount >= 2) score += 0.3
  else if (circumferenceCount === 1) score += 0.15
  if (hasSkinfold) score += 0.3
  if (!flags.includes('impossible_measurement')) score += 0.1

  const dataCompleteness = clamp(score, 0, 1)
  const confidence: ConfidenceLevel =
    dataCompleteness >= 0.85 ? 'high' : dataCompleteness >= 0.6 ? 'moderate' : dataCompleteness >= 0.35 ? 'low' : 'insufficient'

  return { confidence, dataCompleteness }
}

export function calculateRegionalCompositionEstimate(input: RegionalMeasurementInput): RegionalCompositionEstimate {
  const lengthCm = numeric(input.lengthCm)
  const circumferences = normalizedCircumferences(input)
  const qualityFlags: string[] = []

  if (circumferences.length === 1) qualityFlags.push('single_circumference_cylindrical_geometry_lower_confidence')

  const skinfoldAttempts = (input.skinfoldAttemptsMm || []).map(numeric).filter((value): value is number => value !== null)
  if (skinfoldAttempts.length > 1) {
    const spread = Math.max(...skinfoldAttempts) - Math.min(...skinfoldAttempts)
    if (spread > 4) qualityFlags.push('skinfold_attempt_variance')
  }

  if (input.tissuePinchQuality === 'difficult') {
    qualityFlags.push('difficult_to_pinch_tissue_not_low_fat')
  }

  const hasSkinfold = skinfoldAttempts.length > 0 || (input.skinfoldSites || []).some((site) => numeric(site.skinfoldMm) !== null)
  if (!hasSkinfold) qualityFlags.push('missing_regional_skinfold_adipose_unavailable')

  const { confidence, dataCompleteness } = confidenceFrom(qualityFlags, !!lengthCm, circumferences.length, hasSkinfold)

  if (!lengthCm || !circumferences.length) {
    return {
      region: input.region,
      side: input.side ?? null,
      formulaVersion: BODY_ASSESSMENT_FORMULA_VERSION,
      status: 'insufficient_data',
      segmentVolumeMl: null,
      segmentVolumeLiters: null,
      estimatedAdiposeVolumeMl: null,
      estimatedNonAdiposeVolumeMl: null,
      rawEstimatedSegmentMassKg: null,
      estimatedAdiposeMassKg: null,
      estimatedNonAdiposeMassKg: null,
      finalSegmentMassKg: null,
      finalNonAdiposeMassKg: null,
      regionalFatMassPercentage: null,
      regionalMassShare: null,
      regionalFatDistribution: null,
      confidence,
      dataCompleteness: round(dataCompleteness, 2) || 0,
      reconciliationNote: 'Estimated regional composition requires segment length and at least one circumference. Missing values are not fabricated.',
      qualityFlags: ['missing_required_measurements', ...qualityFlags],
      estimatedVolumeLiters: null,
      estimatedSubcutaneousFatMassKg: null,
      estimatedRemainingNonFatMassKg: null,
    }
  }

  const segmentVolumeMl = segmentVolumeFromCircumferencesMl(lengthCm, circumferences)
  const adiposeVolumeMl = segmentVolumeMl === null ? null : adiposeVolumeFromSkinfoldsMl(lengthCm, circumferences, input)
  const cappedAdiposeVolumeMl = adiposeVolumeMl === null ? null : clamp(adiposeVolumeMl, 0, segmentVolumeMl || 0)

  if (adiposeVolumeMl !== null && segmentVolumeMl !== null && adiposeVolumeMl > segmentVolumeMl) {
    qualityFlags.push('adipose_volume_capped_to_segment_volume')
  }

  if (segmentVolumeMl === null || segmentVolumeMl <= 0) {
    qualityFlags.push('impossible_measurement')
  }

  const nonAdiposeVolumeMl =
    segmentVolumeMl === null || cappedAdiposeVolumeMl === null ? null : Math.max(0, segmentVolumeMl - cappedAdiposeVolumeMl)
  const adiposeMassKg = cappedAdiposeVolumeMl === null ? null : (cappedAdiposeVolumeMl * TISSUE_DENSITY_G_PER_ML.ADIPOSE) / 1000
  const nonAdiposeMassKg = nonAdiposeVolumeMl === null ? null : (nonAdiposeVolumeMl * TISSUE_DENSITY_G_PER_ML.BASELINE_NON_ADIPOSE) / 1000
  const rawSegmentMassKg = adiposeMassKg === null || nonAdiposeMassKg === null ? null : adiposeMassKg + nonAdiposeMassKg
  const regionalFatMassPercentage =
    rawSegmentMassKg && adiposeMassKg !== null ? (adiposeMassKg / rawSegmentMassKg) * 100 : null

  return {
    region: input.region,
    side: input.side ?? null,
    formulaVersion: BODY_ASSESSMENT_FORMULA_VERSION,
    status: segmentVolumeMl && segmentVolumeMl > 0 ? 'estimated' : 'insufficient_data',
    segmentVolumeMl: round(segmentVolumeMl),
    segmentVolumeLiters: round(segmentVolumeMl === null ? null : segmentVolumeMl / 1000),
    estimatedAdiposeVolumeMl: round(cappedAdiposeVolumeMl),
    estimatedNonAdiposeVolumeMl: round(nonAdiposeVolumeMl),
    rawEstimatedSegmentMassKg: round(rawSegmentMassKg, 3),
    estimatedAdiposeMassKg: round(adiposeMassKg, 3),
    estimatedNonAdiposeMassKg: round(nonAdiposeMassKg, 3),
    finalSegmentMassKg: null,
    finalNonAdiposeMassKg: null,
    regionalFatMassPercentage: round(regionalFatMassPercentage, 1),
    regionalMassShare: null,
    regionalFatDistribution: null,
    confidence,
    dataCompleteness: round(dataCompleteness, 2) || 0,
    reconciliationNote:
      'Circumference is modeled as geometry, skinfold as local subcutaneous thickness, and density converts estimated volume to estimated mass. Hydration and tissue state are not directly solved from these inputs.',
    qualityFlags,
    estimatedVolumeLiters: round(segmentVolumeMl === null ? null : segmentVolumeMl / 1000),
    estimatedSubcutaneousFatMassKg: round(adiposeMassKg, 3),
    estimatedRemainingNonFatMassKg: round(nonAdiposeMassKg, 3),
  }
}

export function calculateBodyCompositionEstimate(input: {
  bodyWeightLbs?: number | null
  bodyWeightKg?: number | null
  segments: RegionalMeasurementInput[]
}): BodyCompositionEstimate {
  const measuredBodyWeightKg = numeric(input.bodyWeightKg) ?? (numeric(input.bodyWeightLbs) ? poundsToKg(Number(input.bodyWeightLbs)) : null)
  const regional = input.segments.map(calculateRegionalCompositionEstimate)
  const estimableSegments = regional.filter((segment) => segment.rawEstimatedSegmentMassKg !== null && segment.estimatedAdiposeMassKg !== null)
  const modeledRawMassKg = estimableSegments.reduce((sum, segment) => sum + (segment.rawEstimatedSegmentMassKg || 0), 0)
  const totalFatMassKg = estimableSegments.length
    ? estimableSegments.reduce((sum, segment) => sum + (segment.estimatedAdiposeMassKg || 0), 0)
    : null
  const estimatedFatExceedsScale =
    measuredBodyWeightKg !== null && totalFatMassKg !== null && totalFatMassKg > measuredBodyWeightKg
  const rawNonFatMassKg = estimableSegments.reduce((sum, segment) => sum + (segment.estimatedNonAdiposeMassKg || 0), 0)
  const reconciliationMassKg = measuredBodyWeightKg === null ? null : measuredBodyWeightKg - modeledRawMassKg
  const finalNonFatTargetKg =
    measuredBodyWeightKg === null || totalFatMassKg === null || estimatedFatExceedsScale
      ? null
      : Math.max(0, measuredBodyWeightKg - totalFatMassKg)
  const nonFatAdjustmentKg =
    finalNonFatTargetKg === null || !rawNonFatMassKg ? null : finalNonFatTargetKg - rawNonFatMassKg

  const adjustedSegments = regional.map((segment) => {
    if (
      segment.rawEstimatedSegmentMassKg === null ||
      segment.estimatedAdiposeMassKg === null ||
      segment.estimatedNonAdiposeMassKg === null ||
      measuredBodyWeightKg === null ||
      finalNonFatTargetKg === null
    ) {
      return segment
    }

    const nonFatShare = rawNonFatMassKg > 0 ? segment.estimatedNonAdiposeMassKg / rawNonFatMassKg : 0
    const finalNonAdiposeMassKg = Math.max(0, segment.estimatedNonAdiposeMassKg + (nonFatAdjustmentKg || 0) * nonFatShare)
    const finalSegmentMassKg = segment.estimatedAdiposeMassKg + finalNonAdiposeMassKg

    return {
      ...segment,
      finalSegmentMassKg: round(finalSegmentMassKg, 3),
      finalNonAdiposeMassKg: round(finalNonAdiposeMassKg, 3),
      regionalMassShare: round((finalSegmentMassKg / measuredBodyWeightKg) * 100, 2),
      regionalFatDistribution: totalFatMassKg && totalFatMassKg > 0 ? round((segment.estimatedAdiposeMassKg / totalFatMassKg) * 100, 2) : null,
      reconciliationNote:
        'Scale weight is the whole-body mass constraint. Adipose estimates are not scaled during reconciliation; remaining mass is allocated to non-adipose or unresolved structural mass.',
    }
  })

  const modeledFinalMassKg = adjustedSegments.reduce((sum, segment) => sum + (segment.finalSegmentMassKg || 0), 0)
  const unresolvedStructuralMassKg =
    measuredBodyWeightKg === null ? null : round(measuredBodyWeightKg - modeledFinalMassKg, 3)
  const wholeBodyFatPercentage =
    measuredBodyWeightKg && totalFatMassKg !== null && !estimatedFatExceedsScale ? (totalFatMassKg / measuredBodyWeightKg) * 100 : null
  const totalNonFatMassKg =
    measuredBodyWeightKg === null || totalFatMassKg === null || estimatedFatExceedsScale ? null : Math.max(0, measuredBodyWeightKg - totalFatMassKg)

  return {
    formulaVersion: BODY_ASSESSMENT_FORMULA_VERSION,
    status: measuredBodyWeightKg !== null && totalFatMassKg !== null && !estimatedFatExceedsScale ? 'estimated' : 'insufficient_data',
    measuredBodyWeightKg: round(measuredBodyWeightKg, 3),
    measuredBodyWeightLbs: round(measuredBodyWeightKg === null ? null : kgToPounds(measuredBodyWeightKg), 1),
    modeledRawMassKg: round(modeledRawMassKg, 3) || 0,
    modeledFinalMassKg: round(modeledFinalMassKg, 3) || 0,
    totalEstimatedFatMassKg: round(totalFatMassKg, 3),
    totalEstimatedFatMassLbs: round(totalFatMassKg === null ? null : kgToPounds(totalFatMassKg), 1),
    totalEstimatedNonFatMassKg: round(totalNonFatMassKg, 3),
    totalEstimatedNonFatMassLbs: round(totalNonFatMassKg === null ? null : kgToPounds(totalNonFatMassKg), 1),
    wholeBodyFatPercentage: round(wholeBodyFatPercentage, 1),
    unresolvedStructuralMassKg,
    unresolvedStructuralMassLbs: round(unresolvedStructuralMassKg === null ? null : kgToPounds(unresolvedStructuralMassKg), 1),
    reconciliationMassKg: round(reconciliationMassKg, 3),
    segments: adjustedSegments,
    qualityFlags: [
      ...(measuredBodyWeightKg === null ? ['missing_scale_weight_whole_body_estimate_unavailable'] : []),
      ...(regional.some((segment) => segment.qualityFlags.includes('missing_regional_skinfold_adipose_unavailable'))
        ? ['some_segments_missing_skinfolds']
        : []),
      ...(regional.some((segment) => segment.status === 'insufficient_data') ? ['some_segments_insufficient_data'] : []),
      ...(estimatedFatExceedsScale ? ['estimated_adipose_mass_exceeds_scale_weight'] : []),
    ],
    assumptions: [
      'Circumference is geometry, not a fixed pounds-per-inch mass rule.',
      'Skinfolds estimate local subcutaneous adipose thickness; they are not regional body-fat percentages.',
      'Adipose and baseline non-adipose densities convert estimated volume to estimated mass.',
      'Whole-body body-fat percentage is total estimated fat mass divided by measured scale weight, never an average of regional percentages.',
      'Hydration, glycogen, and tissue state cannot be uniquely inferred from circumference and skinfold measurements alone.',
    ],
  }
}
