import type { PlatformAdapter, PlatformOutcome } from '../adapters/adapter.types'
import { MockPlatformAdapter } from '../adapters/mock-platform-adapter'
import { anastasisConstitution } from '../constitution/constitution'
import { compareExpectedToActual } from '../agents/logic/comparison-engine'
import { scoreFriction } from '../agents/experience/friction-scoring'
import { generatePersonas } from '../personas/persona-generator'
import { hasValidEquipmentConfiguration } from '../personas/persona.schema'
import { generateScenarios } from '../personas/scenario-generator'
import type { SyntheticPersona, SyntheticScenario } from '../personas/persona.types'
import { runDailySimulation } from '../runners/daily-simulation-runner'

type SelfCheckResult = {
  name: string
  passed: boolean
  detail?: string
}

class ThrowingScenarioAdapter extends MockPlatformAdapter implements PlatformAdapter {
  name = 'throwing-scenario-adapter'

  async getScenarioOutcome(
    scenario: SyntheticScenario,
    persona: SyntheticPersona,
  ): Promise<PlatformOutcome> {
    if (scenario.id.endsWith('002')) {
      throw new Error('Intentional self-check scenario failure.')
    }

    return super.getScenarioOutcome(scenario, persona)
  }
}

export async function runQaSelfCheck(): Promise<SelfCheckResult[]> {
  const seed = 'self-check-2026-07-30'
  const firstPersonas = generatePersonas({ count: 100, seed })
  const secondPersonas = generatePersonas({ count: 100, seed })
  const scenarios = generateScenarios(firstPersonas)
  const adapter = new MockPlatformAdapter()
  const knownPersona = { ...firstPersonas[0], soreness: 9 }
  const knownScenario = { ...scenarios[0].scenario, trainingDayType: 'standard' as const }
  const badOutcome: PlatformOutcome = {
    scenarioId: knownScenario.id,
    recommendedExerciseCount: 9,
    includesRecoveryComponent: false,
    requiredEquipment: ['barbell'],
    triggeredInterventions: [],
    nextActions: [],
    completedAction: true,
    visibleFeedback: false,
    recoveryModel: {},
  }
  const logicComparison = compareExpectedToActual({
    runId: 'self-check',
    persona: knownPersona,
    scenario: knownScenario,
    actualOutcome: badOutcome,
  })
  const dailyResult = await runDailySimulation({
    count: 10,
    seed,
    adapter: new ThrowingScenarioAdapter(),
  })
  const fullMockRun = await runDailySimulation({
    count: 5,
    seed: `${seed}-mock`,
    adapter,
  })
  const evidence = {
    requiredDecisions: 6,
    requiredActions: 8,
    unclearLabels: ['Next'],
    hasConfirmation: false,
    missingExplanations: ['training focus'],
    deadEnds: ['completion'],
    contradictoryInstructions: [],
    fieldsInLargestForm: 14,
    repeatedDataRequests: ['soreness'],
    unavailableNextActions: ['start'],
    interruptsActiveWorkflow: true,
  }
  const firstExperienceScore = scoreFriction({
    runId: 'self-check',
    persona: firstPersonas[0],
    scenario: scenarios[0].scenario,
    evidence,
  })
  const secondExperienceScore = scoreFriction({
    runId: 'self-check',
    persona: firstPersonas[0],
    scenario: scenarios[0].scenario,
    evidence,
  })

  const results: SelfCheckResult[] = [
    {
      name: 'Seeded persona generation is reproducible',
      passed: JSON.stringify(firstPersonas) === JSON.stringify(secondPersonas),
    },
    {
      name: 'A count of 100 produces exactly 100 unique personas',
      passed: firstPersonas.length === 100 && new Set(firstPersonas.map((persona) => persona.id)).size === 100,
    },
    {
      name: 'Constitution rules have unique IDs',
      passed:
        new Set(anastasisConstitution.rules.map((rule) => rule.id)).size ===
        anastasisConstitution.rules.length,
    },
    {
      name: 'A known rule violation is detected',
      passed: logicComparison.violations.length > 0,
    },
    {
      name: 'Expected and actual values are included in logic failures',
      passed: logicComparison.violations.every(
        (violation) => violation.expected !== undefined && violation.actual !== undefined,
      ),
    },
    {
      name: 'One failed scenario does not stop the full run',
      passed: dailyResult.report.errors.length > 0 && dailyResult.report.personaCount === 10,
    },
    {
      name: 'Severity totals match violation totals',
      passed:
        Object.values(dailyResult.report.severityTotals).reduce((sum, count) => sum + count, 0) ===
        dailyResult.report.violations.length,
    },
    {
      name: 'The mock adapter allows the dashboard to execute a complete run',
      passed: fullMockRun.report.adapterName === adapter.name && fullMockRun.report.personaCount === 5,
    },
    {
      name: 'Experience scores are deterministic',
      passed:
        JSON.stringify({
          overallFrictionScore: firstExperienceScore.overallFrictionScore,
          dimensionScores: firstExperienceScore.dimensionScores,
          recommendations: firstExperienceScore.recommendations,
          evidence: firstExperienceScore.evidence,
        }) ===
        JSON.stringify({
          overallFrictionScore: secondExperienceScore.overallFrictionScore,
          dimensionScores: secondExperienceScore.dimensionScores,
          recommendations: secondExperienceScore.recommendations,
          evidence: secondExperienceScore.evidence,
        }),
    },
    {
      name: 'No generated scenario has an invalid equipment configuration',
      passed: firstPersonas.every((persona) => hasValidEquipmentConfiguration(persona.availableEquipment)),
    },
  ]

  return results.map((result) => ({
    ...result,
    detail: result.passed ? 'passed' : 'failed',
  }))
}

if (require.main === module) {
  void runQaSelfCheck().then((results) => {
    for (const result of results) {
      console.log(`${result.passed ? 'PASS' : 'FAIL'} ${result.name}`)
    }

    if (results.some((result) => !result.passed)) {
      process.exitCode = 1
    }
  })
}
