import Link from 'next/link'
import * as styles from '../../styles/globalstyles'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { getCycleStatus } from '@/lib/cycle/getCycleStatus'
import CycleTracker from '@/components/CycleTracker'

export default async function CyclePage() {
  const { supabase, client } = await getDashboardContext()

  const cycleStatus = getCycleStatus(client)

  const today = new Date().toISOString().split('T')[0]

  const { data: todayLog } = await supabase
    .from('cycle_logs')
    .select('*')
    .eq('client_id', client.client_id)
    .eq('log_date', today)
    .maybeSingle()
  
  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Cycle Awareness</p>

        <h1 style={styles.heroTitleStyle}>
          Your body context for today.
        </h1>

        <p style={styles.heroTextStyle}>
          This space is for awareness only. It does not diagnose, prescribe, or
          override your lived symptoms. It simply helps the system notice where
          you may be in your cycle so recovery recommendations can stay more
          supportive.
        </p>

        <section style={styles.cartBoxStyle}>
          <h2 style={styles.sectionTitleStyle}>
            {cycleStatus.enabled
              ? `Cycle Day ${cycleStatus.cycleDay}`
              : 'Cycle tracking is not active yet.'}
          </h2>

          {cycleStatus.enabled ? (
            <>
              <p style={styles.bodyStyle}>
                <strong>Estimated phase:</strong>{' '}
                {cycleStatus.phase}
              </p>

              <p style={styles.bodyStyle}>
                {cycleStatus.recoveryNote}
              </p>

              <p style={{ ...styles.bodyStyle, opacity: 0.72 }}>
                This estimate is based on your last period start date and
                average cycle length. Your actual symptoms are always the
                stronger signal.
              </p>
            </>
          ) : (
            <p style={styles.bodyStyle}>
              Add your last period start date and average cycle length to begin
              cycle-aware recovery guidance.
            </p>
          )}
        </section>

        <CycleTracker
          clientId={client.client_id}
          cycleStatus={cycleStatus}
          lastPeriodStart={client.last_period_start}
          averageCycleLength={client.average_cycle_length}
          cycleTrackingEnabled={client.cycle_tracking_enabled}
          todayLog={todayLog}
        />

        <div style={styles.buttonRowStyle}>
          <Link href="/dashboard" style={styles.secondaryButtonStyle}>
            Back to Dashboard
          </Link>
        </div>
      </div>
    </main>
  )
}
