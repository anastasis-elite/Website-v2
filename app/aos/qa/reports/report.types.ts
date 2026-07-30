import type { QaSeverity } from './severity'

export type QaAgentKind = 'functional' | 'logic' | 'experience'

export type QaViolation = {
  id: string
  runId: string
  agent: QaAgentKind
  ruleId?: string
  severity: QaSeverity
  area: string
  title: string
  description: string
  expected?: unknown
  actual?: unknown
  reproductionSteps?: string[]
  personaId?: string
  scenarioId?: string
  timestamp: string
}

export type QaRunError = {
  scenarioId?: string
  personaId?: string
  agent?: QaAgentKind
  message: string
  timestamp: string
}

export type QaAgentTotals = Record<QaAgentKind, number>

export type QaReport = {
  runId: string
  startedAt: string
  completedAt: string
  durationMs: number
  seed: string
  personaCount: number
  scenariosPassed: number
  scenariosFailed: number
  agentTotals: QaAgentTotals
  severityTotals: Record<QaSeverity, number>
  ruleViolationTotals: Record<string, number>
  topFailingRules: Array<{ ruleId: string; count: number }>
  topFrictionPoints: Array<{ area: string; count: number }>
  violations: QaViolation[]
  errors: QaRunError[]
  adapterName: string
}

export type QaReportSummary = Omit<QaReport, 'violations' | 'errors'> & {
  violationCount: number
  errorCount: number
}

export type ReportStore = {
  save(report: QaReport): Promise<void>
  latest(): Promise<QaReport | null>
  list(): Promise<QaReportSummary[]>
  get(runId: string): Promise<QaReport | null>
}
