import Button from './Button'
import * as styles from '@/app/styles/globalstyles'

export default function DashboardAssessmentMiniCard({
  dueCount,
}: {
  dueCount: number
}) {
  if (dueCount <= 0) return null

  return (
    <section
      style={{
        background: 'rgba(255,255,255,0.035)',
        borderRadius: '24px',
        padding: '20px',
        minHeight: '128px',
        boxShadow:
          '0 18px 54px rgba(0,0,0,0.16), inset 0 0 26px rgba(255,255,255,0.012)',
        backdropFilter: 'blur(16px)',
      }}
    >
      <p
        style={{
          ...styles.eyebrowStyle,
          marginBottom: '12px',
          letterSpacing: '3px',
          fontSize: '10px',
        }}
      >
        Assessments
      </p>

      <h3
        style={{
          margin: '0 0 8px',
          fontSize: '1.12rem',
          fontWeight: 500,
          letterSpacing: '-0.02em',
          color: '#f5f0e8',
        }}
      >
        Monthly Assessments
      </h3>

      <p
        style={{
          margin: '0 0 16px',
          color: 'rgba(215,199,182,0.72)',
          fontSize: '0.9rem',
          lineHeight: 1.5,
        }}
      >
        {dueCount === 1
          ? '1 assessment is ready this month.'
          : `${dueCount} assessments are ready this month.`}
      </p>

      <Button href="/dashboard/assessment/monthly">
        Open
      </Button>
    </section>
  )
}
