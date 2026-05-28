import * as styles from '../styles/globalstyles'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { getNextLesson } from '@/lib/education/getNextLesson'
import { getDailyExecutionPlan } from '@/lib/day/getDailyExecutionPlan'
import { getCycleStatus } from '@/lib/cycle/getCycleStatus'
import DashboardFlowCarousel from '@/components/DashboardFlowCarousel'
import DashboardStatusDock from '@/components/DashboardStatusDock'

export default async function DashboardPage() {
  const { supabase, client, user } = await getDashboardContext()

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
        <DashboardStatusDock
  client={client}
  cycleStatus={cycleStatus}
  dailyPlan={dailyPlan}
  assessmentDueCount={monthlyAssessmentsDueCount}
/>
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
          />
        
      <section style={{ marginTop: '54px' }}>
  <DashboardFlowCarousel
    cards={dailyPlan.cards}
    currentCardId={dailyPlan.currentCard?.id}
  />
</section>
      </div>
    </main>
  )
}
