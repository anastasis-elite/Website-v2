import * as styles from '../styles/globalstyles'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { getNextLesson } from '@/lib/education/getNextLesson'
import { getDailyExecutionPlan } from '@/lib/day/getDailyExecutionPlan'
import DashboardMiniCards from '@/components/DashboardMiniCards'
import DashboardFlowCarousel from '@/components/DashboardFlowCarousel'

function getCycleMiniCard(client: any) {
  if (!client.cycle_tracking_enabled || !client.last_period_start) {
    return {
      id: 'cycle',
      title: 'Cycle Note',
      value: 'Not active',
      body: 'Cycle tracking can be added when ready.',
      href: '/dashboard/cycle',
      status: 'neutral' as const,
    }
  }

  const today = new Date()
  const lastStart = new Date(client.last_period_start)
  const msPerDay = 1000 * 60 * 60 * 24

  const daysSinceStart =
    Math.floor((today.getTime() - lastStart.getTime()) / msPerDay) + 1

  const cycleLength = Number(client.average_cycle_length || 28)

  const cycleDay = ((daysSinceStart - 1) % cycleLength) + 1

  let phase = 'Follicular'

  if (cycleDay <= 5) {
    phase = 'Menstrual'
  } else if (cycleDay <= 13) {
    phase = 'Follicular'
  } else if (cycleDay <= 16) {
    phase = 'Ovulatory'
  } else {
    phase = 'Luteal'
  }

  return {
    id: 'cycle',
    title: 'Cycle Note',
    value: `Day ${cycleDay}`,
    body: `${phase} estimate · awareness only`,
    href: '/dashboard/cycle',
    status:
      phase === 'Menstrual' || phase === 'Luteal'
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
