import * as styles from '../../../styles/globalstyles'

export default function IgniteWhyPage() {
  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Ignite • Selection</p>

        <h1 style={styles.heroTitleStyle}>You were chosen for Ignite.</h1>

        <p style={styles.heroTextStyle}>
          You were chosen for Ignite because you already know structure matters.
          You have started building systems around your life, your body, your goals,
          and your future — but your current structure still has gaps.
        </p>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>Why Ignite fits you</h2>

          <p style={styles.bodyStyle}>
            Ignite was built for the woman who is motivated, aware, and ready —
            but not fully focused yet because too many pieces are still floating.
          </p>

          <p style={styles.bodyStyle}>
            You know where you want to end up. You know something needs to change.
            You have started curating the structure. But knowing you need systems
            and knowing exactly how to build them are two different things.
          </p>
        </section>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>What we saw in your application</h2>

          <div style={styles.bodyStyle}>
            <p>You have direction, but need clearer execution.</p>
            <p>You are motivated, but not fully locked into the system yet.</p>
            <p>You know the end goal, but need more support with the path.</p>
            <p>You need more guidance than Ember, without needing the full depth of Phoenix.</p>
          </div>
        </section>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>What Ignite helps clarify</h2>

          <div style={styles.bodyStyle}>
            <p>What to do.</p>
            <p>Why it matters.</p>
            <p>How to execute it.</p>
            <p>When to adjust.</p>
            <p>What to stop overthinking.</p>
          </div>
        </section>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>Why this level matters</h2>

          <p style={styles.bodyStyle}>
            Ember gives structure to women who already know how to self-direct.
            Phoenix builds a highly personalized system around women who need
            deeper precision.
          </p>

          <p style={styles.bodyStyle}>
            Ignite sits between them. It gives you the structure, explanation,
            and guided alignment to help you stop half-building systems and start
            executing one that actually holds.
          </p>
        </section>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>You are not behind</h2>

          <p style={styles.bodyStyle}>
            You were not chosen for Ignite because you are behind. You were chosen
            because you are close.
          </p>

          <p style={styles.bodyStyle}>
            Close enough to know what you want. Close enough to feel what is missing.
            Close enough to stop guessing and finally build the system that gets you there.
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
  )
}
