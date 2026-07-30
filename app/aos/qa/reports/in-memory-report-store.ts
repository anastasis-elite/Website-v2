import type { QaReport, QaReportSummary, ReportStore } from './report.types'

const reports = new Map<string, QaReport>()
let latestRunId: string | null = null

export const inMemoryReportStore: ReportStore = {
  async save(report) {
    reports.set(report.runId, report)
    latestRunId = report.runId
  },
  async latest() {
    if (!latestRunId) return null
    return reports.get(latestRunId) ?? null
  },
  async list() {
    return Array.from(reports.values())
      .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
      .map(toSummary)
  },
  async get(runId) {
    return reports.get(runId) ?? null
  },
}

function toSummary(report: QaReport): QaReportSummary {
  const { violations, errors, ...summary } = report
  return {
    ...summary,
    violationCount: violations.length,
    errorCount: errors.length,
  }
}
