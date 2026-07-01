'use client'

import { useEffect, useState } from 'react'
import * as styles from '@/app/styles/globalstyles'

export default function AOSRevenueLive() {
  const [report, setReport] = useState<any>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/aos/revenue', { cache: 'no-store' }).then(async (response) => {
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Revenue report failed.')
      setReport(data.report)
    }).catch((reason) => setError(reason.message))
  }, [])

  if (error) return <p style={styles.bodyStyle}>{error}</p>
  if (!report) return <p style={styles.bodyStyle}>Loading Stripe revenue…</p>

  return (
    <>
      <section style={styles.cartBoxStyle}>
        <p style={styles.eyebrowStyle}>All-Time Clients</p>
        <div style={styles.cardGridStyle}>
          {['total', 'ember', 'ignite', 'phoenix'].map((key) => <Metric key={key} label={key} value={report.allTime.clients[key]} />)}
        </div>
      </section>

      {Object.entries(report.periods).map(([period, value]: any) => (
        <section key={period} style={styles.cartBoxStyle}>
          <p style={styles.eyebrowStyle}>{period}</p>
          <div style={styles.cardGridStyle}>
            <Metric label="Revenue" value={money(value.current.revenue)} change={value.change.revenuePercent} />
            <Metric label="Stripe Net" value={money(value.current.stripeNet)} />
            <Metric label="Nutritionist" value={money(value.current.nutritionistCommission)} />
            <Metric label="Operating Costs" value={money(value.current.operatingCosts)} />
            <Metric label="Profit" value={money(value.current.profit)} change={value.change.profitPercent} />
            <Metric label="New Clients" value={value.current.clients.total} change={value.change.clientsPercent} />
          </div>
          <div style={{ ...styles.cardGridStyle, marginTop: '18px' }}>
            {['ember', 'ignite', 'phoenix'].map((program) => <Metric key={program} label={`${program} clients`} value={value.current.clients[program]} change={value.change.clientsByProgram[program]} />)}
          </div>
        </section>
      ))}

      <section style={styles.cartBoxStyle}>
        <p style={styles.eyebrowStyle}>Nutritionist Referral</p>
        <h2 style={styles.sectionTitleStyle}>Share /nutritionist</h2>
        <p style={styles.bodyStyle}>Standard Phoenix commission: 5%. Referred Phoenix commission: 12.5%.</p>
      </section>

      {report.warnings.map((warning: string) => <p key={warning} style={styles.bodyStyle}>{warning}</p>)}
    </>
  )
}

function Metric({ label, value, change }: { label: string; value: string | number; change?: number | null }) {
  return <div style={styles.compactCardStyle}><p style={styles.eyebrowStyle}>{label}</p><h3 style={styles.cardTitleStyle}>{value}</h3>{change === null ? <p style={styles.cardTextStyle}>No prior baseline</p> : typeof change === 'number' ? <p style={{ ...styles.cardTextStyle, color: change >= 0 ? '#9fc6a4' : '#d89b9b' }}>{change >= 0 ? '+' : ''}{change.toFixed(1)}%</p> : null}</div>
}

function money(cents: number) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents || 0) / 100) }
