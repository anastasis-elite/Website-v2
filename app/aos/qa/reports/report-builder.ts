import type { QaAgentKind, QaReport, QaRunError, QaViolation } from './report.types'
import { createSeverityTotals } from './severity'

export type BuildQaReportInput = {
  runId: string
  startedAt: string
  completedAt: string
  seed: string
  personaCount: number
  scenarioCount: number
  violations: QaViolation[]
  errors: QaRunError[]
  adapterName: string
}

const agentKinds: QaAgentKind[] = ['functional', 'logic', 'experience']

export function buildQaReport(input: BuildQaReportInput): QaReport {
  const started = new Date(input.startedAt).getTime()
  const completed = new Date(input.completedAt).getTime()
  const severityTotals = createSeverityTotals()
  const agentTotals: Record<QaAgentKind, number> = {
    functional: 0,
    logic: 0,
    experience: 0,
  }
  const ruleViolationTotals: Record<string, number> = {}
  const frictionTotals: Record<string, number> = {}

  for (const violation of input.violations) {
    severityTotals[violation.severity] += 1
    agentTotals[violation.agent] += 1

    if (violation.ruleId) {
      ruleViolationTotals[violation.ruleId] = (ruleViolationTotals[violation.ruleId] ?? 0) + 1
    }

    if (violation.agent === 'experience') {
      frictionTotals[violation.area] = (frictionTotals[violation.area] ?? 0) + 1
    }
  }

  for (const agent of agentKinds) {
    agentTotals[agent] = agentTotals[agent] ?? 0
  }

  const failedScenarioIds = new Set(
    input.violations
      .map((violation) => violation.scenarioId)
      .filter((scenarioId): scenarioId is string => Boolean(scenarioId)),
  )

  return {
    runId: input.runId,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    durationMs: Math.max(0, completed - started),
    seed: input.seed,
    personaCount: input.personaCount,
    scenariosPassed: Math.max(0, input.scenarioCount - failedScenarioIds.size),
    scenariosFailed: failedScenarioIds.size,
    agentTotals,
    severityTotals,
    ruleViolationTotals,
    topFailingRules: sortTotals(ruleViolationTotals, 'ruleId'),
    topFrictionPoints: sortTotals(frictionTotals, 'area'),
    violations: input.violations,
    errors: input.errors,
    adapterName: input.adapterName,
  }
}

function sortTotals<Key extends 'ruleId' | 'area'>(
  totals: Record<string, number>,
  key: Key,
): Array<Record<Key, string> & { count: number }> {
  return Object.entries(totals)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 10)
    .map(([value, count]) => ({ [key]: value, count }) as Record<Key, string> & { count: number })
}
