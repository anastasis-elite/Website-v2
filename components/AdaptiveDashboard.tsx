import Link from 'next/link'
import * as styles from '@/app/styles/globalstyles'
import DashboardFlowCarousel from '@/components/DashboardFlowCarousel'
import DashboardStatusDock from '@/components/DashboardStatusDock'
import SymptomQuickLog from '@/components/SymptomQuickLog'

type Props = {
  client: any
  dailyPlan: any
  cycleStatus: any
  adaptiveDashboard: any
  assessmentDueCount: number
  lesson?: any
}

export default function AdaptiveDashboard({
  client,
  dailyPlan,
  cycleStatus,
  adaptiveDashboard,
  assessmentDueCount,
  lesson,
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
        <p style={styles.eyebrowStyle}>Today's Guidance</p>

        <h2 style={styles.sectionTitleStyle}>
          {adaptiveDashboard.phaseName}
        </h2>

        <p style={styles.bodyStyle}>
          {adaptiveDashboard.adaptiveMessage}
        </p>

        <div
          style={{
            marginTop: '24px',
            padding: '20px',
            borderRadius: '24px',
            background: 'rgba(181,110,67,0.07)',
            border: '1px solid rgba(181,110,67,0.16)',
          }}
        >
          <p
            style={{
              ...styles.bodyStyle,
              marginBottom: '10px',
            }}
          >
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

          <p
            style={{
              ...styles.bodyStyle,
              marginTop: '12px',
              fontSize: '0.9rem',
              color: 'rgba(243,238,232,0.72)',
            }}
          >
            {adaptiveDashboard.flameScore}/100 — this does not measure
            perfection. It reflects capacity, consistency, recovery, and
            self-trust.
          </p>
        </div>

        <div style={{ marginTop: '26px' }}>
          <p style={styles.bodyStyle}>
            <strong>Today’s Focus</strong>
          </p>

          <div
            style={{
              display: 'flex',
              gap: '10px',
              flexWrap: 'wrap',
              marginTop: '12px',
            }}
          >
            {adaptiveDashboard.todayFocus.map((focus: string) => (
              <span
                key={focus}
                style={{
                  padding: '10px 14px',
                  borderRadius: '999px',
                  background: 'rgba(181,110,67,0.12)',
                  color: '#f5f0e8',
                  fontSize: '0.86rem',
                }}
              >
                {focus}
              </span>
            ))}
          </div>
        </div>
      </section>

      <div
  style={{
    display: 'grid',
    gap: '16px',
    marginTop: '32px',
  }}
>
  {adaptiveDashboard.showCycle ? (
    <div style={styles.innerCardStyle}>
      <p style={styles.eyebrowStyle}>Cycle Phase</p>

      <h3 style={styles.sectionTitleStyle}>
        {cycleStatus?.phase || 'Cycle tracking preparing'}
      </h3>

      <p style={styles.bodyStyle}>
        Your training, recovery, and recommendations are built around where
        you are in your cycle.
      </p>
    </div>
  ) : null}

  {adaptiveDashboard.showMacroTargets ? (
    <div style={styles.innerCardStyle}>
      <p style={styles.eyebrowStyle}>Nutrition Targets</p>

      <h3 style={styles.sectionTitleStyle}>
        Macro + hydration guidance
      </h3>

      <p style={styles.bodyStyle}>
        Your macro and hydration recommendations are personalized using your
        assessment data, recovery needs, and training goals.
      </p>
    </div>
  ) : null}

  {adaptiveDashboard.showRecoveryRecommendation ? (
    <div style={styles.innerCardStyle}>
      <p style={styles.eyebrowStyle}>Recovery</p>

      <h3 style={styles.sectionTitleStyle}>
        Recovery timing active
      </h3>

      <p style={styles.bodyStyle}>
        Recovery recommendations adjust around your training load, cycle
        phase, and current capacity.
      </p>
    </div>
  ) : null}
</div>
      
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

      {lesson &&
       adaptiveDashboard.phase >= 2 &&
       adaptiveDashboard.showGeneralInsights ? (
        <section
          style={{
            ...styles.cartBoxStyle,
            marginBottom: '42px',
          }}
          className="dashboard-section"
        >
          <p style={styles.eyebrowStyle}>Today’s Insight</p>

          <h2 style={styles.sectionTitleStyle}>{lesson.title}</h2>

          <p style={styles.bodyStyle}>{lesson.body}</p>
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

      {adaptiveDashboard.showAdaptiveNutrition ? (
        <section
          style={{
            ...styles.cartBoxStyle,
            marginTop: '54px',
          }}
          className="dashboard-section"
        >
          <p style={styles.eyebrowStyle}>Phoenix Nutrition</p>

          <h2 style={styles.sectionTitleStyle}>
            Adaptive meal support is preparing.
          </h2>

          <p style={styles.bodyStyle}>
            As your nutrition data builds, Phoenix will be able to recommend
            meals around remaining macros, micros, timing, symptoms, training,
            and recovery.
          </p>
        </section>
      ) : null}
    </>
  )
}
