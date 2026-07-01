import * as styles from '@/app/styles/globalstyles'
import DashboardFlowCarousel from '@/components/DashboardFlowCarousel'

type PhoenixDashboardProps = {
  client?: any
  todaysWorkout?: any
  adjustedExercises?: any[]
  output?: any
  cycleAdjustment?: {
    label: string
    note: string
  }
  phoenixTrackLabel?: string
  dailyPlan?: any
  insight?: any
}

function getFirstName(name?: string | null) {
  return name?.split(' ')[0] || 'Your'
}

export default function PhoenixDashboard({
  client,
  todaysWorkout,
  adjustedExercises,
  output,
  cycleAdjustment,
  phoenixTrackLabel,
  dailyPlan,
  insight,
}: PhoenixDashboardProps) {
  const cards = (dailyPlan?.cards || []).map((card: any) => ({
    ...card,
    body: card.id === 'morning'
      ? `Today’s directive: ${todaysWorkout ? 'complete the assigned training, then stop.' : 'recover and let adaptation happen.'}`
      : card.body,
  }))

  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Phoenix · {phoenixTrackLabel || 'Personalized'}</p>
        <h1 style={styles.heroTitleStyle}>{getFirstName(client?.full_name)}, your day is already simplified.</h1>
        <p style={styles.heroTextStyle}>Train with precision, nourish the work, and recover on purpose.</p>
        {cards.length ? (
          <DashboardFlowCarousel
            cards={cards}
            currentCardId={dailyPlan?.currentCard?.id}
            program="phoenix"
            client={client}
            insight={insight}
            todaysWorkout={todaysWorkout}
            adjustedExercises={adjustedExercises}
            output={output}
            cycleAdjustment={cycleAdjustment}
          />
        ) : null}
      </div>
    </main>
  )

}
