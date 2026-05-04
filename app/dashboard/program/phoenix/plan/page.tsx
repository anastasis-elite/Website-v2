'use client'

import { Suspense, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import * as styles from '../../../../styles/globalstyles'

function PlanProcessingContent() {
  const searchParams = useSearchParams()

  const program = searchParams.get('program') || ''
  const clientId = searchParams.get('client_id') || ''
  const fullName = searchParams.get('fullName') || ''
  const email = searchParams.get('email') || ''

  useEffect(() => {
    const timer = setTimeout(() => {
      window.location.href = `/dashboard/main?program=${encodeURIComponent(
        program
      )}&client_id=${encodeURIComponent(
        clientId
      )}&fullName=${encodeURIComponent(
        fullName
      )}&email=${encodeURIComponent(email)}`
    }, 35000)

    return () => clearTimeout(timer)
  }, [program, clientId, fullName, email])

  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Plan Processing</p>

        <h1 style={styles.heroTitleStyle}>
          {fullName
            ? `${fullName}, your plan is being prepared.`
            : 'Your plan is being prepared.'}
        </h1>

        <p style={styles.heroTextStyle}>
          Your assessment has been submitted. The system is organizing your training data
          and preparing your dashboard.
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
            Client: <strong>{email || fullName || clientId}</strong>
          </p>
        </section>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>What happens next</h2>

          <div style={styles.bodyStyle}>
            <p>You’ll be redirected to your dashboard in about 35 seconds.</p>
            <p>Your dashboard will become the place where your daily training, progress, and next steps live.</p>
          </div>
        </section>
      </div>
    </main>
  )
}

export default function PlanProcessingPage() {
  return (
    <Suspense fallback={null}>
      <PlanProcessingContent />
    </Suspense>
  )
}
