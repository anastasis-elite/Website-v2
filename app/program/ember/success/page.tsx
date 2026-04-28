import * as styles from '../../../styles/globalstyles'

export default function EmberSuccessPage() {
  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Ember • Confirmed</p>

        <h1 style={styles.heroTitleStyle}>You’re set.</h1>

        <p style={styles.heroTextStyle}>
          Your enrollment has been confirmed. Ember is your structure — clear,
          precise, and ready for you to execute.
        </p>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>What happens next</h2>

          <div style={styles.bodyStyle}>
            <p>You’ll receive a confirmation email shortly.</p>
            <p>Your program access and next steps will be delivered there.</p>
            <p>Check your inbox and spam folder just in case.</p>
          </div>
        </section>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>Before you begin</h2>

          <div style={styles.bodyStyle}>
            <p>You do not need to overthink this.</p>
            <p>Follow the structure.</p>
            <p>Let the system remove the extra decisions.</p>
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
          <a href="/" style={styles.secondaryButtonStyle}>
            Return Home
          </a>

          <a href="/dashboard/signup?program=ember" style={styles.primaryButtonStyle}>
            Create Your Dashboard Login
          </a>
        </div>
      </div>
    </main>
  )
}
