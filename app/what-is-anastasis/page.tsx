import type { Metadata } from 'next'
import Link from 'next/link'
import TrackEvent from '@/components/TrackEvent'
import * as styles from '../styles/globalstyles'
import { BRAND_DESCRIPTION, BRAND_DESCRIPTOR, BRAND_NAME, absoluteUrl } from '@/lib/seo'

export const metadata: Metadata = {
  title: {
    absolute: 'What Is Anastasis? | Health & Performance Concierge Platform for Women',
  },
  description:
    'Learn how Anastasis combines personalized fitness, nutrition, recovery, progress tracking, and daily support into one health and performance concierge platform for women.',
  alternates: {
    canonical: '/what-is-anastasis',
  },
  openGraph: {
    title: 'What Is Anastasis?',
    description:
      'Anastasis combines personalized fitness, nutrition, recovery, progress tracking, assessments, and daily support in one adaptive system for women.',
    url: '/what-is-anastasis',
    siteName: BRAND_NAME,
  },
  twitter: {
    card: 'summary',
    title: 'What Is Anastasis? | Health & Performance Concierge Platform for Women',
    description:
      'Learn how Anastasis combines personalized fitness, nutrition, recovery, progress tracking, and daily support into one health and performance concierge platform for women.',
  },
}

const focusAreas = [
  {
    title: 'Fitness',
    body:
      'Personalized workouts, movement, performance work, corrective needs, and progression are connected to the woman using the system, not treated as a generic calendar of tasks.',
  },
  {
    title: 'Nutrition',
    body:
      'Nutrition support includes targets, food logging, nutrient awareness, suggested foods, and adaptive recommendations that help reduce daily guesswork.',
  },
  {
    title: 'Recovery',
    body:
      'Recovery guidance is interpreted alongside workload, training demand, symptoms, sleep, and daily state so rest is part of the system rather than an afterthought.',
  },
  {
    title: 'Progress and Assessments',
    body:
      'Progress tracking, trends, body and posture assessments where applicable, and repeated check-ins help the system adapt as the woman changes.',
  },
  {
    title: 'Daily Support',
    body:
      'Anastasis helps identify what matters next instead of handing the user disconnected data she still has to interpret alone.',
  },
]

export default function WhatIsAnastasisPage() {
  const pageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    '@id': absoluteUrl('/what-is-anastasis#webpage'),
    name: 'What Is Anastasis?',
    url: absoluteUrl('/what-is-anastasis'),
    description: BRAND_DESCRIPTION,
    about: {
      '@id': absoluteUrl('/#application'),
    },
    isPartOf: {
      '@id': absoluteUrl('/#website'),
    },
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
              Anastasis is a health and performance concierge platform for women.
            </p>
            <p style={{ ...styles.heroTextStyle, margin: '0 auto', color: '#d7c7b6' }}>
              {BRAND_DESCRIPTION}
            </p>
          </section>

          <section style={styles.sectionStyle}>
            <h2 style={styles.sectionTitleStyle}>What Anastasis Does</h2>
            <p style={styles.bodyStyle}>
              Anastasis brings fitness, nutrition, recovery, assessments,
              progress tracking, and daily support together rather than treating
              them as isolated systems. The goal is to turn the moving parts of
              health and performance into one adaptive structure.
            </p>
          </section>

          <section style={styles.sectionStyle}>
            <h2 style={styles.sectionTitleStyle}>Who Anastasis Is For</h2>
            <p style={styles.bodyStyle}>
              Anastasis is built for women whose health, family, work,
              performance, responsibilities, recovery, and daily decisions all
              affect one another. It is designed for real life, not the idea of a
              life with unlimited time, energy, and bandwidth.
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
              Anastasis is built from a systems-first view of women&apos;s health
              and performance. The public site currently does not store a
              verified founder name or credential set in a way that can be used
              safely for search schema, so this page avoids inventing credentials
              and keeps the expertise statement general.
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
