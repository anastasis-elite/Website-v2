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
          days.map((day: any, index: number) => (
            <section key={index} style={styles.cartBoxStyle}>
              <h2 style={styles.sectionTitleStyle}>
                {day.day_name || `Day ${index + 1}`}
              </h2>

              {day.focus ? (
                <p style={styles.bodyStyle}>
                  <strong>Focus:</strong> {day.focus}
                </p>
              ) : null}

              {day.exercises?.length ? (
                day.exercises.map((exercise: any, i: number) => (
                  <div key={i} style={styles.bodyStyle}>
                    <p>
                      <strong>{exercise.name}</strong>
                    </p>
                    <p>
                      {exercise.sets} sets · {exercise.reps} reps ·{' '}
                      {exercise.weight || 'Calculated weight pending'}
                    </p>
                  </div>
                ))
              ) : (
                <p style={styles.bodyStyle}>Exercises pending calculation.</p>
              )}
            </section>
          ))
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
