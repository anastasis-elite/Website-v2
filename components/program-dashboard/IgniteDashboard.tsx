import Link from 'next/link'
import * as styles from '@/app/styles/globalstyles'
import DashboardFlowCarousel from '@/components/DashboardFlowCarousel'
import DashboardStatusDock from '@/components/DashboardStatusDock'
import PeriodStartButton from '@/components/PeriodStartButton'

type Props = {
  client: any
  dailyPlan?: any
  cycleStatus?: any
  assessmentDueCount?: number
  lesson?: any
}

export default function IgniteDashboard({
  client,
  dailyPlan,
  cycleStatus,
  assessmentDueCount,
  lesson,
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
          Track the signals. Follow the system.
        </h2>

        <p style={styles.bodyStyle}>
          Ignite gives you deeper nutrition tracking, macro and micronutrient
          awareness, daily flow support, progress tracking, and recovery timing
          without turning your life into another full-time job.
        </p>

        <div
          style={{
            display: 'flex',
            gap: '10px',
            flexWrap: 'wrap',
            marginTop: '22px',
          }}
        >
          <Link href="/dashboard/program/ignite/plan" style={styles.primaryButtonStyle}>
            Training Plan
          </Link>

          <Link href="/dashboard/nutrition" style={styles.primaryButtonStyle}>
            Track Nutrition
          </Link>

          <Link href="/dashboard/recovery" style={styles.secondaryButtonStyle}>
            Recovery
          </Link>

          <Link href="/dashboard/cycle" style={styles.secondaryButtonStyle}>
            Cycle
          </Link>

          <PeriodStartButton clientId={client.client_id} />
        </div>
      </section>

      <section
        style={{
          ...styles.cartBoxStyle,
          marginBottom: '42px',
        }}
        className="dashboard-section"
      >
        <p style={styles.eyebrowStyle}>Today’s Execution</p>

        <h2 style={styles.sectionTitleStyle}>
          Your next best layer.
        </h2>

        <p style={styles.bodyStyle}>
          Use this section to move through the day without carrying the whole
          plan in your head.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '14px',
            marginTop: '24px',
          }}
        >
          <IgniteMetricCard
            label="Workout"
            value={dailyPlan?.workoutCompleted ? 'Complete' : 'Open'}
          />

          <IgniteMetricCard
            label="Nutrition"
            value={dailyPlan?.nutritionLogged ? 'Tracking' : 'Needs Log'}
          />

          <IgniteMetricCard
            label="Recovery"
            value={dailyPlan?.recoveryTools?.primaryTool || 'Recommended'}
          />

          <IgniteMetricCard
            label="Check-ins Due"
            value={String(assessmentDueCount ?? 0)}
          />
        </div>
      </section>

      {dailyPlan?.cards?.length ? (
  <section style={{ marginTop: '54px', marginBottom: '42px' }}>
    <DashboardFlowCarousel
      cards={dailyPlan.cards}
      currentCardId={dailyPlan.currentCard?.id}
    />
  </section>
) : null}

      <section
        style={{
          ...styles.cartBoxStyle,
          marginBottom: '42px',
        }}
        className="dashboard-section"
      >
        <p style={styles.eyebrowStyle}>Progress</p>

        <h2 style={styles.sectionTitleStyle}>
          Measurements + photos
        </h2>

        <p style={styles.bodyStyle}>
          Ignite tracks progress beyond the scale so you can see what your body
          is actually responding to.
        </p>

        <div
          style={{
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap',
            marginTop: '22px',
          }}
        >
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
            href="/dashboard/assessment/start"
            style={styles.secondaryButtonStyle}
          >
            Monthly Check-In
          </Link>
        </div>
      </section>

      {lesson ? (
        <section
          style={{
            ...styles.cartBoxStyle,
            marginBottom: '42px',
          }}
          className="dashboard-section"
        >
          <p style={styles.eyebrowStyle}>Today’s Insight</p>

          <h2 style={styles.sectionTitleStyle}>
            {lesson.title}
          </h2>

          <p style={styles.bodyStyle}>
            {lesson.body}
          </p>
        </section>
      ) : null}
    </>
  )
}

function IgniteMetricCard({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div
      style={{
        padding: '18px',
        borderRadius: '22px',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      <p
        style={{
          ...styles.eyebrowStyle,
          fontSize: '10px',
          marginBottom: '8px',
        }}
      >
        {label}
      </p>

      <p
        style={{
          margin: 0,
          color: '#f5f0e8',
          fontSize: '1.2rem',
          fontWeight: 500,
        }}
      >
        {value}
      </p>
    </div>
  )
}
