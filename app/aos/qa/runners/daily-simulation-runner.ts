import { runExperienceAgent } from '../agents/experience/experience-agent'
import { runFunctionalAgent } from '../agents/functional/functional-agent'
import { runLogicAgent } from '../agents/logic/logic-agent'
import type { PersonaScenario } from '../personas/persona.types'
import { generatePersonas } from '../personas/persona-generator'
import { generateScenarios } from '../personas/scenario-generator'
import { buildQaReport } from '../reports/report-builder'
import { inMemoryReportStore } from '../reports/in-memory-report-store'
import type { QaRunError, QaViolation } from '../reports/report.types'
import { validateQaReport } from '../reports/report.schema'
import type { DailySimulationInput, DailySimulationResult } from './runner.types'
import { runWithConcurrency } from './scenario-runner'

const defaultDailyCount = 100
const defaultConcurrency = 5

// Internal AOS QA tooling only. This runner intentionally makes no external network calls by default.
export async function runDailySimulation(input: DailySimulationInput): Promise<DailySimulationResult> {
  const count = normalizeCount(input.count)
  const seed = input.seed ?? new Date().toISOString().slice(0, 10)
  const concurrency = Math.max(1, input.concurrency ?? defaultConcurrency)
  const runId = `qa-${seed}-${Date.now()}`
  const startedAt = new Date().toISOString()
  const personas = generatePersonas({ count, seed })
  const personaScenarios = generateScenarios(personas)
  const violations: QaViolation[] = []
  const errors: QaRunError[] = []

  const functionalResult = await runFunctionalAgent({
    runId,
    adapter: input.adapter,
    personaScenarios,
  })
  violations.push(...functionalResult.violations)

  const scenarioResults = await runWithConcurrency(personaScenarios, concurrency, async (personaScenario) =>
    runAllScenarioAgents({
      runId,
      adapter: input.adapter,
      personaScenario,
    }),
  )

  for (const result of scenarioResults) {
    violations.push(...result.violations)
    errors.push(...result.errors)
  }

  const completedAt = new Date().toISOString()
  const report = buildQaReport({
    runId,
    startedAt,
    completedAt,
    seed,
    personaCount: personas.length,
    scenarioCount: personaScenarios.length,
    violations,
    errors,
    adapterName: input.adapter.name,
  })

  const validationErrors = validateQaReport(report)
  if (validationErrors.length > 0) {
    report.errors.push({
      message: `Report validation failed: ${validationErrors.join(' ')}`,
      timestamp: new Date().toISOString(),
    })
  }

  await inMemoryReportStore.save(report)

  return { report }
}

async function runAllScenarioAgents(input: {
  runId: string
  adapter: DailySimulationInput['adapter']
  personaScenario: PersonaScenario
}): Promise<{ violations: QaViolation[]; errors: QaRunError[] }> {
  const logicResult = await runLogicAgent({
    runId: input.runId,
    adapter: input.adapter,
    personaScenarios: [input.personaScenario],
  })
  const experienceResult = await runExperienceAgent({
    runId: input.runId,
    adapter: input.adapter,
    personaScenarios: [input.personaScenario],
  })

  return {
    violations: [...logicResult.violations, ...experienceResult.violations],
    errors: [...logicResult.errors, ...experienceResult.errors],
  }
}

function normalizeCount(count: number | undefined): number {
  if (count === undefined) return defaultDailyCount
  if (!Number.isFinite(count)) return defaultDailyCount
  return Math.max(1, Math.min(500, Math.floor(count)))
}
