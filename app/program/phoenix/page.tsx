'use client'

import * as styles from '../../styles/globalstyles'
import TrackEvent from '@/components/TrackEvent'

async function startCheckout(billing: 'subscription' | 'annual') {
  const referralCode = new URLSearchParams(window.location.search).get('ref') || ''
  const response = await fetch('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      program: 'phoenix',
      billing,
      email: '',
      referralCode,
    }),
  })

  const data = await response.json()

  if (data.url) {
    window.location.href = data.url
  } else {
    alert(data.error || 'Unable to start checkout.')
  }
}

export default function PhoenixPage() {
  return (
  <><TrackEvent event="program_viewed" properties={{ program: 'phoenix' }} />
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Phoenix</p>

        <h1 style={styles.heroTitleStyle}>Personalized. Precise. Built around you.</h1>

        <p style={styles.heroTextStyle}>
          Phoenix adds meal recommendations and directed next actions to the
          food logging, training, recovery, and progress tools available in
          Ignite. Review the context from your recorded inputs and decide what
          is manageable today.
        </p>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>Who Phoenix is for</h2>
          <p style={styles.bodyStyle}>
            Phoenix may fit if you would find a suggested meal or recovery action
            useful alongside your daily records. Your assessments, goals,
            equipment, and check-ins provide context; you remain able to review
            what the guidance is based on.
          </p>
        </section>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>What it offers</h2>

          <div style={styles.cardGridStyle}>
            <div style={styles.cardStyle}>
              <h3 style={styles.cardTitleStyle}>Personalized program direction</h3>
              <p style={styles.cardTextStyle}>
                Your member assessments, equipment, and goals provide inputs
                for your starting training plan, as they do across Anastasis paths.
              </p>
            </div>

            <div style={styles.cardStyle}>
              <h3 style={styles.cardTitleStyle}>Meal recommendations</h3>
              <p style={styles.cardTextStyle}>
                Review suggested meals alongside your remaining macro targets
                and food records, then choose what fits your day.
              </p>
            </div>

            <div style={styles.cardStyle}>
              <h3 style={styles.cardTitleStyle}>Directed next actions</h3>
              <p style={styles.cardTextStyle}>
                See a suggested nutrition or recovery action with the recorded
                context behind it. Progress photos and user-confirmed posture
                landmarks remain available alongside your history.
              </p>
            </div>
          </div>
        </section>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>If this is you…</h2>

          <div style={styles.bodyStyle}>
            <p>If a suggested next action would make your daily view more useful.</p>

            <p>
              If you want meal ideas alongside your food records and macro targets.
            </p>

            <p>If you want to review your training, nutrition, and recovery context together.</p>

            <p>
              <strong>Phoenix is a path to consider.</strong>
            </p>
          </div>
        </section>

        <section style={styles.cartBoxStyle}>
          <h2 style={styles.sectionTitleStyle}>Begin Phoenix</h2>
          <p style={styles.bodyStyle}>
            Choose how you want to enter Phoenix.
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
            <a href="/program/ignite" style={styles.secondaryButtonStyle}>
              Compare food logging in Ignite
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
