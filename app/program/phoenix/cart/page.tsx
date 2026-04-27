'use client'

import * as styles from '../../../styles/globalstyles'

async function startCheckout(billing: 'subscription' | 'annual') {
  const response = await fetch('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      program: 'phoenix',
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

export default function PhoenixCartPage() {
  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Phoenix Enrollment</p>

        <h1 style={styles.heroTitleStyle}>Choose how you want to begin.</h1>

        <p style={styles.heroTextStyle}>
          Phoenix is your recommended path. Select the payment option that fits best,
          then you’ll be taken to secure checkout.
        </p>

        <section style={styles.cardGridStyle}>
          <div style={styles.cartBoxStyle}>
            <h2 style={styles.sectionTitleStyle}>Monthly</h2>
            <p style={styles.bodyStyle}>
              Begin Phoenix with monthly access.
            </p>

            <button
              onClick={() => startCheckout('subscription')}
              style={styles.primaryButtonStyle}
            >
              Choose Monthly
            </button>
          </div>

          <div style={styles.cartBoxStyle}>
            <h2 style={styles.sectionTitleStyle}>Pay in Full</h2>
            <p style={styles.bodyStyle}>
              Secure the full Phoenix year upfront.
            </p>

            <button
              onClick={() => startCheckout('annual')}
              style={styles.primaryButtonStyle}
            >
              Pay in Full
            </button>
          </div>
        </section>

        <div style={styles.buttonRowStyle}>
          <a href="/program/phoenix/recommend" style={styles.secondaryButtonStyle}>
            Back to Recommendation
          </a>

          <a href="/program" style={styles.secondaryButtonStyle}>
            Review Programs
          </a>
        </div>
      </div>
    </main>
  )
}
