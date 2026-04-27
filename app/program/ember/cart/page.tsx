'use client'

import * as styles from '../../../styles/globalstyles'

import type { CSSProperties } from 'react'

async function startCheckout(
  billing: 'subscription' | 'annual'
) {
  const response = await fetch('/api/checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      program: 'ember',
      billing,
      email: '',
    }),
  })

  const data = await response.json()

  if (data.url) {
    window.location.href = data.url
  } else {
    alert(data.error || JSON.stringify(data))
  }
}

export default function EmberCartPage() {
  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Checkout</p>

        <h1 style={styles.heroTitleStyle}>Choose how you want to enter Ember.</h1>

        <p style={styles.heroTextStyle}>
          Ember is your structured, self-led entry into the system. Choose the payment
          path that fits how you want to begin.
        </p>

        <section style={styles.cardGridStyle}>
          <div style={styles.cartBoxStyle}>
            <h2 style={styles.sectionTitleStyle}>Monthly Subscription</h2>
            <p style={styles.bodyStyle}>
              Ongoing access through a recurring monthly payment.
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
            <p style={bodyStyle}>
              One-time annual payment for the full year.
            </p>
            <button
              onClick={() => startCheckout('annual')}
              style={styles.primaryButtonStyle}
            >
              Choose Annual
            </button>
          </div>
        </section>
      </div>
    </main>
  )
}

