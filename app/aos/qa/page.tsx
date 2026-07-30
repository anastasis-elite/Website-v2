import { QaDashboard } from './components/qa-dashboard'
import { inMemoryReportStore } from './reports/in-memory-report-store'

export const dynamic = 'force-dynamic'

export default async function AOSQaPage() {
  const latestReport = await inMemoryReportStore.latest()

  return <QaDashboard initialReport={latestReport} />
}
