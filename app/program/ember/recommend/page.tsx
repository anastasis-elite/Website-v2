import * as styles from '../../../styles/globalstyles'
  
import type { CSSProperties } from 'react'

export default function EmberRecommendPage() {
  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Recommended Path</p>

        <h1 style={styles.heroTitleStyle}>
          You don’t need more information.
          <br />
          You need less thinking.
        </h1>

        <p style={styles.heroTextStyle}>
          Ember was recommended because your answers suggest you already have the
          discipline, awareness, and ability to execute — you just need the structure
          handled for you.
        </p>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>Why Ember fits</h2>
          <p style={styles.bodyStyle}>
            You’ve already learned pieces of what works. But carrying the daily weight
            of deciding how much, when, how often, and whether it’s enough creates
            friction.
          </p>

          <p style={styles.bodyStyle}>
            Ember removes that friction. Your structure is calculated. Your numbers are
            set. Your execution becomes cleaner, simpler, and easier to sustain.
          </p>
        </section>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>What Ember gives you</h2>
          <p style={styles.bodyStyle}>
            Ember is the base layer — a precision execution system for women who are
            self-led and ready to stop wasting energy figuring everything out manually.
          </p>
        </section>

        <div style={styles.buttonRowStyle}>
          <a href="/program/ember/cart" style={styles.primaryButtonStyle}>
            Continue with Ember
          </a>

          <a href="/program/ignite" style={styles.secondaryButtonStyle}>

    Want deeper support? Explore Ignite

  </a>
<a href="/program/ember/why" style={styles.secondaryButtonStyle}>
  See what we saw in your application
</a>
</div>
      </div>
    </main>
  )
}

