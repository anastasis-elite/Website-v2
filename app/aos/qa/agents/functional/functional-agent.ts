import type { PlatformAdapter } from '../../adapters/adapter.types'
import type { PersonaScenario } from '../../personas/persona.types'
import type { QaViolation } from '../../reports/report.types'
import { actionResultToFunctionalChecks, defaultAosQaRoutes, routeChecksToFunctionalResults } from './functional-checks'
import type { FunctionalAgentResult, FunctionalCheckResult } from './functional.types'

export async function runFunctionalAgent(input: {
  runId: string
  adapter: PlatformAdapter
  personaScenarios: PersonaScenario[]
}): Promise<FunctionalAgentResult> {
  const checks: FunctionalCheckResult[] = []

  if (!input.adapter.capabilities.functionalChecks) {
    checks.push({
      kind: 'missing-data',
      passed: false,
      area: input.adapter.name,
      title: 'Functional checks unsupported by adapter',
      expected: 'Adapter supports functionalChecks',
      actual: input.adapter.capabilities,
      message: 'Use a browser or application adapter when available.',
    })
  } else {
    checks.push(...routeChecksToFunctionalResults(await input.adapter.checkRoutes(defaultAosQaRoutes)))

    const sample = input.personaScenarios.slice(0, 5)
    for (const item of sample) {
      const result = await input.adapter.performAction('complete-check-in', item.scenario, item.persona)
      checks.push(...actionResultToFunctionalChecks(result))
    }
  }

  return {
    runId: input.runId,
    checks,
    violations: checks
      .filter((check) => !check.passed)
      .map((check, index) => functionalCheckToViolation(input.runId, check, index)),
  }
}

function functionalCheckToViolation(
  runId: string,
  check: FunctionalCheckResult,
  index: number,
): QaViolation {
  return {
    id: `${runId}-functional-${String(index + 1).padStart(4, '0')}`,
    runId,
    agent: 'functional',
    severity: check.kind === 'route-availability' ? 'high' : 'medium',
    area: check.area,
    title: check.title,
    description: check.message ?? 'Functional check failed.',
    expected: check.expected,
    actual: check.actual,
    reproductionSteps: ['Run the Functional QA Agent.', `Inspect ${check.area}.`],
    timestamp: new Date().toISOString(),
  }
}
