import type { Metadata } from 'next'
import * as styles from '../styles/globalstyles'
import TrackEvent from '@/components/TrackEvent'
import Link from 'next/link'
import { BRAND_NAME } from '@/lib/seo'

const programDescription =
  'Compare Anastasis program paths for assessed training, nutrition tools, recovery guidance, and recorded progress.'

export const metadata: Metadata = {
  title: 'Anastasis Programs',
  description: programDescription,
  alternates: {
    canonical: '/program',
  },
  openGraph: {
    title: 'Anastasis Programs',
    description: programDescription,
    url: '/program',
    siteName: BRAND_NAME,
  },
  twitter: {
    card: 'summary',
    title: 'Anastasis Programs',
    description: programDescription,
  },
}

const paths = [
  {
    name: 'Ember',
    headline: 'Rebuild Consistency',
    tagline:
      'For the woman who knows what she wants, but needs a sustainable structure she can actually follow.',
    body:
      'Ember brings your assessed training plan, macro targets, water tracking, and recorded progress into one place. Start with what you can manage and keep a record you can return to.',
    includes: [
      'Training based on member assessments',
      'Macro targets and daily macro totals',
      'Water tracking',
      'Basic recovery guidance',
      'Recorded progress and cycle context',
      'Foundational assessments',
    ],
    bestFor: 'Women who want a self-led foundation with a clear next step.',
    href: '/program/ember',
  },
  {
    name: 'Ignite',
    headline: 'Optimize What Is Working',
    tagline:
      'For the woman who has built some consistency and is ready to refine the details.',
    body:
      'Ignite adds food logging and more detail from your recorded nutrition and recovery inputs. Review those details alongside your training plan, with room for the realities of your day.',
    includes: [
      'Assessed training and progress history',
      'Manual food and barcode logging',
      'Nutrient detail from recorded foods',
      'Recovery recommendations',
      'Progress photo uploads',
      'User-confirmed posture landmarks',
    ],
    bestFor: 'Women who want food logging and more context for daily decisions.',
    href: '/program/ignite',
  },
  {
    name: 'Phoenix',
    headline: 'Remove Friction',
    tagline:
      'For the woman who wants meal recommendations and a more directed daily view.',
    body:
      'Phoenix brings the food logging, recovery detail, and photo tools available in Ignite together with meal recommendations and directed next actions. Use your recorded inputs to review a manageable next step.',
    includes: [
      'Assessed training and progress history',
      'Manual food and barcode logging',
      'Meal recommendations',
      'Directed nutrition and recovery next actions',
      'User-confirmed posture landmarks',
      'Recorded nutrition and recovery context',
    ],
    bestFor: 'Women who want a suggested next action alongside their recorded context.',
    href: '/program/phoenix',
  },
]

export default function ProgramPage() {
  return (
    <><TrackEvent event="program_page_viewed" properties={{ page: 'programs' }} />
    <main style={styles.pageStyle}>
      <div style={{ ...styles.containerStyle, maxWidth: '1120px' }}>

        <section style={{ marginBottom: '110px', textAlign: 'center' }}>
          <p style={styles.eyebrowStyle}>Choose Your Path</p>

          <h1
            style={{
              ...styles.heroTitleStyle,
              maxWidth: '980px',
              margin: '0 auto 28px auto',
            }}
          >
            Find the starting point that fits your life right now.
          </h1>

          <p
            style={{
              ...styles.heroTextStyle,
              maxWidth: '820px',
              margin: '0 auto 42px auto',
            }}
          >
            Start with the tools that fit your current capacity, time, and
            resources. Compare what each path includes, then choose the amount
            of tracking and daily direction that would be useful to you now.
          </p>

          <div style={{ ...styles.buttonRowStyle, justifyContent: 'center' }}>
            <a href="#paths" style={styles.primaryButtonStyle}>
              Explore the Paths
            </a>

            <a href="/audit" style={styles.secondaryButtonStyle}>
              Help Me Find Mine
            </a>
          </div>
        </section>

        <section style={{ marginBottom: '120px', textAlign: 'center' }}>
          <p style={styles.eyebrowStyle}>One Destination. Three Starting Points.</p>

          <h2
            style={{
              ...styles.heroTitleStyle,
              fontSize: 'clamp(2rem, 4vw, 3.6rem)',
              maxWidth: '900px',
              margin: '0 auto 34px auto',
            }}
          >
            The goal is not to push harder forever.
            <br />
            The goal is expanded capacity.
          </h2>

          <p
            style={{
              ...styles.heroTextStyle,
              maxWidth: '780px',
              margin: '0 auto 56px auto',
            }}
          >
            Every path includes assessed training, daily check-ins, recovery
            guidance, and progress history. Nutrition tools and the way next
            actions are presented differ by path. Your recorded inputs provide
            context for the guidance you see.
          </p>

          <p
            style={{
              ...styles.heroTextStyle,
              maxWidth: '760px',
              margin: '0 auto 48px auto',
            }}
          >
            Anastasis brings training, nutrition tools, and recovery guidance
            into one member dashboard.
            Learn more about{' '}
            <Link href="/what-is-anastasis" style={{ color: '#c58b57', textDecoration: 'underline' }}>
              how Anastasis works
            </Link>
            .
          </p>

          <div style={styles.cardGridStyle}>
            {[
              'Review your training plan',
              'Record how you feel',
              'Review recovery guidance',
              'Keep your history together',
              'See your next step',
              'Return when you have capacity',
            ].map((item) => (
              <div key={item} style={styles.cardStyle}>
                <p style={{ ...styles.cardTextStyle, margin: 0 }}>{item}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="paths" style={{ marginBottom: '120px' }}>
          <p style={styles.eyebrowStyle}>The Paths</p>

          <h2
            style={{
              ...styles.heroTitleStyle,
              fontSize: 'clamp(2rem, 4vw, 3.6rem)',
              maxWidth: '900px',
              marginBottom: '48px',
            }}
          >
            Which season sounds most like you?
          </h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
              gap: '28px',
            }}
          >
            {paths.map((path) => (
              <div
                key={path.name}
                style={{
                  ...styles.cartBoxStyle,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <p style={styles.eyebrowStyle}>{path.name}</p>

                  <h3
                    style={{
                      ...styles.sectionTitleStyle,
                      fontSize: '1.9rem',
                      marginBottom: '12px',
                    }}
                  >
                    {path.headline}
                  </h3>

                  <p
                    style={{
                      ...styles.bodyStyle,
                      color: 'rgba(245,240,232,0.88)',
                      marginBottom: '20px',
                    }}
                  >
                    {path.tagline}
                  </p>

                  <p style={{ ...styles.bodyStyle, marginBottom: '28px' }}>
                    {path.body}
                  </p>

                  <p
                    style={{
                      ...styles.eyebrowStyle,
                      marginBottom: '14px',
                    }}
                  >
                    Inside {path.name}
                  </p>

                  <div style={{ display: 'grid', gap: '12px', marginBottom: '30px' }}>
                    {path.includes.map((item) => (
                      <p key={item} style={{ ...styles.cardTextStyle, margin: 0 }}>
                        • {item}
                      </p>
                    ))}
                  </div>

                  <div
                    style={{
                      borderTop: '1px solid rgba(197,139,87,0.18)',
                      paddingTop: '22px',
                      marginBottom: '32px',
                    }}
                  >
                    <p style={{ ...styles.eyebrowStyle, marginBottom: '10px' }}>
                      Best For
                    </p>

                    <p style={{ ...styles.cardTextStyle, margin: 0 }}>
                      {path.bestFor}
                    </p>
                  </div>
                </div>

                <a href={path.href} style={styles.primaryButtonStyle}>
                  Explore {path.name}
                </a>
              </div>
            ))}
          </div>
        </section>

        <section style={{ marginBottom: '120px' }}>
          <p style={styles.eyebrowStyle}>What Life Looks Like Inside Anastasis</p>

          <h2
            style={{
              ...styles.heroTitleStyle,
              fontSize: 'clamp(2rem, 4vw, 3.6rem)',
              maxWidth: '900px',
              marginBottom: '48px',
            }}
          >
            Not another plan to force.
            <br />
            A system to build from.
          </h2>

          <div style={styles.cardGridStyle}>
            {[
              {
                title: 'Your starting point',
                text:
                  'Enter your profile, equipment, goals, training availability, and member assessments. These inputs help establish your starting plan.',
              },
              {
                title: 'Your daily view',
                text:
                  'Review your assigned workout, nutrition tools, and recovery guidance. Record what you do and how you feel, at a pace that fits your day.',
              },
              {
                title: 'Your recorded history',
                text:
                  'Return to saved workouts, check-ins, measurements, and photos to review change over time. Your history reflects what you have recorded.',
              },
              {
                title: 'Your next review',
                text:
                  'Update assessments when they are due and review your current inputs as your circumstances change. Continue from the information available rather than starting over.',
              },
            ].map((item) => (
              <div key={item.title} style={styles.cardStyle}>
                <h3 style={styles.cardTitleStyle}>{item.title}</h3>
                <p style={styles.cardTextStyle}>{item.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section
          style={{
            ...styles.cartBoxStyle,
            textAlign: 'center',
            padding: '52px 32px',
            marginBottom: '90px',
          }}
        >
          <p style={styles.eyebrowStyle}>Not Sure Where To Begin?</p>

          <h2
            style={{
              ...styles.heroTitleStyle,
              fontSize: 'clamp(2rem, 4vw, 3.2rem)',
              margin: '0 auto 22px auto',
              maxWidth: '820px',
            }}
          >
            Take the Capacity Assessment.
          </h2>

          <p
            style={{
              ...styles.heroTextStyle,
              maxWidth: '760px',
              margin: '0 auto 36px auto',
            }}
          >
            The Capacity Assessment asks five broad questions about your energy,
            overwhelm, time, support, and current season to suggest a starting
            path. Detailed member assessments follow after enrollment. Review the
            options and decide what fits your life now.
          </p>

          <div style={{ ...styles.buttonRowStyle, justifyContent: 'center' }}>
            <Link href="/audit" style={styles.primaryButtonStyle}>
              Help Me Find My Path
            </Link>

            <Link href="/" style={styles.secondaryButtonStyle}>
              Return Home
            </Link>
          </div>
        </section>

      </div>
    </main>
    </>
  )
}
