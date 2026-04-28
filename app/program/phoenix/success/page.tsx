import * as styles from '../../../styles/globalstyles'

export default function PhoenixSuccessPage() {
  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Phoenix • Confirmed</p>

        <h1 style={styles.heroTitleStyle}>
          You’re safe to begin.
        </h1>

        <p style={styles.heroTextStyle}>
          Your enrollment has been confirmed. You do not have to rebuild yourself
          alone anymore.
        </p>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>Take a breath first</h2>

          <div style={styles.bodyStyle}>
            <p>You made a decision for yourself.</p>
            <p>That matters.</p>
            <p>This is not where you have to become someone else overnight.</p>
            <p>This is where you begin coming back to yourself with support.</p>
          </div>
        </section>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>What happens next</h2>

          <div style={styles.bodyStyle}>
            <p>You’ll receive a confirmation email shortly.</p>
            <p>Your next steps will be delivered there with care and clarity.</p>
            <p>Check your inbox and spam folder just in case.</p>
          </div>
        </section>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>Before you begin</h2>

          <div style={styles.bodyStyle}>
            <p>You do not need to rush.</p>
            <p>You do not need to prove anything today.</p>
            <p>You do not need to know every step yet.</p>
            <p>The system will guide you one step at a time.</p>
          </div>
        </section>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>This is where Phoenix begins</h2>

          <div style={styles.bodyStyle}>
            <p>With safety.</p>
            <p>With structure.</p>
            <p>With your voice returning.</p>
            <p>With support that does not shame you for needing it.</p>
          </div>
        </section>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>And hear this clearly</h2>

          <div style={styles.bodyStyle}>
            <p>You are not too much.</p>
            <p>You are not too late.</p>
            <p>You are not too far gone.</p>
            <p>You are allowed to be held while you rebuild.</p>
          </div>
        </section>

        <div style={styles.buttonRowStyle}>
          <a href="/" style={styles.secondaryButtonStyle}>
            Return Home
          </a>

          <a href="/dashboard/signup?program=phoenix" style={styles.primaryButtonStyle}>
            Create Your Dashboard Login
          </a>
        </div>
      </div>
    </main>
  )
}
