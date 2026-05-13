import Link from 'next/link'
import * as styles from '../styles/globalstyles'

export default function VerifiedPage() {
  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Payment Verified</p>

        <h1 style={styles.heroTitleStyle}>You’re in.</h1>

        <p style={styles.heroTextStyle}>
          Your payment has been processed. The next step is creating your private
          login so your assessment, program, and progress stay securely connected
          to your account.
        </p>

        <section style={styles.cartBoxStyle}>
          <h2 style={styles.sectionTitleStyle}>Your next step</h2>

          <p style={styles.bodyStyle}>
            Create your private login first. Once your account is connected,
            your dashboard, assessments, and program data will automatically stay
            linked to your client profile.
          </p>

          <div style={styles.buttonRowStyle}>
            <Link
              href="/create-login"
              style={styles.primaryButtonStyle}
            >
              Create Your Login
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
