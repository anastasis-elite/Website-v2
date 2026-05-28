import * as styles from '../styles/globalstyles'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { getNextLesson } from '@/lib/education/getNextLesson'
import { getDailyExecutionPlan } from '@/lib/day/getDailyExecutionPlan'
import DashboardCycleMiniCard from '@/components/DashboardCycleMiniCard'
import { getCycleSymptomPattern } from '@/lib/cycle/getCycleSymptomPattern'
import DashboardFlowCarousel from '@/components/DashboardFlowCarousel'
import DashboardAssessmentMiniCard from '@/components/DashboardAssessmentMiniCard'
import { getCycleStatus } from '@/lib/cycle/getCycleStatus'
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

  const assessmentCompletedThisMonth = !!monthlyAssessment

  const { data: monthlyMeasurements } = await supabase
    .from('measurement_logs')
    .select('id')
    .eq('client_id', client.client_id)
    .gte('log_date', monthStartDate)
    .limit(1)
    .maybeSingle()

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

  const today = new Date().toISOString().split('T')[0]

  const { data: todayCycleLog } = await supabase
    .from('cycle_logs')
    .select('*')
    .eq('client_id', client.client_id)
    .eq('log_date', today)
    .maybeSingle()

  const { data: recentCycleLogs } = await supabase
    .from('cycle_logs')
    .select('*')
    .eq('client_id', client.client_id)
    .not('symptoms', 'is', null)
    .order('log_date', { ascending: false })
    .limit(180)

  const symptomPredictions = getCycleSymptomPattern({
    logs: recentCycleLogs || [],
    cycleDay: cycleStatus.cycleDay,
    phase: cycleStatus.phase,
  })

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

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '14px',
            marginBottom: '36px',
          }}
        >
          <DashboardCycleMiniCard
            clientId={client.client_id}
            cycleStatus={cycleStatus}
            symptomPredictions={symptomPredictions}
            todayCycleLog={todayCycleLog}
          />

          <DashboardAssessmentMiniCard
            dueCount={monthlyAssessmentsDueCount}
          />
          
          <SymptomQuickLog 
            clientId={client.client_id} 
          />
        </div>

        {lesson ? (
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
        ) : null}

        <DashboardFlowCarousel
          cards={dailyPlan.cards}
          currentCardId={dailyPlan.currentCard?.id}
        />
      </div>
    </main>
  )
}
