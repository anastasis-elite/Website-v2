'use client'

import { useEffect, useState } from 'react'
import * as styles from '@/app/styles/globalstyles'

type Row = {
  event: string
  total: number
}

export default function AOSAnalyticsLive() {
  const [rows, setRows] = useState<Row[]>([])
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

  return (
    <section style={styles.cartBoxStyle}>
      <p style={styles.eyebrowStyle}>Live Analytics</p>
      <h2 style={styles.h2Style}>Last 7 Days</h2>

      <div style={{ display: 'grid', gap: 12 }}>
        {rows.map((row) => (
          <div key={row.event} style={styles.compactCardStyle}>
            <h3 style={styles.compactCardTitleStyle}>{row.event}</h3>
            <p style={styles.compactCardTextStyle}>{row.total} events</p>
          </div>
        ))}
      </div>
    </section>
  )
}
