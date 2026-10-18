import type { Metadata } from 'next'
import Link from 'next/link'
import TrackEvent from '@/components/TrackEvent'
import * as styles from '../styles/globalstyles'
import { BRAND_DESCRIPTOR, BRAND_NAME, absoluteUrl } from '@/lib/seo'

export const metadata: Metadata = {
  title: {
    absolute: 'What Is Anastasis? | Founder-Led Human Engineering for Women',
  },
  description:
    'Explore the founder-led approach behind Anastasis: training, nutrition targets, recovery guidance, and recorded progress with room for women’s goals and circumstances.',
  alternates: {
    canonical: '/what-is-anastasis',
  },
  openGraph: {
    title: 'What Is Anastasis?',
    description:
      'Anastasis brings training plans, nutrition targets, recovery guidance, assessments, and recorded progress together. Member inputs and check-ins help inform the next step.',
    url: '/what-is-anastasis',
    siteName: BRAND_NAME,
  },
  twitter: {
    card: 'summary',
    title: 'What Is Anastasis? | Founder-Led Human Engineering for Women',
    description:
      'Explore the founder-led approach behind Anastasis: training, nutrition targets, recovery guidance, and recorded progress with room for women’s goals and circumstances.',
  },
}

const focusAreas = [
  {
    title: 'Fitness',
    body:
      'Assessment inputs help create a starting training plan with prescribed sets, repetitions, and loads. Record what you do, review your check-in, and choose from the guidance available for your program.',
  },
  {
    title: 'Nutrition',
    body:
      'EMBER includes calorie, macro, and hydration targets with quick macro entry. It excludes food and meal logging. IGNITE and PHOENIX add food and meal logging and micronutrient features.',
  },
  {
    title: 'Recovery',
    body:
      'Review recovery alongside your daily check-in. EMBER offers basic guidance; IGNITE and PHOENIX include additional recovery recommendations, with directed next steps in PHOENIX.',
  },
  {
    title: 'Progress and Assessments',
    body:
      'Keep recorded workouts, water, measurements, and progress in view as you continue. Assessments provide more context; posture assessment is included in IGNITE and PHOENIX.',
  },
  {
    title: 'Daily Guidance',
    body:
      'Your dashboard brings saved inputs and activity records together to suggest a next step. You decide what to act on, what to review, and when to return.',
  },
]

const methodologyPoints = [
  'Begin with your goals, training experience, equipment, and circumstances.',
  'Use assessments and daily check-ins to give guidance more context.',
  'Review your options, record what you do, and return to your saved progress.',
]

export default function WhatIsAnastasisPage() {
  const pageJsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'AboutPage',
        '@id': absoluteUrl('/what-is-anastasis#webpage'),
        name: 'What Is Anastasis?',
        url: absoluteUrl('/what-is-anastasis'),
        description:
          'Anastasis is a founder-led health and performance platform for women, connecting training plans, nutrition targets, recovery guidance, and recorded progress.',
        about: {
          '@id': absoluteUrl('/#application'),
        },
        isPartOf: {
          '@id': absoluteUrl('/#website'),
        },
        mainEntity: {
          '@id': absoluteUrl('/what-is-anastasis#methodology'),
        },
      },
      {
        '@type': 'DefinedTerm',
        '@id': absoluteUrl('/what-is-anastasis#adaptive-human-engineering'),
        name: 'Adaptive Human Engineering',
        description:
          'The founder’s methodology for considering fitness, nutrition, recovery, physiology, environment, and the daily choices women manage together.',
      },
      {
        '@type': 'CreativeWork',
        '@id': absoluteUrl('/what-is-anastasis#methodology'),
        name: 'Anastasis founder-led formulation methodology',
        creator: {
          '@id': absoluteUrl('/what-is-anastasis#founder'),
        },
        about: [
          {
            '@id': absoluteUrl('/what-is-anastasis#adaptive-human-engineering'),
          },
          {
            '@type': 'Thing',
            name: 'Women-first physiology',
          },
          {
            '@type': 'Thing',
            name: 'Formulation-driven wellness programming',
          },
        ],
        description:
          'The Anastasis methodology informs structured guidance, with member goals, circumstances, assessments, and check-ins providing context.',
      },
      {
        '@type': 'Person',
        '@id': absoluteUrl('/what-is-anastasis#founder'),
        name: 'Anastasis founder',
        affiliation: {
          '@id': absoluteUrl('/#organization'),
        },
        hasCredential: [
          {
            '@type': 'EducationalOccupationalCredential',
            credentialCategory: 'Certified Personal Trainer',
          },
          {
            '@type': 'EducationalOccupationalCredential',
            credentialCategory: 'Certified Nutrition Coach',
          },
        ],
        knowsAbout: [
          'Adaptive Human Engineering',
          'women-first physiology',
          'fitness programming',
          'nutrition strategy',
          'recovery systems',
          'capacity-first wellness',
          'formulation-driven program design',
        ],
      },
    ],
  }

  return (
    <>
      <TrackEvent event="what_is_anastasis_page_viewed" properties={{ page: 'what-is-anastasis' }} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pageJsonLd) }}
      />

      <main style={styles.pageStyle}>
        <div style={{ ...styles.containerStyle, maxWidth: '1060px' }}>
          <section style={{ marginBottom: '92px', textAlign: 'center' }}>
            <p style={styles.eyebrowStyle}>{BRAND_DESCRIPTOR}</p>
            <h1 style={{ ...styles.heroTitleStyle, margin: '0 auto 24px' }}>
              What Is Anastasis?
            </h1>
            <p style={{ ...styles.heroTextStyle, margin: '0 auto 18px' }}>
              Anastasis is a founder-led health and performance platform for women with full lives.
            </p>
            <p style={{ ...styles.heroTextStyle, margin: '0 auto', color: '#d7c7b6' }}>
              It brings training plans, nutrition targets, recovery guidance,
              and recorded progress into one place, so the next useful step is
              easier to review.
            </p>
          </section>

          <section style={styles.sectionStyle}>
            <h2 style={styles.sectionTitleStyle}>What Anastasis Does</h2>
            <p style={styles.bodyStyle}>
              Your goals and circumstances matter to the choices you make.
              Anastasis uses the information you share in profiles, assessments,
              and check-ins to inform guidance. You can review your plan, record
              what you do, and keep that context together as you continue.
            </p>
          </section>

          <section style={styles.sectionStyle}>
            <h2 style={styles.sectionTitleStyle}>Who Anastasis Is For</h2>
            <p style={styles.bodyStyle}>
              Anastasis is built for women whose work, family, training,
              recovery, and responsibilities share the same day. Available time
              and energy can change. The experience makes room for that context,
              including symptoms and cycle information where you choose to
              record them.
            </p>
          </section>

          <section style={styles.sectionStyle}>
            <h2 style={styles.sectionTitleStyle}>A Connected View of Your Day</h2>
            <p style={styles.bodyStyle}>
              Your training plan, nutrition targets, check-ins, and recorded
              progress belong in the same conversation. Bringing them into view
              can make it easier to decide what to review next.
            </p>
            <p style={styles.bodyStyle}>
              The founder&apos;s Human Engineering methodology informs the
              platform&apos;s structured guidance. Personalization depends on the
              information you share and the features included in your program;
              your choices remain part of the process.
            </p>
          </section>

          <section style={styles.sectionStyle}>
            <h2 style={styles.sectionTitleStyle}>Methodology and Origin</h2>
            <p style={styles.bodyStyle}>
              Anastasis begins with a systems-first view of women&apos;s health.
              Training, nutrition, recovery, and everyday responsibilities affect
              the room a woman has for herself. The founder&apos;s approach considers
              those parts together and looks for a manageable place to begin.
            </p>
            <div style={styles.cardGridStyle}>
              {methodologyPoints.map((point) => (
                <article key={point} style={styles.cardStyle}>
                  <p style={styles.cardTextStyle}>{point}</p>
                </article>
              ))}
            </div>
          </section>

          <section style={styles.sectionStyle}>
            <h2 style={styles.sectionTitleStyle}>Inside the Anastasis System</h2>
            <div style={styles.cardGridStyle}>
              {focusAreas.map((area) => (
                <article key={area.title} style={styles.cardStyle}>
                  <h3 style={styles.cardTitleStyle}>{area.title}</h3>
                  <p style={styles.cardTextStyle}>{area.body}</p>
                </article>
              ))}
            </div>
          </section>

          <section style={styles.sectionStyle}>
            <h2 style={styles.sectionTitleStyle}>Founder / Expertise</h2>
            <p style={styles.bodyStyle}>
              Anastasis translates the founder&apos;s approach into structured
              training, nutrition, and recovery guidance. The founder&apos;s public coaching
              credentials are Certified Personal Trainer and Certified Nutrition
              Coach; these are not medical credentials. Your goals, circumstances,
              assessments, and check-ins provide context for the guidance you see.
            </p>
            <p style={styles.bodyStyle}>
              Your program&apos;s current feature list is the place to confirm
              what is included. The wider concierge vision describes where
              Anastasis is going as the platform develops.
            </p>
          </section>

          <section style={{ ...styles.cartBoxStyle, textAlign: 'center', padding: '52px 32px' }}>
            <p style={styles.eyebrowStyle}>How Anastasis Works</p>
            <h2 style={{ ...styles.sectionTitleStyle, marginBottom: '18px' }}>
              Start with the path that fits your current capacity.
            </h2>
            <p style={{ ...styles.bodyStyle, margin: '0 auto 30px' }}>
              Compare the support levels or begin with five brief Capacity Audit
              questions for a suggested program to explore.
            </p>
            <div style={{ ...styles.buttonRowStyle, justifyContent: 'center' }}>
              <Link href="/program" style={styles.primaryButtonStyle}>
                Compare support levels
              </Link>
              <Link href="/audit" style={styles.secondaryButtonStyle}>
                Take the Capacity Audit
              </Link>
            </div>
          </section>
        </div>
      </main>
    </>
  )
}
