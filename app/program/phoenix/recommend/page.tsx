import * as styles from '../../../styles/globalstyles'

export default function PhoenixRecommendPage() {
  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Recommended Path</p>

        <h1 style={styles.heroTitleStyle}>
          You’re not here to guess anymore.
          <br />
          You’re here to get it right.
        </h1>

        <p style={styles.heroTextStyle}>
          Phoenix was recommended because your answers suggest you are ready for a
          deeper, more personalized transformation system — not another generic plan.
        </p>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>Why Phoenix fits</h2>

          <p style={styles.bodyStyle}>
            At this level, doing more is not the answer. The margin for error gets
            smaller, and the cost of guessing gets higher. You need precision,
            personalization, and strategic oversight.
          </p>

          <p style={styles.bodyStyle}>
            Phoenix is designed around your goals, physiology, progression, and
            timeline. This is where decisions become deliberate and your system adapts
            with you.
          </p>
        </section>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>What Phoenix gives you</h2>

          <p style={styles.bodyStyle}>
            Phoenix includes a more personalized program path, deeper structure,
            the science behind the system, and one 1:1 session per quarter throughout
            the year.
          </p>
        </section>

        <div style={styles.buttonRowStyle}>
          <a href="/program/phoenix/cart" style={styles.primaryButtonStyle}>
            Apply for Phoenix
          </a>

          <a href="/program/ignite" style={styles.secondaryButtonStyle}>
            Prefer less structure? Explore Ignite
          </a>
        </div>
      </div>
    </main>
  )
}
