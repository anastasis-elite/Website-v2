import * as styles from '../styles/globalstyles'
  
import type { CSSProperties } from 'react'

export default function MedicalReviewNeededPage() {
  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Before you choose a program</p>

        <h1 style={styles.heroTitleStyle}>Consider your health needs before choosing a program.</h1>

        <p style={styles.bodyStyle}>
          If you have an injury, medical condition, or restriction, ask your healthcare
          provider whether a structured training and nutrition program is appropriate for you.
        </p>

        <p style={styles.bodyStyle}>
          This page does not confirm medical clearance or approval to participate.
        </p>

        <p style={styles.bodyStyle}>
          You can review program information while considering the guidance from your
          healthcare provider.
        </p>

        <a href="/program" style={styles.primaryButtonStyle}>
          Review Programs
        </a>
      </div>
    </main>
  )
}

