import Link from 'next/link'
import * as styles from '../styles/globalstyles'

export default function AboutPage() {
  return (
    <main className={pageStyle}>
      <section className={heroStyle}>
        <p className={eyebrowStyle}>About Anastasis</p>
        <h1>This Was Never Meant To Be Another Fitness Program.</h1>
        <p className={heroTextStyle}>
          Anastasis was built for women whose bodies stopped responding to the
          things they were told should work.
        </p>
      </section>

      <section className={sectionStyle}>
        <h2>The Meaning of Anastasis</h2>
        <p>
          Anastasis means rising again — restoration, return, and standing back
          up after collapse.
        </p>
        <p>
          Not punishment. Not shrinking. Not surviving on willpower.
        </p>
        <p>
          This system was built to help women rebuild trust with their bodies
          through intelligent structure, recovery, progression, and nervous
          system support.
        </p>
      </section>

      <section className={sectionStyle}>
        <h2>What Makes Anastasis Different</h2>
        <p>Most fitness platforms ask, “How many calories did you burn?”</p>
        <p>Anastasis asks better questions.</p>

        <div className={gridStyle}>
          {[
            'How is your body adapting?',
            'Is recovery being supported?',
            'Is inflammation masking progress?',
            'Is your posture compensating?',
            'Is your nervous system overwhelmed?',
            'Is your training aligned with your life?',
          ].map((item) => (
            <div key={item} className={cardStyle}>
              {item}
            </div>
          ))}
        </div>
      </section>

      <section className={sectionStyle}>
        <h2>Built for Real Life</h2>
        <p>
          Anastasis was created for women carrying full lives — women managing
          families, work, stress, decision fatigue, and the quiet exhaustion of
          trying to do everything well.
        </p>
        <p>
          This is not random programming. This is systems architecture for women
          who need structure that actually works with them.
        </p>
      </section>

      <section className={sectionStyle}>
        <h2>Our Philosophy</h2>
        <p>
          Your body is not broken. Bodies adapt.
        </p>
        <p>
          When a system fails to account for stress, hormones, recovery,
          inflammation, posture, and nervous system load, it eventually stops
          producing results.
        </p>
        <p>
          That does not mean you failed. It means the architecture failed you.
        </p>
      </section>

      <section className={ctaStyle}>
        <h2>Rise with structure that finally makes sense.</h2>
        <p>
          Anastasis exists to help women feel safe, strong, informed, and
          supported inside their own bodies again.
        </p>
        <Link href="/apply" className={buttonStyle}>
          See if you’re ready
        </Link>
      </section>
    </main>
  )
}
