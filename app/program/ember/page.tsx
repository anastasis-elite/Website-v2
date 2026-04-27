'use client'

import * as styles from '../../styles/globalstyles'

import type { CSSProperties } from 'react'

async function startCheckout(billing: 'subscription' | 'annual') {
  const response = await fetch('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
    alert(data.error || 'Unable to start checkout.')
  }
}

export default function EmberPage() {
  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Ember</p>

        <h1 style={styles.heroTitleStyle}>Structured. Precise. Self-led.</h1>

        <p style={styles.heroTextStyle}>
          Ember is designed for the woman who already knows how to support herself,
          recover, regulate, and execute — but wants the numbers, structure, and
          progression calculated so she does not have to carry every decision alone.
        </p>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>Who Ember is for</h2>
          <p style={styles.bodyStyle}>
            Ember is for the woman who is capable of moving independently. She does
            not need more noise, more chaos, or more hand-holding. She needs a clean
            structure that removes friction and lets her execute.
          </p>
        </section>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>What it offers</h2>
          <div style={styles.cardGridStyle}>
            <div style={styles.cardStyle}>
              <h3 style={styles.cardTitleStyle}>Calculated structure</h3>
              <p style={styles.cardTextStyle}>
                Training, progression, and foundational targets handled for you.
              </p>
            </div>

            <div style={styles.cardStyle}>
              <h3 style={styles.cardTitleStyle}>Self-led execution</h3>
              <p style={styles.cardTextStyle}>
                Ideal for women who want precision without high-touch oversight.
              </p>
            </div>

            <div style={styles.cardStyle}>
              <h3 style={styles.cardTitleStyle}>Less decision fatigue</h3>
              <p style={styles.cardTextStyle}>
                The system gives you the structure so you can stop overthinking the process.
              </p>
            </div>
          </div>
        </section>
        
       <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>If this is you…</h2>
          <p style={styles.bodyStyle}>
            If you already know how to take care of yourself…

If you don’t need more information,
but you’re tired of making every decision alone…

If you want structure without losing autonomy…

This is exactly where Ember fits.
          </p>
        </section>
        
        <section style={styles.cartBoxStyle}>
          <h2 style={styles.sectionTitleStyle}>Begin Ember</h2>
          <p style={styles.bodyStyle}>
            Choose how you want to enter Ember.
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
              Need more structure? Explore Ignite
            </a>

            <a href="/program/phoenix" style={styles.secondaryButtonStyle}>
              Want full personalization? Explore Phoenix
            </a>

            <a href="/program" style={styles.secondaryButtonStyle}>
              Return to Program
            </a>
          </div>
        </section>
      </div>
    </main>
  )
}
