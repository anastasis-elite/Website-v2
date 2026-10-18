import * as styles from '../../../styles/globalstyles'
import TrackEvent from '@/components/TrackEvent'

export default function IgniteRecommendPage() {
  return (
    <><TrackEvent event="ignite_recommend_page_viewed" properties={{ page: 'ignite_recommend' }} />
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Recommended Path</p>

        <h1 style={styles.heroTitleStyle}>
          More context.
          <br />
          A clearer next step.
        </h1>

        <p style={styles.heroTextStyle}>
          Ignite is a path to consider if you want food logging and more recovery
          detail alongside your assessed training. You can compare the tools
          before choosing what fits your life.
        </p>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>Why Ignite fits</h2>

          <p style={styles.bodyStyle}>
            Manual food entry and barcode tools let you record meals and review
            the nutrition detail available from those foods. Daily check-ins add
            context to your training and recovery guidance.
          </p>

          <p style={styles.bodyStyle}>
            Keep those records alongside workouts, measurements, and progress
            photos. Posture photos also allow you to review and confirm estimated
            landmarks; they do not provide a posture diagnosis.
          </p>
        </section>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>What Ignite gives you</h2>

          <p style={styles.bodyStyle}>
            Ignite adds recorded food detail and recovery recommendations to the
            shared training and progress tools. You can return to your history
            and review what is available without needing to complete every update at once.
          </p>
        </section>

        <div style={styles.buttonRowStyle}>
          <a href="/program/ignite/cart" style={styles.primaryButtonStyle}>
            Continue with Ignite
          </a>

          <a href="/program/ember" style={styles.secondaryButtonStyle}>
            Prefer macro-total entry? Explore Ember
          </a>

          <a href="/program/phoenix" style={styles.secondaryButtonStyle}>
            Want meal recommendations? Explore Phoenix
          </a>
          <a href="/program/ignite/why" style={styles.secondaryButtonStyle}>
  See how Ignite works
</a>
        </div>
      </div>
    </main>
    </>
  )
}
