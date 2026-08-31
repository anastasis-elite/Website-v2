import type { Metadata } from 'next'
import Link from 'next/link'
import * as styles from '../styles/globalstyles'
import TrackEvent from '@/components/TrackEvent'
import { BRAND_NAME } from '@/lib/seo'

const whyDescription =
  'Understand why Anastasis connects capacity, recovery, fitness, nutrition, and daily support for women instead of treating health as another full-time job.'

export const metadata: Metadata = {
  title: 'Why Anastasis',
  description: whyDescription,
  alternates: {
    canonical: '/why',
  },
  openGraph: {
    title: 'Why Anastasis',
    description: whyDescription,
    url: '/why',
    siteName: BRAND_NAME,
  },
  twitter: {
    card: 'summary',
    title: 'Why Anastasis',
    description: whyDescription,
  },
}

const sectionBlock = {
  marginBottom: '110px',
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
            <p style={styles.eyebrowStyle}>Why You Keep Starting Over</p>

            <h1 style={{ ...styles.heroTitleStyle, textAlign: 'center' }}>
              It&apos;s probably not because you&apos;re lazy, unmotivated, or
              lacking discipline.
            </h1>

            <p style={experienceText}>
              Most women don&apos;t need another plan.
              <br />
              They need enough capacity to actually follow one.
            </p>
          </section>

          <section style={sectionBlock}>
            <p style={styles.eyebrowStyle}>The Real Problem</p>

            <h2 style={{ ...styles.heroTitleStyle, fontSize: 'clamp(2rem, 4vw, 3.7rem)' }}>
              The problem was never motivation.
            </h2>

            <div style={{ ...softPanel, maxWidth: '860px', margin: '42px auto 0 auto' }}>
              {[
                'You&apos;ve downloaded the meal plans.',
                'You&apos;ve bought the programs.',
                'You&apos;ve promised yourself that this time would be different.',
                'And for a while, it usually is.',
                'Until life gets heavy.',
                'The kids need something.',
                'Work gets stressful.',
                'Someone gets sick.',
                'Sleep disappears.',
                'And suddenly the things that were helping you feel like yourself become the first things sacrificed.',
              ].map((line) => (
                <p key={line} style={experienceText} dangerouslySetInnerHTML={{ __html: line }} />
              ))}
            </div>
          </section>

          <section style={sectionBlock}>
            <p style={styles.eyebrowStyle}>What Most Programs Miss</p>

            <h2 style={{ ...styles.heroTitleStyle, fontSize: 'clamp(2rem, 4vw, 3.7rem)' }}>
              Most programs ignore capacity.
            </h2>

            <p style={experienceText}>
              Traditional wellness programs assume you have unlimited energy,
              unlimited time, and unlimited mental bandwidth.
            </p>

            <p style={experienceText}>Real life doesn&apos;t work like that.</p>

            <p style={experienceText}>
              Especially for women carrying careers, households, relationships,
              children, appointments, responsibilities, and everyone else&apos;s
              needs.
            </p>

            <p style={experienceText}>
              When your capacity drops, your ability to execute drops with it.
            </p>

            <p style={experienceText}>That isn&apos;t failure.</p>

            <p style={experienceText}>That&apos;s reality.</p>
          </section>

          <section style={sectionBlock}>
            <p style={styles.eyebrowStyle}>The Signals</p>

            <h2 style={{ ...styles.heroTitleStyle, fontSize: 'clamp(2rem, 4vw, 3.7rem)' }}>
              Your body has been telling the story all along.
            </h2>

            <div style={{ ...styles.cardGridStyle, marginTop: '54px' }}>
              {[
                'Chronic fatigue',
                'Stress eating',
                'Poor recovery',
                'Constant restarts',
                'Hormonal symptoms',
                'Feeling disconnected from yourself',
              ].map((item) => (
                <div key={item} style={styles.cardStyle}>
                  <p style={{ ...styles.cardTextStyle, margin: 0 }}>{item}</p>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '36px' }}>
              <p style={experienceText}>None of these happen in isolation.</p>
              <p style={experienceText}>Your body adapts to the environment it lives in.</p>
              <p style={experienceText}>
                If the environment is chaotic, overloaded, exhausted, and
                running on survival mode, your body eventually reflects that
                reality.
              </p>
            </div>
          </section>

          <section style={sectionBlock}>
            <p style={styles.eyebrowStyle}>Something Different</p>

            <h2 style={{ ...styles.heroTitleStyle, fontSize: 'clamp(2rem, 4vw, 3.7rem)' }}>
              So we built something different.
            </h2>

            <p style={experienceText}>Anastasis wasn&apos;t designed around punishment.</p>
            <p style={experienceText}>It wasn&apos;t designed around perfection.</p>
            <p style={experienceText}>
              And it wasn&apos;t designed for the woman whose entire life
              revolves around fitness.
            </p>
            <p style={experienceText}>It was built for the woman carrying everything.</p>
            <p style={experienceText}>The woman trying to hold her family together.</p>
            <p style={experienceText}>
              The woman trying to take care of herself without abandoning
              everyone else.
            </p>
            <p style={experienceText}>The woman who misses who she used to be.</p>
          </section>

          <section style={{ ...sectionBlock, marginBottom: '80px' }}>
            <div style={{ ...softPanel, maxWidth: '900px', margin: '0 auto' }}>
              <p style={styles.eyebrowStyle}>The Real Goal</p>

              <h2 style={{ ...styles.heroTitleStyle, fontSize: 'clamp(2rem, 4vw, 3.8rem)' }}>
                The goal isn&apos;t weight loss.
              </h2>

              <p style={experienceText}>Weight loss may happen.</p>
              <p style={experienceText}>Strength may happen.</p>
              <p style={experienceText}>Better energy may happen.</p>
              <p style={experienceText}>Better recovery may happen.</p>
              <p style={experienceText}>But the real goal is bigger than that.</p>
              <p style={experienceText}>
                The goal is helping you build enough capacity to consistently
                show up for the life you want.
              </p>
              <p style={experienceText}>Because the woman you miss is still there.</p>
              <p style={experienceText}>She doesn&apos;t need more punishment.</p>
              <p style={experienceText}>She needs support.</p>

              <div style={{ ...styles.buttonRowStyle, justifyContent: 'center', marginTop: '42px' }}>
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
