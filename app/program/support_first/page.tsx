import Link from 'next/link'
import * as styles from '../../styles/globalstyles'

export default function SupportFirstPage() {
  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Next Step</p>

        <h1 style={styles.heroTitleStyle}>
          Let’s build your foundation first.
        </h1>

        <p style={styles.heroTextStyle}>
          Your responses suggest taking time to consider support and daily
          structure before choosing a structured training plan.
        </p>

        <section style={styles.cartBoxStyle}>
          <h2 style={styles.sectionTitleStyle}>
            Consider a different starting point.
          </h2>

          <p style={styles.bodyStyle}>
            This is a suggested next step from the information you shared.
            Review it alongside your circumstances and consider what support
            would help you now.
          </p>
        </section>

        <section style={styles.cartBoxStyle}>
          <h2 style={styles.sectionTitleStyle}>
            Why this matters
          </h2>

          <p style={styles.bodyStyle}>
            Your available time, energy, and support matter. A manageable next
            step can leave room for the rest of your day.
          </p>
        </section>

        <section style={styles.cartBoxStyle}>
          <h2 style={styles.sectionTitleStyle}>
            The next best step
          </h2>

          <p style={styles.bodyStyle}>
            The Anastasis Shift is a forthcoming reflection guide about your
            priorities, daily structure, and manageable routines. It is still
            in development and is not available yet.
          </p>
        </section>

        <div style={styles.buttonRowStyle}>
          <Link href="/guide" style={styles.primaryButtonStyle}>
            Read about The Anastasis Shift
          </Link>

          <Link href="/apply" style={styles.secondaryButtonStyle}>
            Revisit Application
          </Link>
        </div>
      </div>
    </main>
  )
}
