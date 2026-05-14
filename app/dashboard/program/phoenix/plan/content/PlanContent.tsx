import * as styles from '../../../../../styles/globalstyles'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'

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

  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Program Output</p>

        <h1 style={styles.heroTitleStyle}>
          {client.full_name?.split(' ')[0] || 'Your'} personalized program.
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

              {todaysWorkout.exercises?.length ? (
                todaysWorkout.exercises.map((exercise: any, i: number) => (
                  <div key={i} style={styles.bodyStyle}>
                    <p>
                      <strong>{exercise.exercise || exercise.name}</strong>
                    </p>

                    <p>
                      {exercise.sets} sets · {exercise.reps} reps ·{' '}
                      {exercise.calculated_weight
                        ? `${exercise.calculated_weight} lbs`
                        : 'Calculated weight pending'}
                    </p>
                  </div>
                ))
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
