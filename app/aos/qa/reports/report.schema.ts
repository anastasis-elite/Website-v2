import { isQaSeverity } from './severity'
import type { QaAgentKind, QaReport, QaViolation } from './report.types'

const qaAgents: QaAgentKind[] = ['functional', 'logic', 'experience']

export function isQaAgentKind(value: string): value is QaAgentKind {
  return qaAgents.includes(value as QaAgentKind)
}

export function validateQaViolation(violation: QaViolation): string[] {
  const errors: string[] = []

  if (!violation.id) errors.push('Violation id is required.')
  if (!violation.runId) errors.push('Violation runId is required.')
  if (!isQaAgentKind(violation.agent)) errors.push(`Invalid agent: ${violation.agent}`)
  if (!isQaSeverity(violation.severity)) errors.push(`Invalid severity: ${violation.severity}`)
  if (!violation.area) errors.push('Violation area is required.')
  if (!violation.title) errors.push('Violation title is required.')
  if (!violation.description) errors.push('Violation description is required.')
  if (!violation.timestamp) errors.push('Violation timestamp is required.')

  return errors
}

export function validateQaReport(report: QaReport): string[] {
  const errors: string[] = []

  if (!report.runId) errors.push('Report runId is required.')
  if (!report.startedAt) errors.push('Report startedAt is required.')
  if (!report.completedAt) errors.push('Report completedAt is required.')
  if (report.personaCount < 0) errors.push('Report personaCount cannot be negative.')
  if (report.scenariosPassed < 0) errors.push('Report scenariosPassed cannot be negative.')
  if (report.scenariosFailed < 0) errors.push('Report scenariosFailed cannot be negative.')
  if (!report.adapterName) errors.push('Report adapterName is required.')

  for (const violation of report.violations) {
    errors.push(...validateQaViolation(violation))
  }

  return errors
}
