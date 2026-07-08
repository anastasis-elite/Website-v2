import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import MeasurementAssessment from '@/components/MeasurementAssessment'

export default async function MeasurementsPage() {
  const { client } = await getDashboardContext()

  return (
    <main className="aos-flow-page">
      <div className="aos-flow-shell">
        <header className="aos-flow-hero">
        <p className="aos-eyebrow">Physical Assessment</p>
        <h1>Measure with clarity, not pressure.</h1>
        <p>
          This guided assessment helps you take consistent measurements without
          having to remember where every point belongs. Use the diagram as a
          calm reference, enter what you have, and leave anything that does not
          apply today.
        </p>
        </header>

        <MeasurementAssessment clientId={client.client_id} />
      </div>
    </main>
  )
}
