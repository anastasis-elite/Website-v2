import * as styles from '../../../styles/globalstyles'

export default function PhoenixSupportPage() {
  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <h1 style={styles.heroTitleStyle}>
          There are other ways to step into this.
        </h1>

        <p style={styles.heroTextStyle}>
          You don’t have to explain everything to move forward.
        </p>

        <section style={styles.sectionStyle}>
          <p style={styles.bodyStyle}>
            If cost, timing, or external factors are making this feel out of reach,
            there are alternative entry paths available.
          </p>

          <p style={styles.bodyStyle}>
            This is not a barrier. It’s just a different starting point.
          </p>
        </section>

        <div style={styles.buttonRowStyle}>
          <a href="/program/phoenix/support/apply" style={styles.primaryButtonStyle}>
            Continue
          </a>
        </div>
      </div>
    </main>
  )
}
