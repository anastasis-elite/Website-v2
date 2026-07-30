import type { QaViolation } from '../../reports/report.types'

export type FunctionalCheckKind =
  | 'route-availability'
  | 'page-rendering'
  | 'action-completion'
  | 'response-shape'
  | 'missing-data'
  | 'state-transition'
  | 'persistence'
  | 'navigation'

export type FunctionalCheckResult = {
  kind: FunctionalCheckKind
  passed: boolean
  area: string
  title: string
  expected: unknown
  actual: unknown
  message?: string
}

export type FunctionalAgentResult = {
  runId: string
  checks: FunctionalCheckResult[]
  violations: QaViolation[]
}
