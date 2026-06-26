import Link from 'next/link'
import * as styles from '@/app/styles/globalstyles'
import DashboardFlowCarousel from '@/components/DashboardFlowCarousel'
import DashboardStatusDock from '@/components/DashboardStatusDock'
import SymptomQuickLog from '@/components/SymptomQuickLog'
import PeriodStartButton from '@/components/PeriodStartButton'
import DailyInsightCard from '@/components/DailyInsightCard'

type Props = {
  client: any
  dailyPlan: any
  cycleStatus: any
  adaptiveDashboard: any
  assessmentDueCount: number
  insight?: any
}

function getProgramHref(program?: string) {
  const tier = String(program || 'ember').toLowerCase()

  return `/dashboard/program/${tier}`
}

function getFocusHref(focus: string, program?: string) {
  const tier = String(program || 'ember').toLowerCase()

  if (
    focus === 'Cycle-aware training' ||
    focus === 'Follow training'
  ) {
    return getProgramHref(tier)
  }

  if (
    focus === 'Macro targets' ||
    focus === 'Track nutrition' ||
    focus === 'Reduce friction'
  ) {
    return '/dashboard/nutrition'
  }

  if (
    focus === 'Recovery timing' ||
    focus === 'Watch recovery' ||
    focus === 'Restore capacity'
  ) {
    return '/dashboard/recovery'
  }

  if (focus === 'Personalize deeply') {
    return '/dashboard/assessment/start'
  }

  return '/dashboard'
}

export default function AdaptiveDashboard({
  client,
  dailyPlan,
  cycleStatus,
  adaptiveDashboard,
  assessmentDueCount,
  insight,
}: Props) {
  return (
    <>
      {adaptiveDashboard.showStatusDock ? (
        <DashboardStatusDock
          client={client}
          cycleStatus={cycleStatus}
          dailyPlan={dailyPlan}
          assessmentDueCount={assessmentDueCount}
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
        <p style={styles.eyebrowStyle}>Today&apos;s Rhythm</p>

        <h2 style={styles.sectionTitleStyle}>
          {adaptiveDashboard.phaseName}
        </h2>

        <p style={styles.bodyStyle}>
          {adaptiveDashboard.adaptiveMessage}
        </p>

        <div
          style={{
            display: 'flex',
            gap: '10px',
            flexWrap: 'wrap',
            marginTop: '22px',
          }}
        >
          <Link href="/dashboard/cycle" style={styles.secondaryButtonStyle}>
            Cycle
          </Link>

          <PeriodStartButton clientId={client.client_id} />
          
          {adaptiveDashboard.todayFocus.map((focus: string) => (
            <Link
              key={focus}
              href={getFocusHref(focus, adaptiveDashboard.program)}
              style={styles.primaryButtonStyle}
            >
              {focus}
            </Link>
          ))}
        </div>

        {adaptiveDashboard.showFlame ? (
          <div
            style={{
              marginTop: '24px',
              padding: '18px',
              borderRadius: '22px',
              background: 'rgba(181,110,67,0.07)',
              border: '1px solid rgba(181,110,67,0.16)',
            }}
          >
            <p style={{ ...styles.bodyStyle, marginBottom: '10px' }}>
              <strong>Your Flame</strong>
            </p>

            <div
              style={{
                width: '100%',
                height: '12px',
                borderRadius: '999px',
                background: 'rgba(255,255,255,0.06)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${Math.min(
                    100,
                    Math.max(5, adaptiveDashboard.flameScore)
                  )}%`,
                  height: '100%',
                  borderRadius: '999px',
                  background:
                    'linear-gradient(90deg, rgba(181,110,67,0.55), rgba(245,190,120,0.9))',
                }}
              />
            </div>
          </div>
        ) : null}
      </section>

      {insight && adaptiveDashboard.showGeneralInsights ? (
  <DailyInsightCard insight={insight} />
) : null}
      
      {adaptiveDashboard.showProgressPhotos ? (
        <section
          style={{
            ...styles.cartBoxStyle,
            marginBottom: '42px',
          }}
          className="dashboard-section"
        >
          <p style={styles.eyebrowStyle}>Progress</p>

          <h2 style={styles.sectionTitleStyle}>
            Photos + measurements
          </h2>

          <p style={styles.bodyStyle}>
            Track visual and measurement changes privately, without relying only
            on the scale.
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
</div>
        </section>
      ) : null}

      {adaptiveDashboard.recommendedStep ? (
        <section
          style={{
            ...styles.cartBoxStyle,
            marginBottom: '42px',
          }}
          className="dashboard-section"
        >
          <p style={styles.eyebrowStyle}>Recommended Next Step</p>

          <h2 style={styles.sectionTitleStyle}>
            {adaptiveDashboard.recommendedStep.title}
          </h2>

          <p style={styles.bodyStyle}>
            {adaptiveDashboard.recommendedStep.description}
          </p>

          <div style={{ marginTop: '22px' }}>
            <Link
              href={adaptiveDashboard.recommendedStep.href}
              style={styles.primaryButtonStyle}
            >
              Continue
            </Link>
          </div>
        </section>
      ) : null}

      {adaptiveDashboard.showDailyCarousel ? (
        <section style={{ marginTop: '54px' }}>
          <DashboardFlowCarousel
            cards={dailyPlan.cards}
            currentCardId={dailyPlan.currentCard?.id}
          />
        </section>
      ) : null}

      {adaptiveDashboard.showSymptoms ? (
        <section style={{ marginTop: '54px' }}>
          <SymptomQuickLog clientId={client.client_id} />
        </section>
      ) : null}
    </>
  )
}
