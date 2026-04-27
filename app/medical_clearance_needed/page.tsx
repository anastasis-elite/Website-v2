import * as styles from '../styles/globalstyles'

import type { CSSProperties } from 'react'

export default function MedicalClearancePage() {
  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Action Required</p>

        <h1 style={styles.heroTitleStyle}>
          Medical clearance is required before moving forward.
        </h1>

        <p style={styles.heroTextStyle}>
          Based on your responses, we need confirmation that it is safe for you to
          participate in a structured training program.
        </p>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>Why this step matters</h2>
          <p style={styles.bodyStyle}>
            This is not a limitation — it’s protection. Ensuring your body is cleared
            allows us to build your plan correctly and responsibly.
          </p>
        </section>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>What to do next</h2>
          <p style={styles.bodyStyle}>
            Please obtain written clearance from your healthcare provider and return
            to complete your application once you have it available.
          </p>
        </section>

        <div style={styles.buttonRowStyle}>
          <a href="/apply" style={styles.primaryButtonStyle}>
            Return to Application
          </a>
        </div>
      </div>
    </main>
  )
}

