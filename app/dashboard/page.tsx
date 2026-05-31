import * as styles from '../styles/globalstyles'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { getNextLesson } from '@/lib/education/getNextLesson'
import { getDailyExecutionPlan } from '@/lib/day/getDailyExecutionPlan'
import { getCycleStatus } from '@/lib/cycle/getCycleStatus'
import DashboardFlowCarousel from '@/components/DashboardFlowCarousel'
import DashboardStatusDock from '@/components/DashboardStatusDock'
import SymptomQuickLog from '@/components/SymptomQuickLog'

export default async function DashboardPage() {
  const { supabase, client, user } = await getDashboardContext()

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

  const monthlyAssessmentsDueCount = [
    !assessmentCompletedThisMonth,
    !dailyStructureReviewedThisMonth,
    !measurementsCompletedThisMonth,
  ].filter(Boolean).length

  const lesson = await getNextLesson({
    supabase,
    client,
    user,
  })

  const dailyPlan = await getDailyExecutionPlan({
    supabase,
    client,
  })

  const cycleStatus = getCycleStatus(client)

  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Client Dashboard</p>

        <h1 style={styles.heroTitleStyle}>Your system for today.</h1>

        <p style={styles.heroTextStyle}>
          This is your home base for today’s execution. The system shows what
          matters now, so you do not have to hold the whole day in your head at
          once.
        </p>

        {lesson && (
          <section
            style={{
              ...styles.cartBoxStyle,
              marginBottom: '42px',
            }}
            className="dashboard-section"
          >
            <p style={styles.eyebrowStyle}>Today’s Insight</p>

            <h2 style={styles.sectionTitleStyle}>{lesson.title}</h2>

            <p style={styles.bodyStyle}>{lesson.body}</p>
          </section>
        )}

        <DashboardStatusDock
          client={client}
          cycleStatus={cycleStatus}
          dailyPlan={dailyPlan}
          assessmentDueCount={monthlyAssessmentsDueCount}
        />

        <section style={{ marginTop: '54px' }}>
          <DashboardFlowCarousel
            cards={dailyPlan.cards}
            currentCardId={dailyPlan.currentCard?.id}
          />
        </section>

        <section style={{ marginTop: '54px' }}>
          <SymptomQuickLog clientId={client.client_id} />
        </section>
      </div>
    </main>
  )
}
