import * as styles from '../../../styles/globalstyles'
import TrackEvent from '@/components/TrackEvent'

export default function PhoenixSupportPage() {
  return (
    <><TrackEvent event="phoenix_support_page_viewed" properties={{ page: 'phoenix_support' }} />
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <h1 style={styles.heroTitleStyle}>
          Take time to choose your starting point.
        </h1>

        <p style={styles.heroTextStyle}>
          Cost, timing, and available capacity are part of the decision.
        </p>

        <section style={styles.sectionStyle}>
          <p style={styles.bodyStyle}>
            Review the current program options and billing details before
            choosing. You can decide which tools would be useful and whether
            this is the right time to begin.
          </p>

          <p style={styles.bodyStyle}>
            This page does not confirm an alternative payment arrangement or
            place on a program. Any available terms need to be confirmed before enrollment.
          </p>
        </section>

        <div style={styles.buttonRowStyle}>
          <a href="/program/phoenix/support/apply" style={styles.primaryButtonStyle}>
            Continue
          </a>
        </div>
      </div>
    </main>
    </>
  )
}
