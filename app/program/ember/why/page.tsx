import * as styles from '../../../styles/globalstyles'

export default function EmberWhyPage() {
  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Ember • Selection</p>

        <h1 style={styles.heroTitleStyle}>
          You were chosen for Ember.
        </h1>

        <p style={styles.heroTextStyle}>
          Based on what you shared, you are not lacking discipline.
          You are not lacking effort.
          You are not lacking awareness.

          You are operating at a level where the issue is no longer
          whether you show up.

          It’s whether the structure you’re following is actually
          built for you.
        </p>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>Why Ember fits you</h2>

          <p style={styles.bodyStyle}>
            You were placed into Ember because you demonstrated the ability
            to self-regulate, self-direct, and execute without needing
            constant intervention.

            You already carry structure in your life.

            What you’ve been missing is not discipline.
            It’s alignment.
          </p>
        </section>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>What we saw in your application</h2>

          <div style={styles.bodyStyle}>
            <p>You know how to follow through.</p>
            <p>You are capable of consistency.</p>
            <p>You have direction, even if it feels unclear at times.</p>
            <p>You do not need to be managed.</p>
          </div>
        </section>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>Where things have been breaking down</h2>

          <div style={styles.bodyStyle}>
            <p>The systems you’ve followed were not built for your physiology.</p>
            <p>You’ve had to think through too many decisions on your own.</p>
            <p>Your structure hasn’t matched how your body actually responds.</p>
          </div>
        </section>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>What Ember is meant to do for you</h2>

          <p style={styles.bodyStyle}>
            Ember removes the need to constantly analyze and adjust everything
            yourself.

            It gives you calculated structure so your effort finally translates
            into results.

            Not by doing more.

            But by doing what actually fits.
          </p>
        </section>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>Important to understand</h2>

          <p style={styles.bodyStyle}>
            Ember is not designed to keep you dependent.

            It is designed to refine your process to the point where you no longer
            need external guidance.

            This is not a long-term hold.

            It is a precision phase.

            A year of alignment that allows you to move forward with clarity,
            confidence, and a system that finally works.
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
  )
}
