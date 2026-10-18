import * as styles from '../../../styles/globalstyles'
import TrackEvent from '@/components/TrackEvent'
import type { CSSProperties } from 'react'

export default function EmberRecommendPage() {
  return (
    <><TrackEvent event="ember_recommend_page_viewed" properties={{ page: 'ember_recommend' }} />
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Recommended Path</p>

        <h1 style={styles.heroTitleStyle}>
          A clear starting point.
          <br />
          Less to keep in your head.
        </h1>

        <p style={styles.heroTextStyle}>
          Ember offers a self-led foundation: assessed training, macro targets,
          water tracking, and a record of your progress. Review what it includes
          and decide whether it fits your current capacity.
        </p>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>Why Ember fits</h2>
          <p style={styles.bodyStyle}>
            If you want your assigned workout and daily guidance in one place,
            Ember may be a useful starting point. Your member assessments,
            equipment, goals, and training availability provide the plan inputs.
          </p>

          <p style={styles.bodyStyle}>
            Review prescribed sets, repetitions, and loads, then record what you
            actually complete. Your check-in adds context for normal training,
            reduced-capacity training, or a recovery-only day.
          </p>
        </section>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>What Ember gives you</h2>
          <p style={styles.bodyStyle}>
            Keep macro totals, water, workouts, and progress history together.
            Ember does not include meal logging;
            compare the other paths if food logging would be useful to you.
          </p>
        </section>

        <div style={styles.buttonRowStyle}>
          <a href="/program/ember/cart" style={styles.primaryButtonStyle}>
            Continue with Ember
          </a>

          <a href="/program/ignite" style={styles.secondaryButtonStyle}>

    Want food logging? Explore Ignite

  </a>
<a href="/program/ember/why" style={styles.secondaryButtonStyle}>
  See how Ember works
</a>
</div>
      </div>
    </main>
    </>
  )
}

