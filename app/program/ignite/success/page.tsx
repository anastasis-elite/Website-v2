'use client'

import * as styles from '../../../../styles/globalstyles'

export default function IgniteSuccessPage() {
  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        
        <p style={styles.eyebrowStyle}>Ignite • Confirmed</p>

        <h1 style={styles.heroTitleStyle}>
          You’re in.
        </h1>

        <p style={styles.heroTextStyle}>
          Your decision has been confirmed. Everything from here moves with intention.
        </p>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>What happens next</h2>

          <div style={styles.bodyStyle}>
            <p>You’ll receive a confirmation email shortly.</p>
            <p>Your program access and next steps will be delivered there.</p>
            <p>Make sure to check your inbox (and spam folder, just in case).</p>
          </div>
        </section>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>What to expect</h2>

          <div style={styles.bodyStyle}>
            <p>You are not starting over.</p>
            <p>You are stepping into a structure that holds.</p>
            <p>This is where your effort begins to translate differently.</p>
          </div>
        </section>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>Before you begin</h2>

          <div style={styles.bodyStyle}>
            <p>Do not try to change everything at once.</p>
            <p>Follow the structure as it’s given.</p>
            <p>Let the system do what it was designed to do.</p>
          </div>
        </section>

        <div style={styles.buttonRowStyle}>
          <a href="/" style={styles.secondaryButtonStyle}>
            Return Home
          </a>
        </div>

      </div>
    </main>
  )
}
