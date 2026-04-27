'use client'

import * as styles from '../../styles/globalstyles'

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
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Ignite</p>

        <h1 style={styles.heroTitleStyle}>Guided. Corrective. Aligned.</h1>

        <p style={styles.heroTextStyle}>
          Ignite is for the woman who has been trying, showing up, and doing the
          work — but needs the system corrected, explained, and structured around
          what actually creates progress.
        </p>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>Who Ignite is for</h2>
          <p style={styles.bodyStyle}>
            Ignite is for the woman who does not need more pressure. She needs
            more clarity. She needs the why behind the structure, the environment
            aligned around the goal, and a system that helps her stop guessing.
          </p>
        </section>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>What it offers</h2>

          <div style={styles.cardGridStyle}>
            <div style={styles.cardStyle}>
              <h3 style={styles.cardTitleStyle}>Structured guidance</h3>
              <p style={styles.cardTextStyle}>
                The plan, plus the reasoning behind the plan in digestible pieces.
              </p>
            </div>

            <div style={styles.cardStyle}>
              <h3 style={styles.cardTitleStyle}>System correction</h3>
              <p style={styles.cardTextStyle}>
                Designed for women who are consistent but not getting the response
                they should be getting.
              </p>
            </div>

            <div style={styles.cardStyle}>
              <h3 style={styles.cardTitleStyle}>Environmental alignment</h3>
              <p style={styles.cardTextStyle}>
                Guidance that helps your daily life start supporting where your body
                and mind are going.
              </p>
            </div>
          </div>
        </section>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>If this is you…</h2>
          <div style={styles.bodyStyle}>
  <p>If you’ve been consistent… but your body stopped responding…</p>

  <p>If you’ve been doing the work… but still feel like you’re guessing…</p>

  <p>
    If you’re tired of wondering if you’re doing too much, too little,
    or the wrong things entirely…
  </p>

  <p><strong>This is exactly where Ignite fits.</strong></p>
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
