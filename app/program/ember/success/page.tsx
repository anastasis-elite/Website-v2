'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import * as styles from '../../../styles/globalstyles'
import TrackEvent from '@/components/TrackEvent'

function EmberSuccessContent() {
  const searchParams = useSearchParams()

  const program = searchParams.get('program') || 'ember'
  const clientId = searchParams.get('client_id') || ''
  const fullName = searchParams.get('fullName') || ''
  const email = searchParams.get('email') || ''

  return (
    <><TrackEvent event="ember_success_page_viewed" properties={{ page: 'ember_success' }} />
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Ember</p>

        <h1 style={styles.heroTitleStyle}>Confirm your purchase to continue.</h1>

        <p style={styles.heroTextStyle}>
          This page cannot confirm payment or account access. Use the secure
          confirmation shown after Stripe Checkout, or sign in to your account.
        </p>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>What happens next</h2>

          <div style={styles.bodyStyle}>
            <p>After your payment is verified, create your private login and complete your member profile.</p>
            <p>The next step is completing your assessment so your plan can be built around your current capacity, schedule, recovery, and equipment access.</p>
            <p>Your member assessment supplies the information used to build your starting plan.</p>
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
          <h2 style={styles.sectionTitleStyle}>This is where Ember begins</h2>

          <div style={styles.bodyStyle}>
            <p>Simple does not mean small.</p>
            <p>Self-led does not mean unsupported.</p>
            <p>This is precision without the noise.</p>
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
    </>
  )
}

export default function EmberSuccessPage() {
  return (
    <Suspense fallback={null}>
      <EmberSuccessContent />
    </Suspense>
  )
}
