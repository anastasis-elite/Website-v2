import * as styles from '@/app/styles/globalstyles'
import DashboardFlowCarousel from '@/components/DashboardFlowCarousel'
import DashboardStatusDock from '@/components/DashboardStatusDock'

type Props = {
  client: any; dailyPlan?: any; cycleStatus?: any; assessmentDueCount?: number
  monthlyCheckInDue?: boolean
  adaptiveDashboard?: any; insight?: any; todaysWorkout?: any
  adjustedExercises?: any[]; output?: any
  cycleAdjustment?: { label: string; note: string }
}

export default function IgniteDashboard(props: Props) {
  const { client, dailyPlan, cycleStatus } = props

  return (
    <>
      {dailyPlan && cycleStatus ? (
        <DashboardStatusDock client={client} cycleStatus={cycleStatus} dailyPlan={dailyPlan} assessmentDueCount={props.monthlyCheckInDue ? 1 : 0} monthlyCheckInDue={props.monthlyCheckInDue} />
      ) : null}
      <section style={{ marginTop: '36px', marginBottom: '42px' }} className="dashboard-section">
        <p style={styles.eyebrowStyle}>Ignite Dashboard</p>
        <h1 style={styles.heroTitleStyle}>Your day, in three clear parts.</h1>
        <p style={styles.heroTextStyle}>Follow the current card. Everything else can wait until its window.</p>
      </section>
      {dailyPlan?.cards?.length ? (
        <DashboardFlowCarousel
          cards={client.carousel_style === 'step' && dailyPlan.currentCard ? [dailyPlan.currentCard] : dailyPlan.cards}
          currentCardId={dailyPlan.currentCard?.id}
          program="ignite"
          client={client}
          insight={props.insight}
          todaysWorkout={props.todaysWorkout}
          adjustedExercises={props.adjustedExercises}
          output={props.output}
          cycleAdjustment={props.cycleAdjustment}
        />
      ) : null}
    </>
  )
}
