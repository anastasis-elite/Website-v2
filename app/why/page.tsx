import Link from 'next/link'
import * as styles from '../styles/globalstyles'
import TrackEvent from '@/components/TrackEvent'

const sectionBlock = {
  marginBottom: '120px',
  textAlign: 'center' as const,
}

const softPanel = {
  background: 'rgba(18,18,18,0.56)',
  borderRadius: '34px',
  padding: '42px 34px',
  backdropFilter: 'blur(18px)',
  boxShadow: '0 24px 80px rgba(0,0,0,0.18)',
}

const experienceText = {
  fontSize: '1.08rem',
  lineHeight: 1.95,
  color: 'rgba(215,199,182,0.82)',
  maxWidth: '760px',
  margin: '0 auto 22px auto',
}

export default function WhyPage() {
  return (
    <>
      <TrackEvent event="why_page_viewed" properties={{ page: 'why' }} />

      <main style={styles.pageStyle}>
        <div style={{ ...styles.containerStyle, maxWidth: '1060px' }}>
          <section style={{ ...sectionBlock, marginBottom: '130px' }}>
            <p style={styles.eyebrowStyle}>Why Anastasis Exists</p>

            <h1
              style={{
                ...styles.heroTitleStyle,
                margin: '0 auto 34px auto',
                textAlign: 'center',
              }}
            >
              You were never meant to carry everything while abandoning yourself.
            </h1>

            <p style={experienceText}>
              Anastasis was built for the woman who knows she is capable, but
              cannot keep forcing herself through systems that ignore her body,
              her season, her cycle, her recovery, and her real life.
            </p>
          </section>

          <section style={sectionBlock}>
            <p style={styles.eyebrowStyle}>The Real Problem</p>

            <h2
              style={{
                ...styles.heroTitleStyle,
                fontSize: 'clamp(2rem, 4vw, 3.7rem)',
                margin: '0 auto 42px auto',
              }}
            >
              It was never just motivation.
            </h2>

            <div style={{ ...softPanel, maxWidth: '860px', margin: '0 auto' }}>
              {[
                'You start strong.',
                'You get momentum.',
                'You begin to feel like yourself again.',
                'Then life gets heavy.',
                'The kids need more.',
                'Work demands more.',
                'Your sleep disappears.',
                'Your body stops recovering.',
                'And once again, you become the first thing sacrificed.',
              ].map((line) => (
                <p key={line} style={experienceText}>
                  {line}
                </p>
              ))}
            </div>
          </section>

          <section style={sectionBlock}>
            <p style={styles.eyebrowStyle}>What Most Programs Miss</p>

            <h2
              style={{
                ...styles.heroTitleStyle,
                fontSize: 'clamp(2rem, 4vw, 3.7rem)',
                margin: '0 auto 42px auto',
              }}
            >
              Capacity changes everything.
            </h2>

            <p style={experienceText}>
              Most programs assume you have unlimited time, unlimited energy,
              and unlimited mental bandwidth.
            </p>

            <p style={experienceText}>
              But real life does not work that way. Especially for women
              carrying households, children, careers, appointments,
              relationships, invisible labor, and everyone else’s needs.
            </p>

            <p style={experienceText}>
              When your capacity drops, your ability to execute drops with it.
              That is not failure. That is a signal.
            </p>
          </section>

          <section style={sectionBlock}>
            <p style={styles.eyebrowStyle}>The Signals</p>

            <h2
              style={{
                ...styles.heroTitleStyle,
                fontSize: 'clamp(2rem, 4vw, 3.7rem)',
                margin: '0 auto 54px auto',
              }}
            >
              Your body has been telling the story all along.
            </h2>

            <div style={styles.cardGridStyle}>
              {[
                'Constant restarts',
                'Stress eating',
                'Low energy',
                'Poor recovery',
                'Hormonal symptoms',
                'Feeling disconnected from yourself',
              ].map((item) => (
                <div key={item} style={styles.cardStyle}>
                  <p style={{ ...styles.cardTextStyle, margin: 0 }}>{item}</p>
                </div>
              ))}
            </div>
          </section>

          <section style={sectionBlock}>
            <p style={styles.eyebrowStyle}>The Anastasis Difference</p>

            <h2
              style={{
                ...styles.heroTitleStyle,
                fontSize: 'clamp(2rem, 4vw, 3.7rem)',
                margin: '0 auto 42px auto',
              }}
            >
              This is not another plan asking you to become less human.
            </h2>

            <p style={experienceText}>
              Anastasis is an adaptive women’s wellness experience designed to
              help you train, eat, recover, reflect, and rebuild capacity in a
              way your actual life can sustain.
            </p>

            <p style={experienceText}>
              Not through punishment. Not through perfection. Through awareness,
              support, structure, and adaptation.
            </p>
          </section>

          <section style={{ ...sectionBlock, marginBottom: '80px' }}>
            <div style={{ ...softPanel, maxWidth: '900px', margin: '0 auto' }}>
              <p style={styles.eyebrowStyle}>Come Home To Yourself</p>

              <h2
                style={{
                  ...styles.heroTitleStyle,
                  fontSize: 'clamp(2rem, 4vw, 3.8rem)',
                  margin: '0 auto 34px auto',
                }}
              >
                The woman you miss is still there.
              </h2>

              <p style={experienceText}>
                She does not need more punishment. She needs enough support to
                hear herself again.
              </p>

              <p style={experienceText}>
                Start with the Capacity Audit and discover what may actually be
                draining your energy, motivation, recovery, and sense of self.
              </p>

              <div
                style={{
                  ...styles.buttonRowStyle,
                  justifyContent: 'center',
                  marginTop: '42px',
                }}
              >
                <Link href="/audit" style={styles.primaryButtonStyle}>
                  Take the Capacity Audit
                </Link>

                <Link href="/program" style={styles.secondaryButtonStyle}>
                  Explore the Programs
                </Link>
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  )
}
