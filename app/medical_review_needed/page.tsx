import * as styles from '../styles/globalstyles'
  
import type { CSSProperties } from 'react'

export default function MedicalReviewNeededPage() {
  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Manual Review Required</p>

        <h1 style={styles.heroTitleStyle}>Your application needs a quick safety review.</h1>

        <p style={styles.bodyStyle}>
          Because you shared an injury, medical condition, or restriction, your application
          will be reviewed before a program recommendation is finalized.
        </p>

        <p style={styles.bodyStyle}>
          If you uploaded medical clearance, it will be reviewed to confirm that it clearly
          supports participation in a structured fitness and nutrition program.
        </p>

        <p style={styles.bodyStyle}>
          This protects both your progress and your safety. Once reviewed, you’ll receive the
          next appropriate step.
        </p>

        <a href="/program" style={styles.primaryButtonStyle}>
          Review Programs
        </a>
      </div>
    </main>
  )
}

