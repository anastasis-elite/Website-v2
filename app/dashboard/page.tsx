import * as styles from '../styles/globalstyles'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { getNextLesson } from '@/lib/education/getNextLesson'
import { getDailyExecutionPlan } from '@/lib/day/getDailyExecutionPlan'
import DashboardCycleMiniCard from '@/components/DashboardCycleMiniCard'
import { getCycleSymptomPattern } from '@/lib/cycle/getCycleSymptomPattern'
import DashboardFlowCarousel from '@/components/DashboardFlowCarousel'
import DashboardAssessmentMiniCard from '@/components/DashboardAssessmentMiniCard'
import { getCycleStatus } from '@/lib/cycle/getCycleStatus'

function getCycleMiniCard(client: any) {
  const cycleStatus = getCycleStatus(client)

  if (!cycleStatus.enabled) {
    return {
      id: 'cycle',
      title: 'Cycle Note',
      value: 'Not active',
      body: 'Tap to add cycle awareness.',
      href: '/dashboard/cycle',
      status: 'neutral' as const,
    }
  }

  const phaseLabel =
    cycleStatus.phase === 'extended_cycle'
      ? 'Extended cycle'
      : cycleStatus.phase
      ? `${cycleStatus.phase.charAt(0).toUpperCase()}${cycleStatus.phase.slice(1)} estimate`
      : 'Awareness only'

  return {
    id: 'cycle',
    title: 'Cycle Note',
    value: `Day ${cycleStatus.cycleDay}`,
    body: `${phaseLabel} · tap to view`,
    href: '/dashboard/cycle',
    status: cycleStatus.recoveryCaution
      ? ('caution' as const)
      : ('neutral' as const),
  }
}

export default async function DashboardPage() {
  const { supabase, client, user } = await getDashboardContext()

  const program = client.program || 'ignite'

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const { data: monthlyAssessment } = await supabase
    .from('assessments')
    .select('id')
    .eq('client_id', client.client_id)
    .gte('submitted_at', monthStart.toISOString())
    .limit(1)
    .maybeSingle()

  const assessmentCompletedThisMonth = !!monthlyAssessment

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

  const dailyStructureSet =
    !!client.execution_style &&
    !!client.carousel_style &&
    (
      !!client.wake_time ||
      !!client.bed_time ||
      !!client.preferred_workout_time ||
      !!client.work_start_time ||
      !!client.lunch_window_time ||
      !!client.dinner_window_time ||
      (
        Array.isArray(client.daily_non_negotiables) &&
        client.daily_non_negotiables.length > 0
      )
    )

  const dailyStructureReviewedThisMonth =
    client.daily_structure_reviewed_at
      ? new Date(client.daily_structure_reviewed_at) >= monthStart
      : false

  const dailyStructureLabel =
    client.carousel_style === 'step'
      ? 'Step-by-step'
      : client.carousel_style === 'section'
      ? 'Daily blocks'
      : 'Daily rhythm'

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
            clientId={client.client_id}
            program={program}
            monthlyAssessmentComplete={assessmentCompletedThisMonth}
            dailyStructureSet={dailyStructureSet}
            dailyStructureReviewedThisMonth={dailyStructureReviewedThisMonth}
            dailyStructureLabel={dailyStructureLabel}
            previousReviewedAt={client.daily_structure_reviewed_at}
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
