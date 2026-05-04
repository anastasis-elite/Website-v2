'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import * as styles from '../../../styles/globalstyles'

function PhoenixSuccessContent() {
  const searchParams = useSearchParams()

  const program = searchParams.get('program') || 'phoenix'
  const clientId = searchParams.get('client_id') || ''
  const fullName = searchParams.get('fullName') || ''
  const email = searchParams.get('email') || ''

  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Phoenix • Confirmed</p>

        <h1 style={styles.heroTitleStyle}>You’re in.</h1>

        <p style={styles.heroTextStyle}>
          Your enrollment has been confirmed. Phoenix is your highest level of support,
          precision, and adaptation — built for transformation that cannot be ignored.
        </p>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>What happens next</h2>

          <div style={styles.bodyStyle}>
            <p>Your payment has been processed and your dashboard access is being prepared.</p>
            <p>The next step is completing your assessment so your plan can be built around your current capacity, schedule, recovery, and equipment access.</p>
            <p>You can complete it now, or explore your dashboard first and come back when you’re ready.</p>
          </div>
        </section>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>Before the assessment</h2>

          <div style={styles.bodyStyle}>
            <p>If you want to complete the strength portion now, be near your weights, gym equipment, or cable machine.</p>
            <p>You do not need to max out. Use controlled reps, proper form, and steady breathing.</p>
            <p>The goal is not to prove anything — it is to give the system accurate starting data.</p>
          </div>
        </section>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>This is where Phoenix begins</h2>

          <div style={styles.bodyStyle}>
            <p>You are not here for random effort.</p>
            <p>You are here to build a body and system that can sustain expansion.</p>
            <p>This is precision, adaptation, and execution at the highest level.</p>
          </div>
        </section>

        <div style={styles.buttonRowStyle}>
          <a
            href={`/dashboard/main?program=${encodeURIComponent(
              program
            )}&client_id=${encodeURIComponent(
              clientId
            )}&fullName=${encodeURIComponent(
              fullName
            )}&email=${encodeURIComponent(email)}`}
            style={styles.secondaryButtonStyle}
          >
            Explore Dashboard
          </a>

          <a
            href={`/dashboard/assessment/start?program=${encodeURIComponent(
              program
            )}&client_id=${encodeURIComponent(
              clientId
            )}&fullName=${encodeURIComponent(
              fullName
            )}&email=${encodeURIComponent(email)}`}
            style={styles.primaryButtonStyle}
          >
            Continue to Assessment
          </a>
        </div>
      </div>
    </main>
  )
}

export default function PhoenixSuccessPage() {
  return (
    <Suspense fallback={null}>
      <PhoenixSuccessContent />
    </Suspense>
  )
}
