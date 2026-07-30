import { NextResponse } from 'next/server'
import { inMemoryReportStore } from '../../reports/in-memory-report-store'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const runId = url.searchParams.get('runId')
  const report = runId ? await inMemoryReportStore.get(runId) : await inMemoryReportStore.latest()
  const reports = await inMemoryReportStore.list()

  return NextResponse.json({
    ok: true,
    report,
    reports,
  })
}
