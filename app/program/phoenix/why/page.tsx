import * as styles from '../../../styles/globalstyles'
import TrackEvent from '@/components/TrackEvent'

export default function PhoenixWhyPage() {
  return (
    <><TrackEvent event="phoenix_why_page_viewed" properties={{ page: 'phoenix_why' }} />
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Phoenix • Your Options</p>

        <h1 style={styles.heroTitleStyle}>Consider Phoenix as your starting point.</h1>

        <p style={styles.heroTextStyle}>
          More daily direction when it is useful.
          <br />
          Room to choose what fits your capacity.
        </p>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>Why Phoenix may fit</h2>

          <p style={styles.bodyStyle}>
            Phoenix may fit if suggested meals and directed next actions would
            make your daily view more useful. It brings those options alongside
            your training, food records, and recovery context.
          </p>

          <p style={styles.bodyStyle}>
            Your member assessments, equipment, goals, and daily check-ins provide
            inputs for the guidance. You can review your recorded history and
            choose what is manageable today.
          </p>
        </section>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>What you can review</h2>

          <div style={styles.bodyStyle}>
            <p>Your assigned training and saved workout history.</p>
            <p>Meal recommendations alongside your remaining macro targets.</p>
            <p>Directed nutrition and recovery next actions.</p>
            <p>Your recorded food, check-ins, measurements, and photos.</p>
          </div>
        </section>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>
            A clear next step, with room to choose
          </h2>

          <p style={styles.bodyStyle}>
            A recommendation is a starting point to review. Your current time,
            resources, and capacity still matter.
          </p>

          <p style={styles.bodyStyle}>
            Phoenix includes the food logging, recovery detail, and photo tools
            available in Ignite. Its additional meal recommendations and directed
            next actions offer another way to navigate that information.
          </p>

          <p style={styles.bodyStyle}>
            Posture photos let you review and confirm estimated landmarks. They
            do not provide a diagnosis or a corrective training prescription.
          </p>
        </section>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>Keep the context together</h2>

          <div style={styles.bodyStyle}>
            <p>Member assessment inputs.</p>
            <p>Your assigned workout.</p>
            <p>Food and water records.</p>
            <p>Daily check-ins.</p>
            <p>Recovery guidance.</p>
            <p>Your saved progress history.</p>
          </div>
        </section>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>A pace that fits your capacity</h2>

          <p style={styles.bodyStyle}>
            You can use a suggested action when it helps and return to the wider
            view when you want more context.
          </p>

          <p style={styles.bodyStyle}>
            Optional updates can wait until you have room. Your recorded history
            gives you a place to return to.
          </p>

          <p style={styles.bodyStyle}>
            Choose this path for the tools you would use, at a cost and level of
            tracking that fit your circumstances.
          </p>
        </section>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>You can take time to decide</h2>

          <p style={styles.bodyStyle}>
            This page describes the path; it is not a personal evaluation of you.
          </p>

          <p style={styles.bodyStyle}>
            Compare what is included and choose the starting point that feels
            useful and manageable now.
          </p>

          <p style={styles.bodyStyle}>
            There is room to review the options before making a decision.
          </p>

          <div style={{ ...styles.bodyStyle, marginTop: '40px' }}>
            <p style={{ marginBottom: '12px' }}>Your time matters.</p>

            <p style={{ marginBottom: '12px' }}>Your resources matter.</p>

            <p>Your next step can reflect both.</p>
          </div>
        </section>

        <div style={styles.buttonRowStyle}>
          <a href="/program/phoenix" style={styles.primaryButtonStyle}>
            Step into Phoenix
          </a>

          <a href="/program" style={styles.secondaryButtonStyle}>
            Return to Programs
          </a>
        </div>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>If moving forward feels complicated</h2>

          <div style={styles.bodyStyle}>
            <p>Consider the cost alongside the features you would use.</p>
            <p>Take the time you need to review the options.</p>
            <p>Beginning later is also a choice.</p>

            <a href="/program/phoenix/support" style={styles.quietLinkStyle}>
              Review starting-point considerations
            </a>
          </div>
        </section>
      </div>
    </main>
    </>
  )
}
