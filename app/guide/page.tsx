import Link from 'next/link'
import * as styles from '../styles/globalstyles'
import Image from 'next/image'

export default function GuidePage() {
  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>The Anastasis Shift</p>

        <h1 style={styles.heroTitleStyle}>
          For the woman who wants her life back.
        </h1>

        <p style={styles.heroTextStyle}>
          A psychological guide for rebuilding self-trust, breaking shame
          cycles, and learning how to return to yourself again before stepping
          into a structured transformation program.
        </p>

        <div
          style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: '72px',
          }}
        >
        <Image
          src="/TheAnastasisShift.png"
          alt="The Anastasis Shift"
          width={420}
          height={620}
          style={{
            width: '100%',
            maxWidth: '420px',
            height: 'auto',
            borderRadius: '28px',
            boxShadow:
              '0 28px 90px rgba(0,0,0,0.42), 0 0 48px rgba(181,110,67,0.12)',
          }}
          priority
        />
      </div>
        
        <section style={styles.cartBoxStyle}>
          <h2 style={styles.sectionTitleStyle}>
            You do not need more pressure.
          </h2>

          <p style={styles.bodyStyle}>
            You need a system that helps you become ready to execute
            consistently. This guide was created for women who are not failing
            from lack of effort, but from carrying too much without the right
            structure beneath them.
          </p>
        </section>

        <section style={styles.cartBoxStyle}>
          <h2 style={styles.sectionTitleStyle}>
            This guide helps you rebuild:
          </h2>

          <div style={styles.compactCardGridStyle}>
            {[
              'Self-trust',
              'Execution capacity',
              'Daily structure',
              'Emotional regulation',
              'Consistency without shame',
              'Readiness for the next layer',
            ].map((item) => (
              <div key={item} style={styles.compactCardStyle}>
                <h3 style={styles.compactCardTitleStyle}>{item}</h3>
              </div>
            ))}
          </div>
        </section>

        <section style={styles.cartBoxStyle}>
          <h2 style={styles.sectionTitleStyle}>
            This is for you if:
          </h2>

          <p style={styles.bodyStyle}>
            You keep restarting. You know what to do, but struggle to sustain
            it. You feel overwhelmed by everything required to change. You need
            a foundation before intensity.
          </p>
        </section>

        <section style={styles.cartBoxStyle}>
          <h2 style={styles.sectionTitleStyle}>
            You are not behind.
          </h2>

          <p style={styles.bodyStyle}>
            You are building the capacity to sustain what comes next. The
            Anastasis Shift is the bridge between where you are now and the
            program layer you may be ready for later.
          </p>
        </section>

        <div style={styles.buttonRowStyle}>
          <a
            href="#"
            style={styles.primaryButtonStyle}
          >
            Access The Guide
          </a>

          <Link href="/apply" style={styles.secondaryButtonStyle}>
            Return to Application
          </Link>
        </div>
      </div>
    </main>
  )
}
