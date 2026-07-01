import * as styles from '@/app/styles/globalstyles'

type DailyInsight = {
  observation?: string
  meaning?: string
  identityShift?: string
  beliefChallenge?: string
  nextStep?: string
}

type Props = {
  insight: DailyInsight
  compact?: boolean
}

export default function DailyInsightCard({ insight, compact = false }: Props) {
  const rows = [
    { label: 'Observation', value: insight.observation },
    { label: 'Meaning', value: insight.meaning },
    { label: 'Identity Shift', value: insight.identityShift },
    { label: 'Belief Challenge', value: insight.beliefChallenge },
    { label: 'Next Step', value: insight.nextStep },
  ].filter((row) => row.value)

  if (!rows.length) return null

  if (compact) {
    return (
      <aside style={compactCardStyle}>
        <p style={{ ...styles.eyebrowStyle, margin: 0 }}>Daily Insight</p>
        <div style={{ display: 'grid', gap: '8px' }}>
          {rows.map((row) => (
            <p key={row.label} style={{ ...styles.bodyStyle, margin: 0, fontSize: '0.92rem' }}>
              {row.value}
            </p>
          ))}
        </div>
      </aside>
    )
  }

  return (
    <section style={styles.cartBoxStyle} className="dashboard-section">
      <p style={styles.eyebrowStyle}>Daily Insight</p>

      <h2 style={styles.sectionTitleStyle}>
        Read the signal, then take the next step.
      </h2>

      <div style={{ display: 'grid', gap: '16px' }}>
        {rows.map((row) => (
          <div key={row.label} style={styles.innerCardStyle}>
            <p
              style={{
                ...styles.eyebrowStyle,
                marginBottom: '8px',
                fontSize: '10px',
              }}
            >
              {row.label}
            </p>

            <p style={{ ...styles.bodyStyle, margin: 0 }}>{row.value}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

const compactCardStyle = {
  display: 'grid',
  gap: '12px',
  padding: '18px 20px',
  marginBottom: '24px',
  borderRadius: '22px',
  background: 'rgba(181,110,67,0.07)',
  border: '1px solid rgba(181,110,67,0.18)',
} as const
