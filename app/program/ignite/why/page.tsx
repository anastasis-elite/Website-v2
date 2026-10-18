import * as styles from '../../../styles/globalstyles'
import TrackEvent from '@/components/TrackEvent'

export default function IgniteWhyPage() {
  return (
    <><TrackEvent event="ignite_why_page_viewed" properties={{ page: 'ignite_why' }} />
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Ignite • Your Options</p>

        <h1 style={styles.heroTitleStyle}>Consider Ignite as your starting point.</h1>

        <p style={styles.heroTextStyle}>
          Ignite may fit if you want food logging and more recovery detail
          alongside your assessed training. This page explains the tools so you
          can decide whether they would be useful to you.
        </p>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>Why Ignite may fit</h2>

          <p style={styles.bodyStyle}>
            Manual food entry and barcode tools provide a record of meals and
            the nutrition detail available from those foods.
          </p>

          <p style={styles.bodyStyle}>
            Daily check-ins, recovery recommendations, and saved progress give
            you context to review alongside your assigned training.
          </p>
        </section>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>What you can review</h2>

          <div style={styles.bodyStyle}>
            <p>Your assessed training and saved workout history.</p>
            <p>Your recorded meals and available nutrition detail.</p>
            <p>Recovery recommendations informed by your recorded inputs.</p>
            <p>Progress photos and user-confirmed posture landmarks.</p>
          </div>
        </section>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>What Ignite helps clarify</h2>

          <div style={styles.bodyStyle}>
            <p>Which workout is assigned.</p>
            <p>What you have recorded.</p>
            <p>Which inputs support the guidance.</p>
            <p>What history is available to review.</p>
            <p>Which next step is manageable today.</p>
          </div>
        </section>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>Why this level matters</h2>

          <p style={styles.bodyStyle}>
            Ember provides the foundation with macro-total entry. Ignite adds
            meal logging and recovery detail. Phoenix adds meal recommendations
            and a more directed presentation of next actions.
          </p>

          <p style={styles.bodyStyle}>
            Choose the tools that would help you now. Posture tools let you
            confirm estimated landmarks in photos; they do not diagnose posture
            or prescribe corrective training.
          </p>
        </section>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>You are not behind</h2>

          <p style={styles.bodyStyle}>
            A starting path is a choice about useful tools, not a judgment about
            your effort or where you should be.
          </p>

          <p style={styles.bodyStyle}>
            Take time to compare the included features, cost, and amount of
            tracking that fits your capacity. You do not need to make every
            change at once.
          </p>
        </section>

        <div style={styles.buttonRowStyle}>
          <a href="/program/ignite" style={styles.primaryButtonStyle}>
            Step into Ignite
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
