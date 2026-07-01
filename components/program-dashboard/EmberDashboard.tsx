import * as styles from '@/app/styles/globalstyles'
import DashboardFlowCarousel from '@/components/DashboardFlowCarousel'

type Props = {
  client: any; dailyPlan?: any; insight?: any; todaysWorkout?: any
  adjustedExercises?: any[]; output?: any
  cycleAdjustment?: { label: string; note: string }
}

export default function EmberDashboard(props: Props) {
  const sourceCards = props.client.carousel_style === 'step' && props.dailyPlan?.currentCard ? [props.dailyPlan.currentCard] : (props.dailyPlan?.cards || [])
  const cards = sourceCards.map((card: any) => ({
    ...card,
    items: card.id === 'morning'
      ? ['Complete the assigned workout only if today is a training day.', 'Use the cycle-adjusted weights, sets, and reps shown in your workout.']
      : card.id === 'midday'
        ? ['Protect your protein target.', 'Keep water visible and simple.']
        : ['Recover enough to make tomorrow possible.'],
  }))

  return (
    <>
      <section style={{ marginTop: '36px', marginBottom: '42px' }} className="dashboard-section">
        <p style={styles.eyebrowStyle}>Ember Dashboard</p>
        <h1 style={styles.heroTitleStyle}>Workout, nourishment, water, recovery.</h1>
        <p style={styles.heroTextStyle}>Only the essentials, adjusted to your program and current cycle phase.</p>
      </section>
      {cards.length ? (
        <DashboardFlowCarousel
          cards={cards}
          currentCardId={props.dailyPlan?.currentCard?.id}
          program="ember"
          client={props.client}
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
