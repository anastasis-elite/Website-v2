import * as styles from '../styles/globalstyles'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { getNextLesson } from '@/lib/education/getNextLesson'
import { getDailyExecutionPlan } from '@/lib/day/getDailyExecutionPlan'
import DashboardMiniCards from '@/components/DashboardMiniCards'
import DashboardFlowCarousel from '@/components/DashboardFlowCarousel'
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

  const miniCards = [
    getCycleMiniCard(client),

    assessmentCompletedThisMonth
      ? {
          id: 'assessment',
          title: 'Assessment',
          value: 'Complete',
          body: 'Your monthly assessment is complete.',
          href: '/dashboard',
          status: 'complete' as const,
        }
      : {
          id: 'assessment',
          title: 'Assessment',
          value: 'Due',
          body: 'Complete this month’s check-in.',
          href: `/dashboard/assessment/start?program=${program}`,
          status: 'attention' as const,
        },
  ]

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

        <DashboardMiniCards cards={miniCards} />

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
