import * as styles from '../../../styles/globalstyles'
import TrackEvent from '@/components/TrackEvent'

export default function PhoenixRecommendPage() {
  return (
    <><TrackEvent event="phoenix_recommend_page_viewed" properties={{ page: 'phoenix_recommend' }} />
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Recommended Path</p>

        <h1 style={styles.heroTitleStyle}>
          More direction for your day.
          <br />
          Room to choose what fits.
        </h1>

        <p style={styles.heroTextStyle}>
          Phoenix is a path to consider if meal recommendations and directed next
          actions would be useful to you. Review the current tools and choose
          the level of daily direction that fits your needs.
        </p>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>Why Phoenix fits</h2>

          <p style={styles.bodyStyle}>
            Your daily view brings assigned training, recorded food, and recovery
            context together. Suggested meals and next actions give you something
            concrete to review when you are deciding what to do next.
          </p>

          <p style={styles.bodyStyle}>
            Member assessments, equipment, goals, and check-ins provide inputs for
            the guidance you see. Your history remains available as you update
            those inputs and review your progress.
          </p>
        </section>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>What Phoenix gives you</h2>

          <p style={styles.bodyStyle}>
            Phoenix includes the food logging, recovery detail, and photo tools
            available in Ignite, plus meal recommendations and directed nutrition
            and recovery next actions. Posture tools capture user-confirmed
            landmarks; they do not diagnose movement or prescribe corrective training.
          </p>
        </section>

        <div style={styles.buttonRowStyle}>
          <a href="/program/phoenix/cart" style={styles.primaryButtonStyle}>
            Continue with Phoenix
          </a>

          <a href="/program/ignite" style={styles.secondaryButtonStyle}>
            Compare food logging in Ignite
          </a>
          <a href="/program/phoenix/why" style={styles.secondaryButtonStyle}>
  See how Phoenix works
</a>
        </div>
      </div>
    </main>
    </>
  )
}
