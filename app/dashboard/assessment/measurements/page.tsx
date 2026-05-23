import * as styles from '@/app/styles/globalstyles'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import MeasurementAssessment from '@/components/MeasurementAssessment'

export default async function MeasurementsPage() {
  const { client } = await getDashboardContext()

  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Physical Assessment</p>

        <h1 style={styles.heroTitleStyle}>
          Measure with clarity, not pressure.
        </h1>

        <p style={styles.heroTextStyle}>
          This guided assessment helps you take consistent measurements without
          having to remember where every point belongs. Use the diagram as a
          calm reference, enter what you have, and leave anything that does not
          apply today.
        </p>

        <MeasurementAssessment clientId={client.client_id} />
      </div>
    </main>
  )
}
