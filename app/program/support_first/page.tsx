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
          Based on your responses, the most aligned next step is to prioritize
          stability, support, and self-trust before moving into a structured
          training program.
        </p>

        <section style={styles.cartBoxStyle}>
          <h2 style={styles.sectionTitleStyle}>
            This is not a rejection.
          </h2>

          <p style={styles.bodyStyle}>
            It simply means your body, nervous system, schedule, or current
            capacity may need a different starting point before structured
            progression can be effective and sustainable.
          </p>
        </section>

        <section style={styles.cartBoxStyle}>
          <h2 style={styles.sectionTitleStyle}>
            Why this matters
          </h2>

          <p style={styles.bodyStyle}>
            Your body is not something to push through. It is something to work
            with. Creating the right foundation now allows you to progress
            faster, safer, and more sustainably long-term.
          </p>
        </section>

        <section style={styles.cartBoxStyle}>
          <h2 style={styles.sectionTitleStyle}>
            The next best step
          </h2>

          <p style={styles.bodyStyle}>
            The Anastasis Shift was created for women who are not quite ready
            to enter the full program yet, but who are ready to rebuild the
            structure, trust, and execution capacity needed to get there.
          </p>
        </section>

        <div style={styles.buttonRowStyle}>
          <Link href="/guide" style={styles.primaryButtonStyle}>
            Begin The Anastasis Shift
          </Link>

          <Link href="/apply" style={styles.secondaryButtonStyle}>
            Revisit Application
          </Link>
        </div>
      </div>
    </main>
  )
}
