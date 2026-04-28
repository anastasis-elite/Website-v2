'use client'

import { useSearchParams } from 'next/navigation'
import * as styles from '../../styles/globalstyles'

export default function AssessmentIntroPage() {
  const searchParams = useSearchParams()
  const program = searchParams.get('program') || ''

  const programLabel =
    program === 'ember'
      ? 'Ember'
      : program === 'ignite'
        ? 'Ignite'
        : program === 'phoenix'
          ? 'Phoenix'
          : 'your program'

  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Assessment</p>

        <h1 style={styles.heroTitleStyle}>
          Before your program is built, we need to read your body correctly.
        </h1>

        <p style={styles.heroTextStyle}>
          You’re beginning the assessment for {programLabel}. This step helps gather the
          information needed to build your execution plan with more precision.
        </p>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>This is not a max-out test</h2>

          <div style={styles.bodyStyle}>
            <p>
              Do not attempt a true one-rep max during this assessment.
            </p>

            <p>
              The goal is not to prove how strong you are in one lift. The goal is to
              collect clean, useful data that can be used to calculate your starting
              structure safely and intelligently.
            </p>
          </div>
        </section>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>Form matters more than weight</h2>

          <div style={styles.bodyStyle}>
            <p>
              Every rep should be controlled, intentional, and performed with proper
              alignment.
            </p>

            <p>
              If your form breaks, the set is over. That number is more useful than a
              heavier weight performed poorly.
            </p>
          </div>
        </section>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>Breathing is part of the assessment</h2>

          <div style={styles.bodyStyle}>
            <p>
              Breathe through each rep. Do not hold your breath aggressively or force
              your body through the movement.
            </p>

            <p>
              Your breathing, control, and ability to stay regulated matter just as much
              as the weight you move.
            </p>
          </div>
        </section>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>Stop if anything feels wrong</h2>

          <div style={styles.bodyStyle}>
            <p>
              If you feel sharp pain, dizziness, unusual pressure, numbness, or anything
              that feels unsafe, stop immediately.
            </p>

            <p>
              This assessment is here to support your progression — not override your
              body’s signals.
            </p>
          </div>
        </section>

        <section style={styles.cartBoxStyle}>
          <h2 style={styles.sectionTitleStyle}>Assessment rules</h2>

          <div style={styles.bodyStyle}>
            <p>Move with control.</p>
            <p>Prioritize form over load.</p>
            <p>Breathe through the rep.</p>
            <p>Do not attempt a true one-rep max.</p>
            <p>Stop if your body gives you a clear warning signal.</p>
          </div>
        </section>

        <div style={styles.buttonRowStyle}>
          <a
            href={`/dashboard/assessment/start?program=${program}`}
            style={styles.primaryButtonStyle}
          >
            I understand — begin assessment
          </a>
        </div>
      </div>
    </main>
  )
}
