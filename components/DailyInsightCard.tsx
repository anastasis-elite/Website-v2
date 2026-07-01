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
}

export default function DailyInsightCard({ insight }: Props) {
  const rows = [
    { label: 'Observation', value: insight.observation },
    { label: 'Meaning', value: insight.meaning },
    { label: 'Identity Shift', value: insight.identityShift },
    { label: 'Belief Challenge', value: insight.beliefChallenge },
    { label: 'Next Step', value: insight.nextStep },
  ].filter((row) => row.value)

  if (!rows.length) return null

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
