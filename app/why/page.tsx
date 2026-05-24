import Link from 'next/link'
import styles from './styles/globalstyles.ts'

export default function WhyPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <p className={styles.eyebrow}>Why Anastasis Exists</p>
        <h1>Because Women Deserved Better Systems.</h1>
        <p className={styles.heroText}>
          For decades, women were handed systems built around restriction,
          punishment, burnout, and generic programming — then blamed when their
          bodies adapted.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Why We Built This Differently</h2>
        <p>
          Anastasis exists because “eat less and move more” was never the whole
          story.
        </p>

        <div className={styles.grid}>
          {[
            'Recovery matters.',
            'Hormones matter.',
            'Nervous systems matter.',
            'Posture matters.',
            'Inflammation matters.',
            'Sustainability matters.',
          ].map((item) => (
            <div key={item} className={styles.card}>
              {item}
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2>Why Assessments Matter</h2>
        <p>
          Most programs give everyone the same plan. Anastasis adapts.
        </p>
        <p>
          Your measurements, recovery, training history, posture, movement
          patterns, stress, and adaptation patterns all help guide the system.
        </p>
        <p>
          Because your body is communicating constantly. Training should listen.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Why We Track More Than Weight</h2>
        <p>The scale cannot tell you the full truth.</p>

        <div className={styles.grid}>
          {[
            'It cannot show inflammation.',
            'It cannot show posture changes.',
            'It cannot show strength progression.',
            'It cannot show nervous system load.',
            'It cannot show muscle gain clearly.',
            'It cannot show real body recomposition alone.',
          ].map((item) => (
            <div key={item} className={styles.card}>
              {item}
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2>Why This Feels Different</h2>
        <p>
          Anastasis was not built to keep women dependent. It was built to
          educate, guide, support, and help women understand their bodies more
          deeply.
        </p>
        <p>
          Not through fear. Through awareness.
        </p>
      </section>

      <section className={styles.cta}>
        <h2>This is not about becoming smaller.</h2>
        <p>
          It is about becoming more connected, more informed, more regulated,
          more powerful, and more supported.
        </p>
        <Link href="/apply" className={styles.button}>
          Begin the readiness check
        </Link>
      </section>
    </main>
  )
}
