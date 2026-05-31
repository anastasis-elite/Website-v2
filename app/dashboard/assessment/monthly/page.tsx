import Link from 'next/link'
import * as styles from '@/app/styles/globalstyles'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'

export default async function MonthlyAssessmentsPage() {
  const { supabase, client } = await getDashboardContext()

  const program = client.program || 'ignite'

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const monthStartDate = monthStart.toISOString().split('T')[0]

  const { data: monthlyAssessment } = await supabase
    .from('assessments')
    .select('id')
    .eq('client_id', client.client_id)
    .gte('submitted_at', monthStart.toISOString())
    .limit(1)
    .maybeSingle()

  const { data: monthlyMeasurements } = await supabase
    .from('measurement_logs')
    .select('id')
    .eq('client_id', client.client_id)
    .gte('log_date', monthStartDate)
    .limit(1)
    .maybeSingle()

  const assessmentCompletedThisMonth = !!monthlyAssessment
  const measurementsCompletedThisMonth = !!monthlyMeasurements

  const dailyStructureReviewedThisMonth =
    client.daily_structure_reviewed_at
      ? new Date(client.daily_structure_reviewed_at) >= monthStart
      : false

  const assessments = [
    {
      id: 'monthly-check-in',
      title: 'Monthly Check-In',
      body:
        'Update your current body, strength, recovery, goals, and readiness so your program can stay aligned.',
      complete: assessmentCompletedThisMonth,
      href: `/dashboard/assessment/start?program=${program}`,
      buttonLabel: 'Start Check-In',
    },
    {
      id: 'daily-structure',
      title: 'Daily Structure Review',
      body:
        'Review your wake time, sleep time, work rhythm, training window, and daily flow so the dashboard reflects your real life.',
      complete: dailyStructureReviewedThisMonth,
      href: '/dashboard/assessment/daily-structure',
      buttonLabel: 'Review Structure',
    },
    {
      id: 'measurements',
      title: 'Physical Measurements',
      body:
        'Take consistent measurements with guided placement so your progress can be tracked without guessing.',
      complete: measurementsCompletedThisMonth,
      href: '/dashboard/assessment/measurements',
      buttonLabel: 'Start Measurements',
    },
  ]

  const dueAssessments = assessments.filter((assessment) => !assessment.complete)
  const completedAssessments = assessments.filter((assessment) => assessment.complete)

  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Monthly Assessments</p>

        <h1 style={styles.heroTitleStyle}>
          Keep your system aligned.
        </h1>

        <p style={styles.heroTextStyle}>
          These check-ins refresh your program for the month. Once each one is
          complete, it disappears from your monthly list until it is due again.
        </p>

        {dueAssessments.length ? (
          <section style={styles.cartBoxStyle}>
            <h2 style={styles.sectionTitleStyle}>
              Due This Month
            </h2>

            <div
              style={{
                display: 'grid',
                gap: '18px',
                marginTop: '22px',
              }}
            >
              {dueAssessments.map((assessment) => (
                <AssessmentRow
                  key={assessment.id}
                  title={assessment.title}
                  body={assessment.body}
                  href={assessment.href}
                  buttonLabel={assessment.buttonLabel}
                />
              ))}
            </div>
          </section>
        ) : (
          <section style={styles.cartBoxStyle}>
            <h2 style={styles.sectionTitleStyle}>
              All monthly assessments are complete.
            </h2>

            <p style={styles.bodyStyle}>
              Your dashboard has what it needs for this month. These will appear
              again when a new monthly assessment window opens.
            </p>
          </section>
        )}

        {completedAssessments.length ? (
          <section style={styles.cartBoxStyle}>
            <h2 style={styles.sectionTitleStyle}>
              Completed This Month
            </h2>

            <div
              style={{
                display: 'grid',
                gap: '12px',
                marginTop: '18px',
              }}
            >
              {completedAssessments.map((assessment) => (
                <p
                  key={assessment.id}
                  style={{
                    ...styles.bodyStyle,
                    margin: 0,
                    opacity: 0.78,
                  }}
                >
                  ✓ {assessment.title}
                </p>
              ))}
            </div>
          </section>
        ) : null}

        <Link href="/dashboard" style={styles.secondaryButtonStyle}>
          Back to Dashboard
        </Link>
      </div>
    </main>
  )
}

function AssessmentRow({
  title,
  body,
  href,
  buttonLabel,
}: {
  title: string
  body: string
  href: string
  buttonLabel: string
}) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.03)',
        borderRadius: '24px',
        padding: '22px',
        boxShadow: 'inset 0 0 24px rgba(255,255,255,0.012)',
      }}
    >
      <h3
        style={{
          margin: '0 0 8px',
          color: '#f5f0e8',
          fontSize: '1.18rem',
          fontWeight: 500,
        }}
      >
        {title}
      </h3>

      <p
        style={{
          ...styles.bodyStyle,
          marginBottom: '18px',
        }}
      >
        {body}
      </p>

      <Link href={href} style={styles.primaryButtonStyle}>
        {buttonLabel}
      </Link>
    </div>
  )
}
