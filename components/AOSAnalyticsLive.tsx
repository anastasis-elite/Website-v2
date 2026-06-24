'use client'

import { useEffect, useState } from 'react'
import * as styles from '@/app/styles/globalstyles'

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
  audit_submit_clicked: 'Audit Submit Clicked',
  audit_page_completed: 'Audit Completed',
  audit_results_viewed: 'Audit Results Viewed',
  checkout_started: 'Checkout Started',
  checkout_completed: 'Checkout Completed',
}

function getTotal(rows: Row[], event: string) {
  return rows.find((row) => row.event === event)?.total || 0
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
                  {sourcePercent}% · {source.total} visits
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

  const landingViews = getTotal(rows, 'landing_page_viewed')
  const auditViews = getTotal(rows, 'audit_page_viewed')
  const auditSubmits = getTotal(rows, 'audit_submit_clicked')
  const auditCompleted = getTotal(rows, 'audit_page_completed')
  const resultsViewed = getTotal(rows, 'audit_results_viewed')
  const checkoutStarted = getTotal(rows, 'checkout_started')
  const checkoutCompleted = getTotal(rows, 'checkout_completed')

  const auditCompletionRate = percent(auditCompleted, auditViews)
  const resultsReachRate = percent(resultsViewed, auditCompleted)
  const checkoutConversionRate = percent(checkoutCompleted, checkoutStarted)

  const funnelRows = [
    {
      label: 'Landing Page Viewed',
      total: landingViews,
      percentOfStart: 100,
    },
    {
      label: 'Audit Page Viewed',
      total: auditViews,
      percentOfStart: percent(auditViews, landingViews),
    },
    {
      label: 'Audit Submit Clicked',
      total: auditSubmits,
      percentOfStart: percent(auditSubmits, landingViews),
    },
    {
      label: 'Audit Completed',
      total: auditCompleted,
      percentOfStart: percent(auditCompleted, landingViews),
    },
    {
      label: 'Results Viewed',
      total: resultsViewed,
      percentOfStart: percent(resultsViewed, landingViews),
    },
    {
      label: 'Checkout Started',
      total: checkoutStarted,
      percentOfStart: percent(checkoutStarted, landingViews),
    },
    {
      label: 'Checkout Completed',
      total: checkoutCompleted,
      percentOfStart: percent(checkoutCompleted, landingViews),
    },
  ]

  return (
    <div style={{ display: 'grid', gap: 28 }}>
      <section style={styles.cartBoxStyle}>
        <p style={styles.eyebrowStyle}>Command Center</p>
        <h2 style={styles.h2Style}>Last 7 Days</h2>

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
            subtext="Landing page views"
          />

          <AnalyticsCard
            label="Audit Started"
            value={auditViews}
            subtext={`${percent(auditViews, landingViews)}% of landing traffic`}
          />

          <AnalyticsCard
            label="Audit Completed"
            value={auditCompleted}
            subtext={`${auditCompletionRate}% of audit starts`}
          />

          <AnalyticsCard
            label="Results Viewed"
            value={resultsViewed}
            subtext={`${resultsReachRate}% of audit completions`}
          />

          <AnalyticsCard
            label="Checkout Completed"
            value={checkoutCompleted}
            subtext={`${checkoutConversionRate}% of checkout starts`}
          />
        </div>
      </section>

      <section style={styles.cartBoxStyle}>
        <p style={styles.eyebrowStyle}>Funnel Progress</p>
        <h2 style={styles.h2Style}>Where People Are Dropping</h2>

        <div style={{ display: 'grid', gap: 12, marginTop: 24 }}>
          {funnelRows.map((row) => (
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
                  {row.percentOfStart}% · {row.total} people
                </p>
              </div>

              <ProgressBar value={row.percentOfStart} />
            </div>
          ))}
        </div>
      </section>

      <TrafficSources sources={sources} />

      <section style={styles.cartBoxStyle}>
        <p style={styles.eyebrowStyle}>Raw Events</p>
        <h2 style={styles.h2Style}>Tracked Event Counts</h2>

        <div style={{ display: 'grid', gap: 12, marginTop: 24 }}>
          {rows.map((row) => (
            <div key={row.event} style={styles.compactCardStyle}>
              <h3 style={styles.compactCardTitleStyle}>
                {eventLabels[row.event] || row.event}
              </h3>
              <p style={styles.compactCardTextStyle}>{row.total} events</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
