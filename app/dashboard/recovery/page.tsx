import Link from 'next/link'
import * as styles from '@/app/styles/globalstyles'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { getCycleStatus } from '@/lib/cycle/getCycleStatus'

export default async function RecoveryPage() {
  const { client } = await getDashboardContext()
  const cycleStatus = getCycleStatus(client)

  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Recovery</p>

        <h1 style={styles.heroTitleStyle}>
          Recovery timing
        </h1>

        <p style={styles.heroTextStyle}>
          Recovery is part of the plan. This page helps you understand when to
          push, when to soften, and when your body may need more support based
          on your current cycle phase and training load.
        </p>

        <section style={styles.cartBoxStyle}>
          <p style={styles.eyebrowStyle}>Current Cycle Phase</p>

          <h2 style={styles.sectionTitleStyle}>
            {cycleStatus?.phase || 'Cycle tracking preparing'}
          </h2>

          <p style={styles.bodyStyle}>
            Your recovery recommendations are built around where you are in your
            cycle, your current training plan, and your capacity.
          </p>
        </section>

        <section style={styles.cartBoxStyle}>
          <p style={styles.eyebrowStyle}>Today’s Recovery Guidance</p>

          <h2 style={styles.sectionTitleStyle}>
            Start with recovery that supports consistency.
          </h2>

          <p style={styles.bodyStyle}>
            If your body feels steady, follow your programmed training and keep
            recovery simple: hydration, nourishment, sleep, and mobility.
          </p>

          <p style={styles.bodyStyle}>
            If your body feels heavy, sore, inflamed, depleted, or unusually
            stressed, reduce intensity and prioritize walking, gentle mobility,
            stretching, breathwork, or rest.
          </p>
        </section>

        <section style={styles.cartBoxStyle}>
          <p style={styles.eyebrowStyle}>Recovery Tools</p>

          <h2 style={styles.sectionTitleStyle}>
            Choose what your body can receive today.
          </h2>

          <div
            style={{
              display: 'grid',
              gap: '14px',
              marginTop: '20px',
            }}
          >
            <div style={styles.innerCardStyle}>
              <h3 style={styles.sectionTitleStyle}>Gentle mobility</h3>
              <p style={styles.bodyStyle}>
                Use light movement to reduce stiffness without adding more
                stress to the system.
              </p>
            </div>

            <div style={styles.innerCardStyle}>
              <h3 style={styles.sectionTitleStyle}>Breathwork</h3>
              <p style={styles.bodyStyle}>
                Use slow breathing to help shift out of high-output mode and
                support recovery.
              </p>
            </div>

            <div style={styles.innerCardStyle}>
              <h3 style={styles.sectionTitleStyle}>Meditation</h3>
              <p style={styles.bodyStyle}>
                Use stillness when your mind and body need less input, not more.
              </p>
            </div>

            <div style={styles.innerCardStyle}>
              <h3 style={styles.sectionTitleStyle}>Epsom salt soak</h3>
              <p style={styles.bodyStyle}>
                A warm soak may support relaxation, decompression, and an easier
                transition into rest.
              </p>
            </div>
          </div>
        </section>

        <div style={{ marginTop: '28px' }}>
          <Link href="/dashboard" style={styles.secondaryButtonStyle}>
            Back to Dashboard
          </Link>
        </div>
      </div>
    </main>
  )
}
