'use client'

import * as styles from '../../styles/globalstyles'

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

export default function PhoenixPage() {
  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Phoenix</p>

        <h1 style={styles.heroTitleStyle}>Personalized. Precise. Built around you.</h1>

        <p style={styles.heroTextStyle}>
          Phoenix is for the woman who is no longer here to guess. This is the
          deepest level of the system — personalized structure, deeper strategy,
          and quarterly 1:1 support built around your body, your goals, and your
          progression.
        </p>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>Who Phoenix is for</h2>
          <p style={styles.bodyStyle}>
            Phoenix is for the woman who wants a more personalized experience,
            deeper calibration, and more direct strategic support. She is not
            looking for another generic plan. She wants the system shaped around
            where she is going.
          </p>
        </section>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>What it offers</h2>

          <div style={styles.cardGridStyle}>
            <div style={styles.cardStyle}>
              <h3 style={styles.cardTitleStyle}>Personalized program direction</h3>
              <p style={styles.cardTextStyle}>
                Customized program options based on the transformation you are building.
              </p>
            </div>

            <div style={styles.cardStyle}>
              <h3 style={styles.cardTitleStyle}>The science behind the structure</h3>
              <p style={styles.cardTextStyle}>
                Deeper education around the system, your physiology, and the reason
                behind the progression.
              </p>
            </div>

            <div style={styles.cardStyle}>
              <h3 style={styles.cardTitleStyle}>Quarterly 1:1 support</h3>
              <p style={styles.cardTextStyle}>
                One private session per quarter to refine the direction and keep the
                system aligned with your evolution.
              </p>
            </div>
          </div>
        </section>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>If this is you…</h2>

          <div style={styles.bodyStyle}>
            <p>If you’re done guessing completely.</p>

            <p>
              If you want your system to be built around you, not adjusted from
              something generic.
            </p>

            <p>If you’re ready for precision, not approximation.</p>

            <p>
              <strong>This is exactly where Phoenix fits.</strong>
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
              Need a lighter level? Explore Ignite
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
