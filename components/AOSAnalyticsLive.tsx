'use client'

import { useEffect, useState } from 'react'
import * as styles from '@/app/styles/globalstyles'
import type { LinkedFunnel } from '@/lib/analytics/funnel'

type Row = {
  event: string
  total: number
}

type SourceRow = {
  source: string
  total: number
}

const eventLabels: Record<string, string> = {
  landing_page_viewed: 'Landing Page Viewed',
  why_page_viewed: 'Why Page Viewed',
  program_page_viewed: 'Program Page Viewed',
  audit_page_viewed: 'Audit Page Viewed',
  audit_started: 'Audit Started',
  audit_page_completed: 'Audit Completed',
  audit_results_viewed: 'Audit Results Viewed',
  checkout_started: 'Checkout Started',
  pricing_viewed: 'Pricing Viewed',
  subscription_activated: 'Subscription Activated',
  subscription_upgraded: 'Subscription Upgraded',
  subscription_cancelled: 'Subscription Cancelled',
  onboarding_completed: 'Onboarding Saved',
  first_workout_completed: 'First Workout Completed',
  first_nutrition_completed: 'First Nutrition Saved',
  first_recovery_completed: 'First Recovery Saved',
  today_page_viewed: 'Today Viewed',
}

function percent(part: number, total: number) {
  if (!total) return 0
  return Math.round((part / total) * 100)
}

function AnalyticsCard({
  label,
  value,
  subtext,
}: {
  label: string
  value: string | number
  subtext?: string
}) {
  return (
    <div style={styles.compactCardStyle}>
      <p style={styles.eyebrowStyle}>{label}</p>
      <h3 style={styles.compactCardTitleStyle}>{value}</h3>
      {subtext ? <p style={styles.compactCardTextStyle}>{subtext}</p> : null}
    </div>
  )
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div
      style={{
        width: '100%',
        height: 8,
        borderRadius: 999,
        background: 'rgba(215,199,182,0.14)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${value}%`,
          height: '100%',
          borderRadius: 999,
          background: 'rgba(215,199,182,0.72)',
        }}
      />
    </div>
  )
}

function TrafficSources({ sources }: { sources: SourceRow[] }) {
  const totalTraffic = sources.reduce((sum, source) => sum + source.total, 0)

  if (!sources.length || !totalTraffic) return null

  return (
    <section style={styles.cartBoxStyle}>
      <p style={styles.eyebrowStyle}>Traffic Sources</p>
      <h2 style={styles.h2Style}>Where People Came From</h2>

      <div style={{ display: 'grid', gap: 12, marginTop: 24 }}>
        {sources.map((source) => {
          const sourcePercent = percent(source.total, totalTraffic)

          return (
            <div key={source.source} style={styles.compactCardStyle}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 16,
                  marginBottom: 10,
                }}
              >
                <h3 style={styles.compactCardTitleStyle}>
                  {source.source || 'direct_or_unknown'}
                </h3>

                <p style={styles.compactCardTextStyle}>
                  {sourcePercent}% · {source.total} event identities
                </p>
              </div>

              <ProgressBar value={sourcePercent} />
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default function AOSAnalyticsLive() {
  const [rows, setRows] = useState<Row[]>([])
  const [sources, setSources] = useState<SourceRow[]>([])
  const [linkedFunnels, setLinkedFunnels] = useState<LinkedFunnel[]>([])
  const [linkedQuality, setLinkedQuality] = useState({ truncated: false, ambiguousJourneys: 0 })
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function loadAnalytics() {
      try {
        const res = await fetch('/api/aos/analytics')
        const data = await res.json()

        if (!res.ok) {
          setMessage(data.error || 'Unable to load analytics.')
          return
        }

        setRows(data.rows || [])
        setSources(data.sources || [])
        setLinkedFunnels(data.linkedFunnels || [])
        setLinkedQuality(data.linkedQuality || { truncated: false, ambiguousJourneys: 0 })
      } catch {
        setMessage('Unable to load analytics.')
      } finally {
        setLoading(false)
      }
    }

    loadAnalytics()
  }, [])

  if (loading) {
    return <p style={styles.bodyStyle}>Loading live analytics...</p>
  }

  if (message) {
    return <p style={styles.bodyStyle}>{message}</p>
  }

  const acquisition = linkedFunnels.find(funnel => funnel.id === 'acquisition')?.steps || []
  const audit = linkedFunnels.find(funnel => funnel.id === 'audit')?.steps || []
  const landingViews = acquisition[0]?.total || 0
  const auditStarts = audit[0]?.total || 0
  const auditCompleted = audit[1]?.total || 0
  const resultsViewed = audit[2]?.total || 0
  const activated = acquisition[2]?.total || 0
  const rate = (value: number) => linkedQuality.truncated ? 'Limited sample' : `${value}%`

  return (
    <div style={{ display: 'grid', gap: 28 }}>
      <section style={styles.cartBoxStyle}>
        <p style={styles.eyebrowStyle}>Command Center</p>
        <h2 style={styles.h2Style}>Last 7 Days · Production</h2>
        <p style={styles.bodyStyle}>Conversion rates use ordered stages from the same linked, consented journey. The optional audit path is reported separately. Reloads do not create another conversion.</p>
        {linkedQuality.truncated ? <p role="status" style={styles.bodyStyle}>The linked-event query reached its 10,000-record limit. Counts below describe that limited sample; complete conversion rates are unavailable.</p> : null}
        {linkedQuality.ambiguousJourneys > 0 ? <p style={styles.bodyStyle}>Conflicting account links were excluded from linked funnel counts.</p> : null}

        <div
          style={{
            display: 'grid',
            gap: 14,
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            marginTop: 24,
          }}
        >
          <AnalyticsCard
            label="Funnel Started"
            value={landingViews}
            subtext="Linked landing journeys"
          />

          <AnalyticsCard
            label="Audit Started"
            value={auditStarts}
            subtext="Linked audit journeys"
          />

          <AnalyticsCard
            label="Audit Completed"
            value={auditCompleted}
            subtext={`${rate(audit[1]?.percentOfPrevious || 0)} of the same audit starts`}
          />

          <AnalyticsCard
            label="Results Viewed"
            value={resultsViewed}
            subtext={`${rate(audit[2]?.percentOfPrevious || 0)} of the same audit completions`}
          />

          <AnalyticsCard
            label="Subscription Activated"
            value={activated}
            subtext={`${rate(acquisition[2]?.percentOfPrevious || 0)} of linked checkout starts`}
          />
        </div>
      </section>

      <section style={styles.cartBoxStyle}>
        <p style={styles.eyebrowStyle}>Funnel Progress</p>
        <h2 style={styles.h2Style}>Ordered Linked Journeys</h2>

        {linkedFunnels.map(funnel => <div key={funnel.id} style={{ marginTop: 24 }}>
          <h3 style={styles.compactCardTitleStyle}>{funnel.label}</h3>
          <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
          {funnel.steps.map((row) => (
            <div key={row.label} style={styles.compactCardStyle}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 16,
                  marginBottom: 10,
                }}
              >
                <h3 style={styles.compactCardTitleStyle}>{row.label}</h3>

                <p style={styles.compactCardTextStyle}>
                  {linkedQuality.truncated ? 'Sample' : `${row.percentOfStart}%`} · {row.total} linked journeys
                </p>
              </div>

              <ProgressBar value={row.percentOfStart} />
            </div>
          ))}
          </div>
        </div>)}
      </section>

      <TrafficSources sources={sources} />

      <section style={styles.cartBoxStyle}>
        <p style={styles.eyebrowStyle}>Independent Event Totals</p>
        <h2 style={styles.h2Style}>Distinct Event Identities</h2>
        <p style={styles.bodyStyle}>These independent totals are context only. They are not used to calculate conversion rates.</p>

        <div style={{ display: 'grid', gap: 12, marginTop: 24 }}>
          {rows.map((row) => (
            <div key={row.event} style={styles.compactCardStyle}>
              <h3 style={styles.compactCardTitleStyle}>
                {eventLabels[row.event] || row.event}
              </h3>
              <p style={styles.compactCardTextStyle}>{row.total} distinct event identities</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
