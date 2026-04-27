import * as styles from '../../styles/globalstyles'

export default function SupportFirstPage() {
  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Next Step</p>

        <h1 style={styles.heroTitleStyle}>
          Let’s build your foundation first.
        </h1>

        <p style={styles.heroTextStyle}>
          Based on your responses, the most aligned next step is to prioritize
          stability, support, and safety before moving into a structured program.
        </p>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>Why this matters</h2>
          <p style={styles.bodyStyle}>
            Your body is not something to push through — it’s something to work
            with. Creating the right environment now allows you to progress faster,
            safer, and more sustainably long-term.
          </p>
        </section>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>What happens next</h2>
          <p style={styles.bodyStyle}>
            We’ll take a more supportive approach first, ensuring that your body is
            ready for higher demand training and structured progression.
          </p>
        </section>

        <div style={styles.buttonRowStyle}>
          <a href="/apply" style={styles.secondaryButtonStyle}>
            Revisit Application
          </a>

          <a href="/program" style={styles.primaryButtonStyle}>
            Explore Programs
          </a>
        </div>
      </div>
    </main>
  )
}
