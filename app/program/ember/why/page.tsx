import * as styles from '../../../styles/globalstyles'
import TrackEvent from '@/components/TrackEvent'

export default function EmberWhyPage() {
  return (
    <><TrackEvent event="ember_why_page_viewed" properties={{ page: 'ember_why' }} />
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Ember • Your Options</p>

        <h1 style={styles.heroTitleStyle}>
          Consider Ember as your starting point.
        </h1>

        <p style={styles.heroTextStyle}>
          Ember brings your assessed training, macro targets, water tracking,
          and recorded progress together. It may fit if you want a self-led
          foundation with a clear place to return to.
        </p>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>Why Ember may fit</h2>

          <p style={styles.bodyStyle}>
            Your member assessments, equipment, goals, and training availability
            help establish a starting plan. Daily check-ins and the activities
            you record add context as you use it.
          </p>
        </section>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>What you can review</h2>

          <div style={styles.bodyStyle}>
            <p>Your assigned workout and prescribed sets, repetitions, and loads.</p>
            <p>Macro targets, entered macro totals, and water records.</p>
            <p>Basic recovery guidance alongside your daily check-in.</p>
            <p>Your saved workout, measurement, and photo history.</p>
          </div>
        </section>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>A manageable place to begin</h2>

          <div style={styles.bodyStyle}>
            <p>Enter the information available to you.</p>
            <p>Review your plan and record what you actually do.</p>
            <p>Return to your history when you have room to review it.</p>
          </div>
        </section>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>What Ember is meant to do for you</h2>

          <p style={styles.bodyStyle}>
            Ember keeps the foundational tools together so the next step is
            easier to find. It gives you a starting structure and a record of
            what happened, with room to account for the day you actually have.
          </p>
        </section>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>Important to understand</h2>

          <p style={styles.bodyStyle}>
            Ember includes macro targets and macro-total entry, rather than meal
            logging, micronutrient tracking, or micronutrient guidance. Compare the included tools and
            billing options before choosing; your starting path is a decision
            you can take time to consider.
          </p>
        </section>

        <div style={styles.buttonRowStyle}>
          <a href="/program/ember" style={styles.primaryButtonStyle}>
            Step into Ember
          </a>

          <a href="/program" style={styles.secondaryButtonStyle}>
            Return to Programs
          </a>
        </div>
      </div>
    </main>
    </>
  )
}
