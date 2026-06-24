import Link from 'next/link'
import * as styles from '@/app/styles/globalstyles'
import AOSAnalyticsLive from '@/components/AOSAnalyticsLive'

export default function AOSAnalyticsPage() {
  const funnelSteps = [
    {
      step: 'Homepage Viewed',
      event: 'page_view:/',
      status: 'Needs tracking',
    },
    {
      step: 'Audit Started',
      event: 'audit_started',
      status: 'Needs tracking',
    },
    {
      step: 'Audit Completed',
      event: 'audit_completed',
      status: 'Partially active',
    },
    {
      step: 'Results Viewed',
      event: 'audit_results_viewed',
      status: 'Needs tracking',
    },
    {
      step: 'Program Viewed',
      event: 'program_viewed',
      status: 'Needs tracking',
    },
    {
      step: 'Checkout Started',
      event: 'checkout_started',
      status: 'Needs tracking',
    },
    {
      step: 'Checkout Completed',
      event: 'checkout_completed',
      status: 'Needs Stripe webhook tracking',
    },
    {
      step: 'Login Created',
      event: 'login_created',
      status: 'Needs tracking',
    },
    {
      step: 'Onboarding Completed',
      event: 'onboarding_completed',
      status: 'Needs tracking',
    },
    {
      step: 'Dashboard Opened',
      event: 'dashboard_viewed',
      status: 'Needs tracking',
    },
  ]

  const sourceLinks = [
    {
      source: 'TikTok',
      url: '/audit?source=tiktok',
      purpose: 'Primary short-form content traffic.',
    },
    {
      source: 'Instagram',
      url: '/audit?source=instagram',
      purpose: 'Reels, bio, stories, and profile traffic.',
    },
    {
      source: 'YouTube',
      url: '/audit?source=youtube',
      purpose: 'Long-form and podcast-style content traffic.',
    },
    {
      source: 'Substack',
      url: '/audit?source=substack',
      purpose: 'Long-form written funnel traffic.',
    },
  ]

  return (
    <>
      <section style={styles.cartBoxStyle}>
        <p style={styles.eyebrowStyle}>Analytics Command</p>

        <h2 style={styles.h2Style}>Funnel Visibility</h2>

        <p style={styles.bodyStyle}>
          This page will become the central place to understand where women
          enter the Anastasis funnel, what they view, where they drop off, and
          which paths convert into clients.
        </p>
      </section>
<AOSAnalyticsLive />
      <section style={styles.cartBoxStyle}>
        <p style={styles.eyebrowStyle}>Business Questions</p>

        <div style={styles.cardGridStyle}>
          {[
            'Where are people entering the site?',
            'Which social source sends the most qualified traffic?',
            'Where does the audit funnel break?',
            'Which program page converts best?',
            'How many users reach checkout?',
            'How many purchasers complete onboarding?',
          ].map((question) => (
            <div key={question} style={styles.cardStyle}>
              <p style={styles.cardTextStyle}>{question}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={styles.cartBoxStyle}>
        <p style={styles.eyebrowStyle}>Core Funnel Events</p>

        <div style={{ display: 'grid', gap: '12px' }}>
          {funnelSteps.map((item) => (
            <div key={item.event} style={styles.compactCardStyle}>
              <h3 style={styles.compactCardTitleStyle}>{item.step}</h3>

              <p style={styles.compactCardTextStyle}>
                Event: {item.event}
                <br />
                Status: {item.status}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section style={styles.cartBoxStyle}>
        <p style={styles.eyebrowStyle}>Social Source Links</p>

        <p style={styles.bodyStyle}>
          Use these source-specific links in social bios, captions, and stories
          so AOS can eventually separate TikTok, Instagram, YouTube, and written
          traffic.
        </p>

        <div style={{ display: 'grid', gap: '12px', marginTop: '24px' }}>
          {sourceLinks.map((item) => (
            <div key={item.source} style={styles.compactCardStyle}>
              <h3 style={styles.compactCardTitleStyle}>{item.source}</h3>

              <p style={styles.compactCardTextStyle}>
                Link: {item.url}
                <br />
                {item.purpose}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section style={styles.cartBoxStyle}>
        <p style={styles.eyebrowStyle}>PostHog Setup</p>

        <h2 style={styles.h2Style}>Recommended Analytics Layer</h2>

        <p style={styles.bodyStyle}>
          PostHog should be used to track page views, funnel events, session
          recordings, attribution, and drop-off behavior. Once installed, this
          page can link directly to the most important dashboards.
        </p>

        <div style={styles.buttonRowStyle}>
          <Link href="/aos" style={styles.secondaryButtonStyle}>
            Command Center
          </Link>

          <a
            href="https://posthog.com"
            target="_blank"
            rel="noreferrer"
            style={styles.primaryButtonStyle}
          >
            Open PostHog
          </a>
        </div>
      </section>
    </>
  )
}
