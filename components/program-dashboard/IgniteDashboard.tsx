import Link from 'next/link'
import * as styles from '@/app/styles/globalstyles'
import DashboardStatusDock from '@/components/DashboardStatusDock'
import DailyInsightCard from '@/components/DailyInsightCard'
import PeriodStartButton from '@/components/PeriodStartButton'
import WorkoutTracker from '@/components/WorkoutTracker'

type Props = {
  client: any
  dailyPlan?: any
  cycleStatus?: any
  assessmentDueCount?: number
  adaptiveDashboard?: any
  insight?: any
  todaysWorkout?: any
  adjustedExercises?: any[]
  output?: any
  cycleAdjustment?: {
    label: string
    note: string
  }
}

export default function IgniteDashboard({
  client,
  dailyPlan,
  cycleStatus,
  assessmentDueCount,
  insight,
  todaysWorkout,
  adjustedExercises = [],
  output,
  cycleAdjustment,
}: Props) {
  return (
    <>
      {dailyPlan && cycleStatus ? (
        <DashboardStatusDock
          client={client}
          cycleStatus={cycleStatus}
          dailyPlan={dailyPlan}
          assessmentDueCount={assessmentDueCount ?? 0}
        />
      ) : null}

      <section
        style={{
          ...styles.cartBoxStyle,
          marginTop: '36px',
          marginBottom: '42px',
        }}
        className="dashboard-section"
      >
        <p style={styles.eyebrowStyle}>Ignite Dashboard</p>

        <h2 style={styles.sectionTitleStyle}>
          Follow the day in three simple layers.
        </h2>

        <p style={styles.bodyStyle}>
          Ignite keeps the system visible without making your life feel like a
          spreadsheet. Start with the next block, log what matters, and let the
          dashboard keep the bigger pattern.
        </p>

        <div style={styles.buttonRowStyle}>
          <Link href="/dashboard/program/ignite" style={styles.primaryButtonStyle}>
            Today&apos;s Program
          </Link>

          <Link href="/dashboard/nutrition" style={styles.secondaryButtonStyle}>
            Nutrition
          </Link>

          <Link href="/dashboard/recovery" style={styles.secondaryButtonStyle}>
            Recovery
          </Link>

          <PeriodStartButton clientId={client.client_id} />
        </div>
      </section>

      {insight ? (
        <section style={{ marginBottom: '42px' }} className="dashboard-section">
          <DailyInsightCard insight={insight} />
        </section>
      ) : null}

      <section
        style={{
          ...styles.cartBoxStyle,
          marginBottom: '42px',
        }}
        className="dashboard-section"
      >
        <p style={styles.eyebrowStyle}>Daily Flow</p>

        <h2 style={styles.sectionTitleStyle}>
          Morning, midday, evening. That is enough.
        </h2>

        <div style={styles.cardGridStyle}>
          <DailyFlowCard
            title="Morning"
            body="Hydrate, eat your first meal, notice training readiness, and open the workout only if training belongs in this part of the day."
            href={todaysWorkout ? '/dashboard/program/ignite' : '/dashboard/nutrition'}
            action={todaysWorkout ? 'Review Workout' : 'Start with Nutrition'}
            status={dailyPlan?.currentCard?.id === 'morning' ? 'Current' : undefined}
          />

          <DailyFlowCard
            title="Midday"
            body="Log food, protect protein, check micros, move gently, and make one useful adjustment before the day gets loud."
            href="/dashboard/nutrition"
            action="Log Nutrition"
            status={dailyPlan?.nutritionLogged ? 'Nutrition logged' : undefined}
          />

          <DailyFlowCard
            title="Evening"
            body="Downshift recovery, log symptoms if they matter, reflect without spiraling, and make tomorrow easier before you close the day."
            href="/dashboard/recovery"
            action="Support Recovery"
            status={cycleStatus?.recoveryCaution ? 'Recovery caution' : undefined}
          />
        </div>
      </section>

      <section
        style={{
          ...styles.cartBoxStyle,
          marginBottom: '42px',
        }}
        className="dashboard-section"
      >
        <p style={styles.eyebrowStyle}>Today&apos;s Workout</p>

        {todaysWorkout ? (
          <>
            <h2 style={styles.sectionTitleStyle}>{todaysWorkout.day_name}</h2>

            {todaysWorkout.focus ? (
              <p style={styles.bodyStyle}>
                <strong>Focus:</strong> {todaysWorkout.focus}
              </p>
            ) : null}

            {cycleAdjustment ? (
              <p style={styles.bodyStyle}>
                <strong>{cycleAdjustment.label}:</strong>{' '}
                {cycleAdjustment.note}
              </p>
            ) : null}

            {adjustedExercises.length ? (
              <WorkoutTracker
                clientId={client.client_id}
                authUserId={client.auth_user_id}
                program={output?.program || client.program || 'ignite'}
                dayName={todaysWorkout.day_name}
                exercises={adjustedExercises}
              />
            ) : (
              <p style={styles.bodyStyle}>
                No exercises are assigned inside today&apos;s workout yet.
              </p>
            )}
          </>
        ) : (
          <>
            <h2 style={styles.sectionTitleStyle}>
              Recovery is the training signal today.
            </h2>

            <p style={styles.bodyStyle}>
              There is no assigned workout for today. Keep the rhythm with food,
              water, movement, and recovery instead of forcing extra output.
            </p>
          </>
        )}
      </section>

      <section
        style={{
          ...styles.cartBoxStyle,
          marginBottom: '42px',
        }}
        className="dashboard-section"
      >
        <p style={styles.eyebrowStyle}>Progress</p>

        <h2 style={styles.sectionTitleStyle}>Measurements + photos</h2>

        <p style={styles.bodyStyle}>
          Keep progress simple and evidence-based. Measurements, photos, and
          check-ins help the system adapt without making the scale the whole
          story.
        </p>

        <div style={styles.buttonRowStyle}>
          <Link
            href="/dashboard/assessment/measurements"
            style={styles.secondaryButtonStyle}
          >
            Measurements
          </Link>

          <Link
            href="/dashboard/assessment/photos"
            style={styles.secondaryButtonStyle}
          >
            Progress Photos
          </Link>

          <Link
            href="/dashboard/assessment/monthly"
            style={styles.secondaryButtonStyle}
          >
            Monthly Check-In
          </Link>
        </div>
      </section>
    </>
  )
}

function DailyFlowCard({
  title,
  body,
  href,
  action,
  status,
}: {
  title: string
  body: string
  href: string
  action: string
  status?: string
}) {
  return (
    <div style={styles.cardStyle}>
      <p style={{ ...styles.eyebrowStyle, marginBottom: '12px' }}>
        {status || 'Ready'}
      </p>

      <h3 style={styles.cardTitleStyle}>{title}</h3>

      <p style={styles.cardTextStyle}>{body}</p>

      <Link
        href={href}
        style={{
          ...styles.quietLinkStyle,
          marginTop: '18px',
        }}
      >
        {action}
      </Link>
    </div>
  )
}
