'use client'

import * as styles from '../../styles/globalstyles'
import TrackEvent from '@/components/TrackEvent'
import type { CSSProperties } from 'react'

async function startCheckout(billing: 'subscription' | 'annual') {
  const response = await fetch('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      program: 'ignite',
      billing,
      email: '',
    }),
  })

  const data = await response.json()

  if (data.url) {
    window.location.href = data.url
  } else {
    alert(data.error || 'Unable to start checkout.')
  }
}

export default function IgnitePage() {
  return (
    <><TrackEvent event="program_viewed" properties={{ program: 'ignite' }} />
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Ignite</p>

        <h1 style={styles.heroTitleStyle}>Guided. Corrective. Aligned.</h1>

        <p style={styles.heroTextStyle}>
          Ignite brings food logging and recovery detail alongside your assessed
          training plan. See what you have recorded, review the guidance, and
          choose a manageable next step.
        </p>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>Who Ignite is for</h2>
          <p style={styles.bodyStyle}>
            Ignite may fit if you want more context around your daily decisions.
            Manual food entry, barcode tools, and recovery recommendations bring
            your recorded inputs together without requiring every day to look the same.
          </p>
        </section>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>What it offers</h2>

          <div style={styles.cardGridStyle}>
            <div style={styles.cardStyle}>
              <h3 style={styles.cardTitleStyle}>Structured guidance</h3>
              <p style={styles.cardTextStyle}>
                Review your assigned training, daily check-in, and recovery
                recommendations in one place.
              </p>
            </div>

            <div style={styles.cardStyle}>
              <h3 style={styles.cardTitleStyle}>Food logging and context</h3>
              <p style={styles.cardTextStyle}>
                Enter foods manually or use barcode tools, then review the
                nutrition detail available from those records.
              </p>
            </div>

            <div style={styles.cardStyle}>
              <h3 style={styles.cardTitleStyle}>Environmental alignment</h3>
              <p style={styles.cardTextStyle}>
                Keep your training, check-ins, and progress history together.
                Progress photos and user-confirmed posture landmarks add a visual record.
              </p>
            </div>
          </div>
        </section>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>If this is you…</h2>
          <div style={styles.bodyStyle}>
  <p>If you want to see your food records alongside your training…</p>

  <p>If recovery recommendations would help you plan your day…</p>

  <p>
    If you want to review more detail without turning every decision into
    another task…
  </p>

  <p><strong>Ignite is a path to consider.</strong></p>
</div>
        </section>
        
        <section style={styles.cartBoxStyle}>
          <h2 style={styles.sectionTitleStyle}>Begin Ignite</h2>
          <p style={styles.bodyStyle}>
            Choose how you want to enter Ignite.
          </p>

          <div style={styles.buttonRowStyle}>
            <button
              onClick={() => startCheckout('subscription')}
              style={styles.primaryButtonStyle}
            >
              Choose Monthly
            </button>

            <button
              onClick={() => startCheckout('annual')}
              style={styles.primaryButtonStyle}
            >
              Pay in Full
            </button>
          </div>
        </section>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>Want a different level of support?</h2>

          <div style={styles.buttonRowStyle}>
            <a href="/program/ember" style={styles.secondaryButtonStyle}>
              Prefer simplicity? Explore Ember
            </a>

            <a href="/program/phoenix" style={styles.secondaryButtonStyle}>
              Want meal recommendations? Explore Phoenix
            </a>

            <a href="/program" style={styles.secondaryButtonStyle}>
              Return to Program
            </a>
          </div>
        </section>
      </div>
    </main>
    </>
  )
}
