'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import * as styles from '../../../../styles/globalstyles'

function PlanContent() {
  const searchParams = useSearchParams()

  const program = searchParams.get('program') || 'unknown'
  const email = searchParams.get('email') || ''

  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Your Plan</p>

        <h1 style={styles.heroTitleStyle}>
          Your {program.charAt(0).toUpperCase() + program.slice(1)} plan is ready.
        </h1>

        <p style={styles.heroTextStyle}>
          This is your personalized execution plan based on your assessment inputs.
        </p>

        <section style={styles.cartBoxStyle}>
          <p style={styles.bodyStyle}>
            We’re finalizing your structured plan now.
          </p>

          <p style={styles.bodyStyle}>
            This page will soon display:
          </p>

          <ul style={{ ...styles.bodyStyle, paddingLeft: '20px' }}>
            <li>Training split</li>
            <li>Exercise selection</li>
            <li>Progression structure</li>
            <li>Recovery guidance</li>
            <li>Execution details</li>
          </ul>

          <p style={{ ...styles.bodyStyle, marginTop: '20px' }}>
            Program: <strong>{program}</strong>
          </p>

          <p style={styles.bodyStyle}>
            Client: <strong>{email}</strong>
          </p>
        </section>
      </div>
    </main>
  )
}

export default function PlanPage() {
  return (
    <Suspense fallback={null}>
      <PlanContent />
    </Suspense>
  )
}
