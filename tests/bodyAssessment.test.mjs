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
  calculateRegionalCompositionEstimate,
} = await importTypescriptModule('lib/body-assessment/calculations.ts')

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
  assert.match(estimate.reconciliationNote, /not labeled as muscle/i)
  assert.match(estimate.reconciliationNote, /not silently assigned to fat/i)
  assert.ok(estimate.qualityFlags.includes('difficult_to_pinch_tissue_not_low_fat'))
  assert.ok((estimate.estimatedSubcutaneousFatMassKg || 0) > 0)
  assert.ok((estimate.estimatedRemainingNonFatMassKg || 0) > 0)
})
