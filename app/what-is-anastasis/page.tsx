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
    'Learn how Anastasis uses founder-led formulation, women-first physiology, adaptive fitness, nutrition, recovery, and daily support to restore capacity.',
  alternates: {
    canonical: '/what-is-anastasis',
  },
  openGraph: {
    title: 'What Is Anastasis?',
    description:
      'Anastasis combines founder-led formulation, personalized fitness, nutrition, recovery, assessments, and daily support in one adaptive system for women.',
    url: '/what-is-anastasis',
    siteName: BRAND_NAME,
  },
  twitter: {
    card: 'summary',
    title: 'What Is Anastasis? | Founder-Led Human Engineering for Women',
    description:
      'Learn how Anastasis uses founder-led formulation, women-first physiology, adaptive fitness, nutrition, recovery, and daily support to restore capacity.',
  },
}

const focusAreas = [
  {
    title: 'Fitness',
    body:
      'Training, movement, corrective needs, progression, and performance work are formulated around the woman using the system, not treated as a generic calendar of tasks.',
  },
  {
    title: 'Nutrition',
    body:
      'Nutrition support includes targets, food logging, nutrient awareness, suggested foods, and adaptive recommendations built to reduce daily guesswork while respecting physiology and life demand.',
  },
  {
    title: 'Recovery',
    body:
      'Recovery guidance is interpreted alongside workload, training demand, symptoms, sleep, cycle context where provided, and daily state so rest is part of the system rather than an afterthought.',
  },
  {
    title: 'Progress and Assessments',
    body:
      'Progress tracking, trends, body and posture assessments where applicable, and repeated check-ins help the system adapt as the woman changes through different seasons of life.',
  },
  {
    title: 'Daily Support',
    body:
      'Anastasis helps identify what matters next instead of handing the user disconnected data or a raw AI output she still has to interpret alone.',
  },
]

const methodologyPoints = [
  'Assessment inputs clarify current capacity, goals, recovery, training history, nutrition, symptoms, schedule, and constraints.',
  'Founder-led formulation turns those inputs into program logic before automation or AI-assisted features are allowed to support the experience.',
  'Daily check-ins and progress signals keep the system responsive as physiology, stress load, recovery, and available capacity change.',
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
          'Anastasis is a founder-led health and performance concierge platform for women built from Adaptive Human Engineering, women-first physiology, and formulation-driven programming.',
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
          'A systems-based methodology for restoring capacity by connecting fitness, nutrition, recovery, education, physiology, environment, and daily decision support.',
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
          'The Anastasis methodology starts with founder-led formulation, then uses technology and AI-assisted support to help deliver and adapt the system.',
      },
      {
        '@type': 'Person',
        '@id': absoluteUrl('/what-is-anastasis#founder'),
        name: 'Anastasis founder',
        affiliation: {
          '@id': absoluteUrl('/#organization'),
        },
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
              Anastasis is a founder-led health and performance concierge platform for women.
            </p>
            <p style={{ ...styles.heroTextStyle, margin: '0 auto', color: '#d7c7b6' }}>
              It is built through formulation first: the founder&apos;s Human Engineering
              methodology shapes the system, and technology supports the delivery.
            </p>
          </section>

          <section style={styles.sectionStyle}>
            <h2 style={styles.sectionTitleStyle}>What Anastasis Does</h2>
            <p style={styles.bodyStyle}>
              Anastasis brings fitness, nutrition, recovery, assessments,
              progress tracking, and daily support together rather than treating
              them as isolated systems. The goal is to turn the moving parts of
              health and performance into one adaptive structure that restores
              capacity instead of asking a woman to force consistency through
              overload.
            </p>
          </section>

          <section style={styles.sectionStyle}>
            <h2 style={styles.sectionTitleStyle}>Who Anastasis Is For</h2>
            <p style={styles.bodyStyle}>
              Anastasis is built for women whose health, family, work,
              performance, responsibilities, recovery, and daily decisions all
              affect one another. It is designed for real life, not the idea of a
              life with unlimited time, energy, and bandwidth. Women&apos;s bodies are
              not treated as smaller versions of a male default; the system is
              designed around capacity, stress load, recovery, hormonal context
              where provided, and the physiology of a woman living a full life.
            </p>
          </section>

          <section style={styles.sectionStyle}>
            <h2 style={styles.sectionTitleStyle}>Why Anastasis Is Different</h2>
            <p style={styles.bodyStyle}>
              Anastasis is designed to reduce the amount of health-related
              planning, tracking, adapting, and remembering a woman has to manage
              herself. Instead of giving her more disconnected information, the
              platform helps clarify the next useful action.
            </p>
            <p style={styles.bodyStyle}>
              Anastasis is not positioned as an AI wellness app. AI-assisted
              features may support interpretation and delivery, but the center of
              the product is founder-led formulation: a methodology that defines
              how inputs are understood, how priorities are ordered, and how the
              system adapts over time.
            </p>
          </section>

          <section style={styles.sectionStyle}>
            <h2 style={styles.sectionTitleStyle}>Methodology and Origin</h2>
            <p style={styles.bodyStyle}>
              Anastasis comes from a systems-first view of women&apos;s health: when
              a woman is exhausted, inflamed, under-recovered, under-fueled,
              overloaded, or disconnected from her body, another rigid plan is
              not enough. The origin of the platform is the belief that the
              environment, workload, physiology, nutrition, recovery, and daily
              decisions have to be engineered together.
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
              Anastasis is the system behind years of individualized coaching,
              translated into structured, repeatable formulations that can scale
              beyond one-on-one support. Its training, nutrition, recovery, and
              assessment decisions are governed by Anastasis formulation logic,
              not open-ended AI guesses.
            </p>
            <p style={styles.bodyStyle}>
              The methodology was intentionally developed around women&apos;s
              physiology, recovery, hormonal context where provided, real-life
              workload, and performance demands. AI may support conversational
              and accountability experiences where appropriate, but it does not
              replace the core Anastasis formulation engine.
            </p>
          </section>

          <section style={{ ...styles.cartBoxStyle, textAlign: 'center', padding: '52px 32px' }}>
            <p style={styles.eyebrowStyle}>How Anastasis Works</p>
            <h2 style={{ ...styles.sectionTitleStyle, marginBottom: '18px' }}>
              Start with the path that fits your current capacity.
            </h2>
            <p style={{ ...styles.bodyStyle, margin: '0 auto 30px' }}>
              Explore the Anastasis programs or begin with the Capacity Audit to
              see which level of support matches your current season.
            </p>
            <div style={{ ...styles.buttonRowStyle, justifyContent: 'center' }}>
              <Link href="/program" style={styles.primaryButtonStyle}>
                Explore Anastasis Programs
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
