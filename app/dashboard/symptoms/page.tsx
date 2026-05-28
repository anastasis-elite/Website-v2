import SymptomLogger from '@/components/SymptomLogger'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import * as styles from '../../styles/globalstyles'

export default async function SymptomsPage() {
  const { client } = await getDashboardContext()

  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Body Intelligence</p>

        <h1 style={styles.heroTitleStyle}>
          Log what your body is communicating.
        </h1>

        <p style={styles.heroTextStyle}>
          Track symptoms by body area, severity, timing, and context so
          Anastasis can begin identifying patterns across food, training,
          hydration, recovery, and cycle phase.
        </p>

        <SymptomLogger clientId={client.client_id} />
      </div>
    </main>
  )
}
