import * as styles from '../../../../../styles/globalstyles'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import WorkoutTracker from '@/components/WorkoutTracker'
import {
  getCycleTrainingAdjustment,
  applyCycleTrainingAdjustment,
} from '@/lib/cycle/getCycleTrainingAdjustment'

export default async function PlanContent() {
  const { supabase, client } = await getDashboardContext()

  const { data: output, error } = await supabase
    .from('program_outputs')
    .select('*')
    .eq('client_id', client.client_id)
    .eq('program', client.program)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return (
      <main style={styles.pageStyle}>
        <div style={styles.containerStyle}>
          <h1 style={styles.heroTitleStyle}>Program could not load.</h1>
          <p style={styles.heroTextStyle}>{error.message}</p>
        </div>
      </main>
    )
  }

  if (!output) {
    return (
      <main style={styles.pageStyle}>
        <div style={styles.containerStyle}>
          <p style={styles.eyebrowStyle}>Program Output</p>
          <h1 style={styles.heroTitleStyle}>Your program is being built.</h1>
          <p style={styles.heroTextStyle}>
            Once your assessment data has been processed, your personalized plan will appear here.
          </p>
        </div>
      </main>
    )
  }

  const programJson = output.program_json || {}
  const days = programJson.days || []

  const todayName = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
  })

  const todaysWorkout = days.find(
    (day: any) => day.day_name === todayName
  )
const cycleAdjustment = getCycleTrainingAdjustment(client)

const adjustedExercises = todaysWorkout?.exercises?.length
  ? todaysWorkout.exercises.map((exercise: any) =>
      applyCycleTrainingAdjustment({
        exercise,
        adjustment: cycleAdjustment,
      })
    )
  : []
  
  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Today’s Workout</p>

        <h1 style={styles.heroTitleStyle}>
          {client.full_name?.split(' ')[0] || 'Your'} workout for {todayName}.
        </h1>

        <p style={styles.heroTextStyle}>
          Program: {output.program} · Status: {output.status}
        </p>

        {days.length ? (
          todaysWorkout ? (
            <section style={styles.cartBoxStyle}>
              <h2 style={styles.sectionTitleStyle}>
                {todaysWorkout.day_name}
              </h2>

              {todaysWorkout.focus ? (
                <p style={styles.bodyStyle}>
                  <strong>Focus:</strong> {todaysWorkout.focus}
                </p>
              ) : null}

{adjustedExercises.length ? (
  <WorkoutTracker
    clientId={client.client_id}
    authUserId={client.auth_user_id}
    program={output.program}
    dayName={todaysWorkout.day_name}
    exercises={adjustedExercises}
  />
) : (
                <p style={styles.bodyStyle}>
                  Rest day or no workout assigned.
                </p>
              )}
            </section>
          ) : (
            <section style={styles.cartBoxStyle}>
              <h2 style={styles.sectionTitleStyle}>
                No workout found for today.
              </h2>
            </section>
          )
        ) : (
          <section style={styles.cartBoxStyle}>
            <h2 style={styles.sectionTitleStyle}>Program saved.</h2>
            <p style={styles.bodyStyle}>
              The program output row exists, but workout days have not been calculated yet.
            </p>
          </section>
        )}
      </div>
    </main>
  )
}
