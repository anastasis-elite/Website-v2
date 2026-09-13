import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

async function importTypescriptModule(path) {
  const source = readFileSync(path, 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2020,
      target: ts.ScriptTarget.ES2022,
    },
  })
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
}

const {
  addCalendarMonths,
  getBodyAssessmentScheduleStatus,
} = await importTypescriptModule('lib/body-assessment/schedule.ts')

const {
  BODY_ASSESSMENT_FORMULA_VERSION,
  calculateBodyCompositionEstimate,
  calculateRegionalCompositionEstimate,
  inchesToCm,
  kgToPounds,
  mmToCm,
  poundsToKg,
  segmentVolumeFromCircumferencesMl,
} = await importTypescriptModule('lib/body-assessment/calculations.ts')

function fullRegionalMeasurementFixture() {
  return [
    { region: 'upper_arm', side: 'left', lengthCm: 31, circumferences: [{ site: 'midpoint', circumferenceCm: 32 }], skinfoldSites: [{ site: 'triceps', skinfoldMm: 12 }] },
    { region: 'upper_arm', side: 'right', lengthCm: 31, circumferences: [{ site: 'midpoint', circumferenceCm: 36 }], skinfoldSites: [{ site: 'triceps', skinfoldMm: 18 }] },
    { region: 'forearm', side: 'left', lengthCm: 25, circumferences: [{ site: 'midpoint', circumferenceCm: 27 }], skinfoldSites: [{ site: 'forearm', skinfoldMm: 8 }] },
    { region: 'forearm', side: 'right', lengthCm: 25, circumferences: [{ site: 'midpoint', circumferenceCm: 29 }], skinfoldSites: [{ site: 'forearm', skinfoldMm: 10 }] },
    { region: 'upper_torso', side: 'midline', lengthCm: 24, circumferences: [{ site: 'bust_chest', circumferenceCm: 96, position: 0 }, { site: 'underbust', circumferenceCm: 84, position: 1 }], skinfoldSites: [{ site: 'chest', skinfoldMm: 14 }] },
    { region: 'torso_abdomen', side: 'midline', lengthCm: 26, circumferences: [{ site: 'waist', circumferenceCm: 82, position: 0.35 }, { site: 'lower_abdomen', circumferenceCm: 90, position: 0.8 }], skinfoldSites: [{ site: 'abdominal', skinfoldMm: 22 }] },
    { region: 'pelvis_hips', side: 'midline', lengthCm: 18, circumferences: [{ site: 'hips', circumferenceCm: 104 }], skinfoldSites: [{ site: 'suprailiac', skinfoldMm: 20 }] },
    { region: 'thigh', side: 'left', lengthCm: 42, circumferences: [{ site: 'midpoint', circumferenceCm: 54 }], skinfoldSites: [{ site: 'anterior_thigh', skinfoldMm: 16 }] },
    { region: 'thigh', side: 'right', lengthCm: 42, circumferences: [{ site: 'midpoint', circumferenceCm: 60 }], skinfoldSites: [{ site: 'anterior_thigh', skinfoldMm: 22 }] },
    { region: 'lower_leg_calf', side: 'left', lengthCm: 38, circumferences: [{ site: 'midpoint', circumferenceCm: 37 }], skinfoldSites: [{ site: 'medial_calf', skinfoldMm: 10 }] },
    { region: 'lower_leg_calf', side: 'right', lengthCm: 38, circumferences: [{ site: 'midpoint', circumferenceCm: 39 }], skinfoldSites: [{ site: 'medial_calf', skinfoldMm: 12 }] },
  ]
}

test('monthly and structural assessment cadence uses calendar months', () => {
  assert.equal(addCalendarMonths('2026-01-31', 1), '2026-02-28')
  assert.equal(addCalendarMonths('2026-01-31', 9), '2026-10-31')

  const status = getBodyAssessmentScheduleStatus({
    today: '2026-10-31',
    latestMonthlyCompletedAt: '2026-09-30',
    latestStructuralCompletedAt: '2026-01-31',
  })

  assert.equal(status.monthlyDue, true)
  assert.equal(status.structuralDue, true)
  assert.equal(status.dueKind, 'full')
  assert.equal(status.title, 'Full Body Assessment Due')
})

test('dashboard status exposes not due and in progress labels', () => {
  const notDue = getBodyAssessmentScheduleStatus({
    today: '2026-09-09',
    latestMonthlyCompletedAt: '2026-09-01',
    latestStructuralCompletedAt: '2026-08-01',
  })

  assert.equal(notDue.title, 'Body Assessment')
  assert.equal(notDue.daysUntilNext, 22)

  const inProgress = getBodyAssessmentScheduleStatus({
    today: '2026-09-09',
    latestMonthlyCompletedAt: '2026-08-01',
    latestStructuralCompletedAt: '2026-01-01',
    activeSession: { id: 'session-1', assessment_type: 'monthly', status: 'draft' },
  })

  assert.equal(inProgress.title, 'Body Assessment In Progress')
  assert.equal(inProgress.actionLabel, 'Continue')
})

test('regional composition is estimated and does not assign residual mass to fat or muscle', () => {
  const estimate = calculateRegionalCompositionEstimate({
    region: 'upper_arm',
    side: 'left',
    lengthCm: 31,
    proximalCircumferenceCm: 34,
    midpointCircumferenceCm: 32,
    distalCircumferenceCm: 27,
    skinfoldAttemptsMm: [18, 19, 20],
    tissuePinchQuality: 'difficult',
  })

  assert.equal(estimate.formulaVersion, BODY_ASSESSMENT_FORMULA_VERSION)
  assert.equal(estimate.status, 'estimated')
  assert.match(estimate.reconciliationNote, /Circumference is modeled as geometry/i)
  assert.match(estimate.reconciliationNote, /Hydration and tissue state are not directly solved/i)
  assert.ok(estimate.qualityFlags.includes('difficult_to_pinch_tissue_not_low_fat'))
  assert.ok((estimate.estimatedSubcutaneousFatMassKg || 0) > 0)
  assert.ok((estimate.estimatedRemainingNonFatMassKg || 0) > 0)
})

test('whole-body fat percentage is not an average of regional percentages', () => {
  const estimate = calculateBodyCompositionEstimate({
    bodyWeightLbs: 180,
    segments: [
      { region: 'upper_arm', side: 'left', lengthCm: 31, circumferences: [{ site: 'midpoint', circumferenceCm: 32 }], skinfoldSites: [{ site: 'triceps', skinfoldMm: 12 }] },
      { region: 'upper_arm', side: 'right', lengthCm: 31, circumferences: [{ site: 'midpoint', circumferenceCm: 36 }], skinfoldSites: [{ site: 'triceps', skinfoldMm: 20 }] },
    ],
  })

  const averagedRegionalPercent =
    (estimate.segments[0].regionalFatMassPercentage + estimate.segments[1].regionalFatMassPercentage) / 2
  const summedFatMass = estimate.segments.reduce((sum, segment) => sum + (segment.estimatedAdiposeMassKg || 0), 0)

  assert.equal(estimate.totalEstimatedFatMassKg, Math.round(summedFatMass * 1000) / 1000)
  assert.equal(estimate.wholeBodyFatPercentage, Math.round(((summedFatMass / estimate.measuredBodyWeightKg) * 100) * 10) / 10)
  assert.notEqual(estimate.wholeBodyFatPercentage, averagedRegionalPercent)
})

test('unequal left and right segment masses preserve unequal fat contribution', () => {
  const estimate = calculateBodyCompositionEstimate({
    bodyWeightLbs: 180,
    segments: [
      { region: 'upper_arm', side: 'left', lengthCm: 31, circumferences: [{ site: 'midpoint', circumferenceCm: 32 }], skinfoldSites: [{ site: 'triceps', skinfoldMm: 12 }] },
      { region: 'upper_arm', side: 'right', lengthCm: 31, circumferences: [{ site: 'midpoint', circumferenceCm: 36 }], skinfoldSites: [{ site: 'triceps', skinfoldMm: 20 }] },
    ],
  })

  assert.equal(estimate.segments[0].side, 'left')
  assert.equal(estimate.segments[1].side, 'right')
  assert.notEqual(estimate.segments[0].regionalFatDistribution, estimate.segments[1].regionalFatDistribution)
  assert.notEqual(estimate.segments[0].finalSegmentMassKg, estimate.segments[1].finalSegmentMassKg)
})

test('complete synthetic body fixture reconciles mass and sums fat mass', () => {
  const estimate = calculateBodyCompositionEstimate({
    bodyWeightLbs: 180,
    segments: fullRegionalMeasurementFixture(),
  })
  const summedFinalMass = estimate.segments.reduce((sum, segment) => sum + (segment.finalSegmentMassKg || 0), 0)
  const summedFatMass = estimate.segments.reduce((sum, segment) => sum + (segment.estimatedAdiposeMassKg || 0), 0)

  assert.equal(estimate.status, 'estimated')
  assert.equal(Math.round((summedFinalMass + (estimate.unresolvedStructuralMassKg || 0)) * 1000) / 1000, estimate.measuredBodyWeightKg)
  assert.equal(estimate.totalEstimatedFatMassKg, Math.round(summedFatMass * 1000) / 1000)
  assert.equal(estimate.totalEstimatedNonFatMassKg, Math.round((estimate.measuredBodyWeightKg - summedFatMass) * 1000) / 1000)
  assert.equal(estimate.wholeBodyFatPercentage, Math.round(((summedFatMass / estimate.measuredBodyWeightKg) * 100) * 10) / 10)
})

test('regional geometry reconciles modeled mass to scale weight without scaling adipose mass', () => {
  const estimate = calculateBodyCompositionEstimate({
    bodyWeightLbs: 180,
    segments: [
      {
        region: 'upper_arm',
        side: 'left',
        lengthCm: 31,
        circumferences: [{ site: 'midpoint', circumferenceCm: 32 }],
        skinfoldSites: [{ site: 'triceps', skinfoldMm: 16 }],
      },
      {
        region: 'upper_arm',
        side: 'right',
        lengthCm: 31,
        circumferences: [{ site: 'midpoint', circumferenceCm: 36 }],
        skinfoldSites: [{ site: 'triceps', skinfoldMm: 16 }],
      },
    ],
  })

  const summedFinalMass = estimate.segments.reduce((sum, segment) => sum + (segment.finalSegmentMassKg || 0), 0)
  const summedFatMass = estimate.segments.reduce((sum, segment) => sum + (segment.estimatedAdiposeMassKg || 0), 0)

  assert.equal(Math.round((summedFinalMass + (estimate.unresolvedStructuralMassKg || 0)) * 1000) / 1000, estimate.measuredBodyWeightKg)
  assert.equal(Math.round(summedFatMass * 1000) / 1000, estimate.totalEstimatedFatMassKg)
  assert.equal(estimate.wholeBodyFatPercentage, Math.round(((summedFatMass / estimate.measuredBodyWeightKg) * 100) * 10) / 10)
})

test('circumference changes produce nonlinear volume changes', () => {
  const smaller = segmentVolumeFromCircumferencesMl(30, [{ site: 'midpoint', circumferenceCm: 30 }])
  const larger = segmentVolumeFromCircumferencesMl(30, [{ site: 'midpoint', circumferenceCm: 32 }])

  assert.ok(larger > smaller)
  assert.ok(larger - smaller > 2 * (smaller / 30))
})

test('identical circumference changes on different sized segments do not produce identical volume changes', () => {
  const smallBase = segmentVolumeFromCircumferencesMl(30, [{ site: 'midpoint', circumferenceCm: 25 }])
  const smallPlus = segmentVolumeFromCircumferencesMl(30, [{ site: 'midpoint', circumferenceCm: 26 }])
  const largeBase = segmentVolumeFromCircumferencesMl(30, [{ site: 'midpoint', circumferenceCm: 40 }])
  const largePlus = segmentVolumeFromCircumferencesMl(30, [{ site: 'midpoint', circumferenceCm: 41 }])

  assert.notEqual(Math.round((smallPlus - smallBase) * 100), Math.round((largePlus - largeBase) * 100))
})

test('higher skinfold with identical geometry produces greater estimated adipose mass', () => {
  const leaner = calculateRegionalCompositionEstimate({
    region: 'thigh',
    side: 'left',
    lengthCm: 42,
    midpointCircumferenceCm: 56,
    skinfoldAttemptsMm: [10],
  })
  const higher = calculateRegionalCompositionEstimate({
    region: 'thigh',
    side: 'left',
    lengthCm: 42,
    midpointCircumferenceCm: 56,
    skinfoldAttemptsMm: [20],
  })

  assert.ok(higher.estimatedSubcutaneousFatMassKg > leaner.estimatedSubcutaneousFatMassKg)
})

test('left and right asymmetry is preserved as separate compartments', () => {
  const estimate = calculateBodyCompositionEstimate({
    bodyWeightLbs: 180,
    segments: [
      { region: 'thigh', side: 'left', lengthCm: 42, midpointCircumferenceCm: 54, skinfoldAttemptsMm: [12] },
      { region: 'thigh', side: 'right', lengthCm: 42, midpointCircumferenceCm: 60, skinfoldAttemptsMm: [18] },
    ],
  })

  assert.equal(estimate.segments.length, 2)
  assert.equal(estimate.segments[0].side, 'left')
  assert.equal(estimate.segments[1].side, 'right')
  assert.notEqual(estimate.segments[0].rawEstimatedSegmentMassKg, estimate.segments[1].rawEstimatedSegmentMassKg)
})

test('missing and impossible measurements are flagged without NaN or Infinity', () => {
  const missing = calculateRegionalCompositionEstimate({
    region: 'forearm',
    side: 'left',
    midpointCircumferenceCm: 28,
  })
  const impossible = calculateRegionalCompositionEstimate({
    region: 'forearm',
    side: 'right',
    lengthCm: -1,
    midpointCircumferenceCm: Number.POSITIVE_INFINITY,
    skinfoldAttemptsMm: [-10],
  })

  for (const estimate of [missing, impossible]) {
    assert.equal(estimate.status, 'insufficient_data')
    assert.ok(estimate.qualityFlags.includes('missing_required_measurements'))
    assert.doesNotThrow(() => JSON.stringify(estimate))
    assert.equal(JSON.stringify(estimate).includes('NaN'), false)
    assert.equal(JSON.stringify(estimate).includes('Infinity'), false)
  }
})

test('impossible adipose mass does not produce impossible whole-body output', () => {
  const estimate = calculateBodyCompositionEstimate({
    bodyWeightLbs: 5,
    segments: [
      { region: 'torso_abdomen', side: 'midline', lengthCm: 100, midpointCircumferenceCm: 200, skinfoldAttemptsMm: [80] },
    ],
  })

  assert.equal(estimate.status, 'insufficient_data')
  assert.equal(estimate.wholeBodyFatPercentage, null)
  assert.equal(estimate.totalEstimatedNonFatMassKg, null)
  assert.ok(estimate.qualityFlags.includes('estimated_adipose_mass_exceeds_scale_weight'))
  assert.equal(JSON.stringify(estimate).includes('NaN'), false)
  assert.equal(JSON.stringify(estimate).includes('Infinity'), false)
})

test('unit conversions are explicit and reversible', () => {
  assert.equal(inchesToCm(10), 25.4)
  assert.equal(mmToCm(16), 1.6)
  assert.equal(Math.round(poundsToKg(180) * 1000) / 1000, 81.647)
  assert.equal(Math.round(kgToPounds(poundsToKg(180)) * 10) / 10, 180)
})

test('historical regional estimates remain readable under legacy fields', () => {
  const estimate = calculateRegionalCompositionEstimate({
    region: 'upper_arm',
    side: 'left',
    lengthCm: 31,
    proximalCircumferenceCm: 34,
    midpointCircumferenceCm: 32,
    distalCircumferenceCm: 27,
    skinfoldAttemptsMm: [18, 19, 20],
  })

  assert.equal(estimate.status, 'estimated')
  assert.ok(estimate.estimatedVolumeLiters > 0)
  assert.ok(estimate.estimatedSubcutaneousFatMassKg > 0)
})

test('existing users are not silently assigned fabricated skinfold measurements', () => {
  const estimate = calculateRegionalCompositionEstimate({
    region: 'upper_arm',
    side: 'left',
    lengthCm: 31,
    midpointCircumferenceCm: 32,
  })

  assert.equal(estimate.estimatedSubcutaneousFatMassKg, null)
  assert.ok(estimate.qualityFlags.includes('missing_regional_skinfold_adipose_unavailable'))
  assert.equal(estimate.confidence, 'low')
})
