import Link from 'next/link'
import * as styles from '../../../../../styles/globalstyles'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import WorkoutTracker from '@/components/WorkoutTracker'
import {
  getCycleTrainingAdjustment,
  applyCycleTrainingAdjustment,
} from '@/lib/cycle/getCycleTrainingAdjustment'

const phoenixTrackLabels: Record<string, string> = {
  phoenixStrength: 'Strength',
  phoenixHypertrophy: 'Hypertrophy',
  phoenixBodybuilding: 'Bodybuilding',
  phoenixRecomposition: 'Recomposition',
  phoenixEndurance: 'Endurance',
  phoenixGluteSculpt: 'Glute Sculpt',
  phoenixWaistCincher: 'Waist Cincher',
  phoenixFullTransformation: 'Full Transformation',
}

function getFirstName(name?: string | null) {
  return name?.split(' ')[0] || 'Your'
}

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
          <p style={styles.eyebrowStyle}>Phoenix</p>
          <h1 style={styles.heroTitleStyle}>Your plan is being prepared.</h1>
          <p style={styles.heroTextStyle}>
            Your Phoenix system is being built from your assessment data. Once it
            is ready, this page will show only what you need next.
          </p>
        </div>
      </main>
    )
  }

  const programJson = output.program_json || output.output || {}
  const days = programJson.days || []
  const phoenixTrack = programJson.phoenix_track || client.phoenix_track || ''
  const phoenixTrackLabel = phoenixTrackLabels[phoenixTrack] || 'Personalized'

  const todayName = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
  })

  const todaysWorkout = days.find((day: any) => day.day_name === todayName)
  const cycleAdjustment = getCycleTrainingAdjustment(client)

  const adjustedExercises = todaysWorkout?.exercises?.length
    ? todaysWorkout.exercises.map((exercise: any) =>
        applyCycleTrainingAdjustment({
          exercise,
          adjustment: cycleAdjustment,
        })
      )
    : []

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
            <h2 style={styles.sectionTitleStyle}>Today is not a training day.</h2>
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
              <h3 style={styles.cardTitleStyle}>Log food</h3>
              <p style={styles.cardTextStyle}>
                Use this when you eat, drink water, or need nutrition adjusted.
              </p>
            </Link>

            <Link href="/dashboard/symptoms" style={styles.cardStyle}>
              <h3 style={styles.cardTitleStyle}>Log body signals</h3>
              <p style={styles.cardTextStyle}>
                Use this for fatigue, cravings, soreness, stress, cycle changes,
                or recovery issues.
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
