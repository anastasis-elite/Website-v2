import { MockPlatformAdapter } from '../adapters/mock-platform-adapter'
import { runExperienceAgent } from '../agents/experience/experience-agent'
import { runFunctionalAgent } from '../agents/functional/functional-agent'
import { runLogicAgent } from '../agents/logic/logic-agent'
import { generatePersonas } from '../personas/persona-generator'
import { generateScenarios } from '../personas/scenario-generator'
import { buildQaReport } from '../reports/report-builder'
import { inMemoryReportStore } from '../reports/in-memory-report-store'
import type { QaRunError, QaViolation } from '../reports/report.types'
import type { AgentRunnerInput } from './runner.types'

// Internal AOS QA tooling only. Real adapters must preserve the same structured-report contract.
export async function runAgent(input: Omit<AgentRunnerInput, 'adapter'> & { adapter?: AgentRunnerInput['adapter'] }) {
  const adapter = input.adapter ?? new MockPlatformAdapter()
  const count = input.count ?? 10
  const seed = input.seed ?? new Date().toISOString().slice(0, 10)
  const runId = `qa-${input.mode}-${seed}-${Date.now()}`
  const startedAt = new Date().toISOString()
  const personaScenarios = generateScenarios(generatePersonas({ count, seed }))
  const violations: QaViolation[] = []
  const errors: QaRunError[] = []

  if (input.mode === 'functional' || input.mode === 'all') {
    const result = await runFunctionalAgent({ runId, adapter, personaScenarios })
    violations.push(...result.violations)
  }

  if (input.mode === 'logic' || input.mode === 'all') {
    const result = await runLogicAgent({ runId, adapter, personaScenarios })
    violations.push(...result.violations)
    errors.push(...result.errors)
  }

  if (input.mode === 'experience' || input.mode === 'all') {
    const result = await runExperienceAgent({ runId, adapter, personaScenarios })
    violations.push(...result.violations)
    errors.push(...result.errors)
  }

  const report = buildQaReport({
    runId,
    startedAt,
    completedAt: new Date().toISOString(),
    seed,
    personaCount: personaScenarios.length,
    scenarioCount: personaScenarios.length,
    violations,
    errors,
    adapterName: adapter.name,
  })

  await inMemoryReportStore.save(report)
  return report
}
