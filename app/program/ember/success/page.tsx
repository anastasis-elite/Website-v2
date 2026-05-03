import * as styles from '../../../styles/globalstyles'

export default function EmberSuccessPage() {
  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Ember • Confirmed</p>

        <h1 style={styles.heroTitleStyle}>You’re in.</h1>

        <p style={styles.heroTextStyle}>
          Your enrollment has been confirmed. Ember is your structure — clear,
          precise, and ready for you to execute.
        </p>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>What happens next</h2>

          <div style={styles.bodyStyle}>
            <p>Your payment has been processed and your dashboard access is being prepared.</p>
            <p>The next step is completing your assessment so your plan can be built around your current capacity, schedule, recovery, and equipment access.</p>
            <p>You can complete it now, or explore your dashboard first and come back when you’re ready.</p>
          </div>
        </section>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>Before the assessment</h2>

          <div style={styles.bodyStyle}>
            <p>If you want to complete the strength portion now, be near your weights, gym equipment, or cable machine.</p>
            <p>You do not need to max out. Use controlled reps, proper form, and steady breathing.</p>
            <p>The goal is not to prove anything — it is to give the system accurate starting data.</p>
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
          <a href="/dashboard" style={styles.secondaryButtonStyle}>
            Explore Dashboard
          </a>

          <a href="/dashboard/assessment/start?program=ember" style={styles.primaryButtonStyle}>
            Continue to Assessment
          </a>
        </div>
      </div>
    </main>
  )
}
