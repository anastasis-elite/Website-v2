import * as styles from '../../../styles/globalstyles'

export default function PhoenixWhyPage() {
  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Phoenix • Selection</p>

        <h1 style={styles.heroTitleStyle}>You were chosen for Phoenix.</h1>

        <p style={styles.heroTextStyle}>
          Not because you need to be pushed harder.
          <br />
          Because you deserve to be supported more deeply.
        </p>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>Why Phoenix fits you</h2>

          <p style={styles.bodyStyle}>
            Phoenix was built for the woman who knows she wants to change, but does
            not yet feel fully safe, clear, or supported enough to do it alone.
          </p>

          <p style={styles.bodyStyle}>
            You may know what you do not like about where you are right now. You may
            feel tired of being stuck. You may feel like you want more for yourself,
            but you are not fully sure where to begin, what to trust, or how to keep
            choosing yourself when life has taught you not to.
          </p>
        </section>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>What we saw in your application</h2>

          <div style={styles.bodyStyle}>
            <p>You need more than a plan.</p>
            <p>You need guidance that helps you feel safe enough to begin.</p>
            <p>You need structure that does not shame you for needing support.</p>
            <p>You need a system that helps you rebuild trust with yourself.</p>
          </div>
        </section>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>
            Phoenix is not about forcing yourself forward
          </h2>

          <p style={styles.bodyStyle}>
            This path is not built on punishment, pressure, or pretending you are fine.
          </p>

          <p style={styles.bodyStyle}>
            Phoenix is the most extensive path because it is the most supported one.
            It is designed for the woman who may have spent years surviving,
            shrinking, silencing herself, or trying to become smaller so life felt
            safer.
          </p>

          <p style={styles.bodyStyle}>
            Here, the goal is not just to change your body. The goal is to help you
            hear yourself again.
          </p>
        </section>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>What Phoenix helps you reclaim</h2>

          <div style={styles.bodyStyle}>
            <p>Your voice.</p>
            <p>Your confidence.</p>
            <p>Your structure.</p>
            <p>Your boundaries.</p>
            <p>Your sense of direction.</p>
            <p>Your ability to trust your own decisions again.</p>
          </div>
        </section>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>This is the gentlest path</h2>

          <p style={styles.bodyStyle}>
            Phoenix may look like the highest level of support, but at its core,
            it is the gentlest.
          </p>

          <p style={styles.bodyStyle}>
            Because some women do not need to be challenged first. They need to feel
            held first.
          </p>

          <p style={styles.bodyStyle}>
            They need someone to help them find the next right step without making
            them feel weak for not seeing it yet.
          </p>
        </section>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>You are not too far gone</h2>

          <p style={styles.bodyStyle}>
            You were not chosen for Phoenix because you are broken.
          </p>

          <p style={styles.bodyStyle}>
            You were chosen because this path was built for the woman who is ready
            to stop disappearing from her own life.
          </p>

          <p style={styles.bodyStyle}>
            This is where rebuilding becomes supported.
          </p>

          <div style={{ ...styles.bodyStyle, marginTop: '40px' }}>
            <p style={{ marginBottom: '12px' }}>I see you.</p>

            <p style={{ marginBottom: '12px' }}>I have been you.</p>

            <p>And you do not have to find your way out of this alone.</p>
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
            <p>If this feels out of reach financially…</p>
            <p>If you feel like you need to justify this decision…</p>
            <p>If something outside of you is making this harder to step into…</p>

            <a href="/program/phoenix/support" style={styles.quietLinkStyle}>
              There are other ways to enter this.
            </a>
          </div>
        </section>
      </div>
    </main>
  )
}
