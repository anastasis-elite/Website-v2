import Link from 'next/link'
import * as styles from '@/app/styles/globalstyles'
import WorkoutTracker from '@/components/WorkoutTracker'

type PhoenixDashboardProps = {
  client?: any
  todaysWorkout?: any
  adjustedExercises?: any[]
  cycleAdjustment?: {
    label: string
    note: string
  }
  phoenixTrackLabel?: string
}

function getFirstName(name?: string | null) {
  return name?.split(' ')[0] || 'Your'
}

export default function PhoenixDashboard({
  client,
  todaysWorkout,
  adjustedExercises,
  cycleAdjustment,
  phoenixTrackLabel,
}: PhoenixDashboardProps) {
  const hasTrainingToday = Boolean(todaysWorkout)

  const todaysDirective = hasTrainingToday
    ? 'Train today, then stop.'
    : 'Recover today. Nothing extra is required.'

  const primaryAction = hasTrainingToday
    ? 'Complete the workout below.'
    : 'Nourish, hydrate, and let your body rebuild.'

  const coachNote = hasTrainingToday
    ? 'Your job is not to do more. Your job is to complete the assigned work, log what matters, and let the system keep adjusting.'
    : 'A recovery day is not a missed opportunity. It is part of the adaptation process.'

  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Phoenix</p>

        <h1 style={styles.heroTitleStyle}>
          {getFirstName(client?.full_name)}, today is already simplified.
        </h1>

        <section style={styles.cartBoxStyle}>
          <p style={styles.eyebrowStyle}>Today’s Directive</p>

          <h2 style={styles.sectionTitleStyle}>{todaysDirective}</h2>

          <p style={styles.bodyStyle}>{primaryAction}</p>

          <p style={styles.bodyStyle}>
            Track: <strong>{phoenixTrackLabel || 'Phoenix'}</strong>
          </p>

          <p style={styles.bodyStyle}>
            Body signal: <strong>{cycleAdjustment.label || 'Standard Training day'}</strong>
          </p>
        </section>

        <section style={styles.cartBoxStyle}>
          <p style={styles.eyebrowStyle}>Why this matters</p>

          <h2 style={styles.sectionTitleStyle}>You do not need more decisions.</h2>

          <p style={styles.bodyStyle}>
  {cycleAdjustment?.note || 'Use the assigned plan for today and let the system keep adjusting as more data comes in.'}
</p>

          <p style={styles.bodyStyle}>{coachNote}</p>
        </section>

        {hasTrainingToday ? (
          <section style={styles.cartBoxStyle}>
            <p style={styles.eyebrowStyle}>Your One Action</p>

            <h2 style={styles.sectionTitleStyle}>
              {todaysWorkout.day_name}
            </h2>

            {todaysWorkout.focus ? (
              <p style={styles.bodyStyle}>
                <strong>Focus:</strong> {todaysWorkout.focus}
              </p>
            ) : null}

            {adjustedExercises?.length ? (
              <WorkoutTracker
                clientId={client.client_id}
                authUserId={client.auth_user_id}
                program={client.program || 'phoenix'}
                dayName={todaysWorkout.day_name}
                exercises={adjustedExercises}
              />
            ) : (
              <p style={styles.bodyStyle}>
                No exercises assigned today. Use this as recovery.
              </p>
            )}
          </section>
        ) : (
          <section style={styles.cartBoxStyle}>
            <p style={styles.eyebrowStyle}>Your One Action</p>

            <h2 style={styles.sectionTitleStyle}>Recovery is the work today.</h2>

            <p style={styles.bodyStyle}>
              Keep it simple: food, water, steps, sleep, and a quick body signal
              check-in if something feels off.
            </p>
          </section>
        )}

        <section style={styles.sectionStyle}>
          <p style={styles.eyebrowStyle}>Optional Support</p>

          <h2 style={styles.sectionTitleStyle}>Only use these if needed.</h2>

          <div style={styles.cardGridStyle}>
            <Link href="/dashboard/nutrition" style={styles.cardStyle}>
              <h3 style={styles.cardTitleStyle}>Upload food</h3>
              <p style={styles.cardTextStyle}>
                Use this when you want nutrition adjusted without tracking every
                detail yourself.
              </p>
            </Link>

            <Link href="/dashboard/symptoms" style={styles.cardStyle}>
              <h3 style={styles.cardTitleStyle}>Log body signal</h3>
              <p style={styles.cardTextStyle}>
                Use this when fatigue, cravings, soreness, stress, sleep, or
                cycle symptoms need attention.
              </p>
            </Link>

            <Link href="/dashboard/assessment/photos" style={styles.cardStyle}>
              <h3 style={styles.cardTitleStyle}>Upload photos</h3>
              <p style={styles.cardTextStyle}>
                Use this for progress, posture, compensation, or visual
                recalibration.
              </p>
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
