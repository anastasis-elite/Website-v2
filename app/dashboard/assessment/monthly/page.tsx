import Link from 'next/link'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { getMonthlyAssessmentStatus } from '@/lib/assessment/getMonthlyAssessmentStatus'
import { AOSCard } from '@/components/aos-ui/AOSCard'

export default async function MonthlyAssessmentsPage() {
  const { supabase, client } = await getDashboardContext()

  const program = client.program || 'ignite'
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const monthStartDate = monthStart.toISOString().split('T')[0]

  const monthlyAssessment = await getMonthlyAssessmentStatus(supabase, client.client_id)

  const { data: monthlyMeasurements } = await supabase
    .from('measurement_logs')
    .select('id')
    .eq('client_id', client.client_id)
    .gte('log_date', monthStartDate)
    .limit(1)
    .maybeSingle()

  const assessmentCompletedThisMonth = !monthlyAssessment.due
  const measurementsCompletedThisMonth = !!monthlyMeasurements
  const dailyStructureReviewedThisMonth = client.daily_structure_reviewed_at
    ? new Date(client.daily_structure_reviewed_at) >= monthStart
    : false

  const assessments = [
    {
      id: 'monthly-check-in',
      title: 'Monthly Check-In',
      body: 'Update current body, strength, recovery, goals, and readiness so your program can stay aligned.',
      complete: assessmentCompletedThisMonth,
      href: `/dashboard/assessment/start?program=${program}&assessmentType=monthly`,
      buttonLabel: 'Start Check-In',
    },
    {
      id: 'daily-structure',
      title: 'Daily Structure Review',
      body: 'Review wake time, sleep time, work rhythm, training windows, and daily flow.',
      complete: dailyStructureReviewedThisMonth,
      href: '/dashboard/assessment/daily-structure',
      buttonLabel: 'Review Structure',
    },
    {
      id: 'measurements',
      title: 'Physical Measurements',
      body: 'Take consistent measurements so progress can be tracked without guessing.',
      complete: measurementsCompletedThisMonth,
      href: '/dashboard/assessment/measurements',
      buttonLabel: 'Start Measurements',
    },
  ]

  const dueAssessments = assessments.filter((assessment) => !assessment.complete)
  const completedAssessments = assessments.filter((assessment) => assessment.complete)

  return (
    <main className="aos-flow-page">
      <div className="aos-flow-shell">
        <header className="aos-flow-hero">
          <p className="aos-eyebrow">Monthly Assessments</p>
          <h1>Keep your system aligned.</h1>
          <p>
            These check-ins refresh your program for the month. Completed items
            stay out of the required flow until they are due again.
          </p>
        </header>

        <section className="aos-assessment-grid">
          <AOSCard className="aos-assessment-summary">
            <p className="aos-eyebrow">Due now</p>
            <h2>{dueAssessments.length}</h2>
            <p>
              {dueAssessments.length
                ? 'Complete only what is due. Daily check-ins remain separate.'
                : 'All monthly assessment items are complete for this cycle.'}
            </p>
          </AOSCard>

          <AOSCard className="aos-assessment-summary">
            <p className="aos-eyebrow">Completed</p>
            <h2>{completedAssessments.length}</h2>
            <p>These are already counted for the current monthly window.</p>
          </AOSCard>
        </section>

        <section className="aos-card aos-assessment-panel">
          <div className="aos-section-header">
            <div>
              <p className="aos-eyebrow">Required this month</p>
              <h2>{dueAssessments.length ? 'Due This Month' : 'Nothing due right now'}</h2>
            </div>
            <Link href="/dashboard" className="aos-secondary-link">
              Dashboard
            </Link>
          </div>

          {dueAssessments.length ? (
            <div className="aos-assessment-list">
              {dueAssessments.map((assessment) => (
                <AssessmentRow key={assessment.id} {...assessment} />
              ))}
            </div>
          ) : (
            <p className="aos-muted-copy">
              Your dashboard has what it needs for this month.
            </p>
          )}
        </section>

        {completedAssessments.length ? (
          <section className="aos-card aos-assessment-panel">
            <div className="aos-section-header">
              <div>
                <p className="aos-eyebrow">Logged</p>
                <h2>Completed This Month</h2>
              </div>
            </div>
            <div className="aos-completed-list">
              {completedAssessments.map((assessment) => (
                <p key={assessment.id}>✓ {assessment.title}</p>
              ))}
            </div>
          </section>
        ) : null}
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
    <article className="aos-assessment-row">
      <div>
        <h3>{title}</h3>
        <p>{body}</p>
      </div>
      <Link href={href} className="aos-primary-link">
        {buttonLabel}
      </Link>
    </article>
  )
}
