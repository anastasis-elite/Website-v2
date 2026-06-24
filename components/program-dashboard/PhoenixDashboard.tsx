import Link from 'next/link'
import * as styles from '@/app/styles/globalstyles'
import WorkoutTracker from '@/components/WorkoutTracker'

type PhoenixDashboardProps = {
  client: any
  output: any
  todaysWorkout: any
  adjustedExercises: any[]
  cycleAdjustment: {
    label: string
    note: string
  }
  phoenixTrackLabel: string
}

function getFirstName(name?: string | null) {
  return name?.split(' ')[0] || 'Your'
}

export default function PhoenixDashboard({
  client,
  output,
  todaysWorkout,
  adjustedExercises,
  cycleAdjustment,
  phoenixTrackLabel,
}: PhoenixDashboardProps) {
  const primaryAction = todaysWorkout
    ? 'Complete today’s training.'
    : 'Recover, log symptoms, and let the system keep calibrating.'

  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Phoenix</p>

        <h1 style={styles.heroTitleStyle}>
          {getFirstName(client.full_name)}, here is today’s next step.
        </h1>

        <section style={styles.cartBoxStyle}>
          <p style={styles.eyebrowStyle}>Today</p>

          <h2 style={styles.sectionTitleStyle}>{primaryAction}</h2>

          <p style={styles.bodyStyle}>
            Track: <strong>{phoenixTrackLabel}</strong>
          </p>

          <p style={styles.bodyStyle}>
            Body signal: <strong>{cycleAdjustment.label}</strong>
          </p>

          <p style={styles.bodyStyle}>{cycleAdjustment.note}</p>
        </section>

        {todaysWorkout ? (
          <section style={styles.cartBoxStyle}>
            <h2 style={styles.sectionTitleStyle}>{todaysWorkout.day_name}</h2>

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
              <p style={styles.bodyStyle}>No exercises assigned today.</p>
            )}
          </section>
        ) : (
          <section style={styles.cartBoxStyle}>
            <h2 style={styles.sectionTitleStyle}>No heavy lifting today.</h2>
            <p style={styles.bodyStyle}>
              Keep this simple: recover, nourish, hydrate, and log anything your
              body is telling you.
            </p>
          </section>
        )}

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>Only update what matters today.</h2>

          <div style={styles.cardGridStyle}>
            <Link href="/dashboard/nutrition" style={styles.cardStyle}>
              <h3 style={styles.cardTitleStyle}>Food</h3>
              <p style={styles.cardTextStyle}>
                Log meals, water, or anything that needs nutrition adjustment.
              </p>
            </Link>

            <Link href="/dashboard/symptoms" style={styles.cardStyle}>
              <h3 style={styles.cardTitleStyle}>Body signals</h3>
              <p style={styles.cardTextStyle}>
                Log fatigue, cravings, soreness, stress, sleep, cycle changes,
                or recovery issues.
              </p>
            </Link>

            <Link href="/dashboard/assessment/photos" style={styles.cardStyle}>
              <h3 style={styles.cardTitleStyle}>Photos</h3>
              <p style={styles.cardTextStyle}>
                Upload progress, posture, or compensation photos when needed.
              </p>
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
