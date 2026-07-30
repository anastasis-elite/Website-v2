'use server'

import { inMemoryReportStore } from '../reports/in-memory-report-store'

export async function getQaReportAction(runId?: string) {
  if (runId) return inMemoryReportStore.get(runId)
  return inMemoryReportStore.latest()
}
