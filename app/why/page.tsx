import type { Metadata } from 'next'
import Link from 'next/link'
import * as styles from '../styles/globalstyles'
import TrackEvent from '@/components/TrackEvent'
import { BRAND_NAME } from '@/lib/seo'

const whyDescription =
  'See how Anastasis uses your goals, circumstances, check-ins, and recorded activity to help you choose a manageable next step.'

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
            <p style={styles.eyebrowStyle}>Room for real life</p>

            <h1 style={{ ...styles.heroTitleStyle, textAlign: 'center' }}>
              Your plans should have room for your life.
            </h1>

            <p style={experienceText}>
              You can be capable, committed, and carrying a lot.
              <br />
              A useful plan starts with the day you actually have.
            </p>
          </section>

          <section style={sectionBlock}>
            <p style={styles.eyebrowStyle}>When plans meet the day</p>

            <h2 style={{ ...styles.heroTitleStyle, fontSize: 'clamp(2rem, 4vw, 3.7rem)' }}>
              The day can change. Your next step can too.
            </h2>

            <div style={{ ...softPanel, maxWidth: '860px', margin: '42px auto 0 auto' }}>
              {[
                'You make time for training.',
                'You plan meals around a full week.',
                'Then a meeting runs late.',
                'Someone needs your attention.',
                'You have less time than you expected.',
                'You may have slept differently.',
                'Your energy may be different too.',
                'The original plan still matters.',
                'So does what is practical now.',
                'A clear next step can help you decide where to begin.',
              ].map((line) => (
                <p key={line} style={experienceText} dangerouslySetInnerHTML={{ __html: line }} />
              ))}
            </div>
          </section>

          <section style={sectionBlock}>
            <p style={styles.eyebrowStyle}>Context matters</p>

            <h2 style={{ ...styles.heroTitleStyle, fontSize: 'clamp(2rem, 4vw, 3.7rem)' }}>
              A plan is more useful when it has context.
            </h2>

            <p style={experienceText}>
              Your available time, recent activity, sleep, and how you feel
              can affect what is practical for the day ahead.
            </p>

            <p style={experienceText}>Those details deserve a place in the plan.</p>

            <p style={experienceText}>
              Anastasis uses the goals, assessments, circumstances, and
              check-ins you share to inform training and recovery guidance.
            </p>

            <p style={experienceText}>
              You can review that guidance alongside your commitments and
              choose what makes sense to do next.
            </p>

            <p style={experienceText}>Your recorded progress stays in view.</p>

            <p style={experienceText}>A change of plan can be a considered decision.</p>
          </section>

          <section style={sectionBlock}>
            <p style={styles.eyebrowStyle}>Useful information</p>

            <h2 style={{ ...styles.heroTitleStyle, fontSize: 'clamp(2rem, 4vw, 3.7rem)' }}>
              Start with what you can tell us today.
            </h2>

            <div style={{ ...styles.cardGridStyle, marginTop: '54px' }}>
              {[
                'Sleep',
                'Energy',
                'Soreness',
                'Training availability',
                'Cycle context, if shared',
                'Your goals and commitments',
              ].map((item) => (
                <div key={item} style={styles.cardStyle}>
                  <p style={{ ...styles.cardTextStyle, margin: 0 }}>{item}</p>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '36px' }}>
              <p style={experienceText}>You provide the context through your inputs.</p>
              <p style={experienceText}>Your dashboard brings your plan and recorded activity together.</p>
              <p style={experienceText}>
                That gives you a place to review what is planned, what you
                have done, and the guidance available in your program.
              </p>
            </div>
          </section>

          <section style={sectionBlock}>
            <p style={styles.eyebrowStyle}>A clearer place to begin</p>

            <h2 style={{ ...styles.heroTitleStyle, fontSize: 'clamp(2rem, 4vw, 3.7rem)' }}>
              Bring the next step into view.
            </h2>

            <p style={experienceText}>Open your assigned workout and review its prescribed movements.</p>
            <p style={experienceText}>Record what you do and return to your saved progress.</p>
            <p style={experienceText}>
              Review nutrition targets and recovery options alongside your daily check-in.
            </p>
            <p style={experienceText}>Choose the program with the tools you want to use.</p>
            <p style={experienceText}>EMBER focuses on calories, macros, and hydration.</p>
            <p style={experienceText}>
              It does not include food or meal logging. IGNITE and PHOENIX add food logging and nutrient information.
            </p>
            <p style={experienceText}>Your choices can reflect the time and attention you have.</p>
          </section>

          <section style={{ ...sectionBlock, marginBottom: '80px' }}>
            <div style={{ ...softPanel, maxWidth: '900px', margin: '0 auto' }}>
              <p style={styles.eyebrowStyle}>Your starting point</p>

              <h2 style={{ ...styles.heroTitleStyle, fontSize: 'clamp(2rem, 4vw, 3.8rem)' }}>
                Room for what matters to you.
              </h2>

              <p style={experienceText}>Start with the goals you want to work toward.</p>
              <p style={experienceText}>Consider the circumstances you are working within.</p>
              <p style={experienceText}>Choose a level of guidance that suits you.</p>
              <p style={experienceText}>Use your check-ins and recorded activity to keep context in view.</p>
              <p style={experienceText}>Then take one manageable next step.</p>
              <p style={experienceText}>
                The Capacity Audit asks five brief questions and suggests a
                starting program to explore. Member onboarding gathers the
                detail needed to create your plan.
              </p>
              <p style={experienceText}>You can also review the programs at your own pace.</p>
              <p style={experienceText}>See what each one includes.</p>
              <p style={experienceText}>Choose where you would like to begin.</p>

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
