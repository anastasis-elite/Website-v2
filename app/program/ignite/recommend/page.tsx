import * as styles from '../../../styles/globalstyles'

export default function IgniteRecommendPage() {
  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Recommended Path</p>

        <h1 style={styles.heroTitleStyle}>
          You didn’t fail.
          <br />
          Your system did.
        </h1>

        <p style={styles.heroTextStyle}>
          Ignite was recommended because your answers suggest you’ve been trying,
          showing up, and pushing — but the structure you’ve been using may not be
          evolving with you.
        </p>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>Why Ignite fits</h2>

          <p style={styles.bodyStyle}>
            At some point, consistency stops being enough if the system underneath it
            is not aligned. Your body adapts. Your recovery matters. Your environment
            matters. The structure has to change with you.
          </p>

          <p style={styles.bodyStyle}>
            Ignite gives you more than a plan. It gives you the correction, context,
            and guidance to understand why the structure works and how to align your
            daily life around it.
          </p>
        </section>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>What Ignite gives you</h2>

          <p style={styles.bodyStyle}>
            Ignite is for women who need more support than self-led execution. You’ll
            receive the structure, plus digestible guidance that helps you stop
            guessing and start building progress that holds.
          </p>
        </section>

        <div style={styles.buttonRowStyle}>
          <a href="/program/ignite/cart" style={styles.primaryButtonStyle}>
            Continue with Ignite
          </a>

          <a href="/program/ember" style={styles.secondaryButtonStyle}>
            Prefer less structure? Explore Ember
          </a>

          <a href="/program/phoenix" style={styles.secondaryButtonStyle}>
            Want deeper support? Explore Phoenix
          </a>
          <a href="/program/ignite/why" style={styles.secondaryButtonStyle}>
  See what we saw in your application
</a>
        </div>
      </div>
    </main>
  )
}
