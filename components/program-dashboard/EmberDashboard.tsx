// components/program-dashboard/EmberDashboard.tsx
import Link from 'next/link'
import * as styles from '@/app/styles/globalstyles'
import CapacityCheckIn from '@/components/CapacityCheckIn'

type Props = {
  client: any
  lesson?: any
}

export default function EmberDashboard({ client, lesson }: Props) {
  return (
    <>
      <section
        style={{
          ...styles.cartBoxStyle,
          marginTop: '36px',
          marginBottom: '42px',
        }}
        className="dashboard-section"
      >
        <p style={styles.eyebrowStyle}>Today’s Focus</p>

        <h2 style={styles.sectionTitleStyle}>
          Start with the next right thing.
        </h2>

        <p style={styles.bodyStyle}>
          Ember is here to help you build consistency without turning your life
          into another thing to manage.
        </p>

        <div
          style={{
            display: 'flex',
            gap: '10px',
            flexWrap: 'wrap',
            marginTop: '22px',
          }}
        >
          <Link href="/dashboard/program/ember/plan/content" style={styles.primaryButtonStyle}>
            View Workout
          </Link>

          <Link href="/dashboard/nutrition" style={styles.secondaryButtonStyle}>
            View Nutrition
          </Link>
        </div>
      </section>

      <section
        style={{
          ...styles.cartBoxStyle,
          marginBottom: '42px',
        }}
        className="dashboard-section"
      >
        <CapacityCheckIn program="ember" />
      </section>

      <section
        style={{
          ...styles.cartBoxStyle,
          marginBottom: '42px',
        }}
        className="dashboard-section"
      >
        <p style={styles.eyebrowStyle}>Training</p>

        <h2 style={styles.sectionTitleStyle}>
          Today’s workout is ready.
        </h2>

        <p style={styles.bodyStyle}>
          Complete what is assigned today. The goal is not to prove how much you
          can do. The goal is to build enough trust with yourself to keep going.
        </p>

        <div style={{ marginTop: '22px' }}>
          <Link href="/dashboard/program/ember/plan/content" style={styles.primaryButtonStyle}>
            View Today’s Workout
          </Link>
        </div>
      </section>

      <section
        style={{
          ...styles.cartBoxStyle,
          marginBottom: '42px',
        }}
        className="dashboard-section"
      >
        <p style={styles.eyebrowStyle}>Nutrition</p>

        <h2 style={styles.sectionTitleStyle}>
          Keep your body supported.
        </h2>

        <p style={styles.bodyStyle}>
          For Ember, nutrition stays simple: water, protein, and enough food to
          support the version of you that is trying to come back.
        </p>

        <div style={{ marginTop: '22px' }}>
          <Link href="/dashboard/nutrition" style={styles.secondaryButtonStyle}>
            View Nutrition
          </Link>
        </div>
      </section>

      <section
        style={{
          ...styles.cartBoxStyle,
          marginBottom: '42px',
        }}
        className="dashboard-section"
      >
        <p style={styles.eyebrowStyle}>Recovery</p>

        <h2 style={styles.sectionTitleStyle}>
          Recovery counts here.
        </h2>

        <p style={styles.bodyStyle}>
          If today needs to be lighter, that is not failure. Ember is designed
          to help you keep the rhythm without punishing your body for being
          human.
        </p>

        <div style={{ marginTop: '22px' }}>
          <Link href="/dashboard/recovery" style={styles.secondaryButtonStyle}>
            View Recovery
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

          <h2 style={styles.sectionTitleStyle}>{lesson.title}</h2>

          <p style={styles.bodyStyle}>{lesson.body}</p>
        </section>
      ) : (
        <section
          style={{
            ...styles.cartBoxStyle,
            marginBottom: '42px',
          }}
          className="dashboard-section"
        >
          <p style={styles.eyebrowStyle}>Today’s Insight</p>

          <h2 style={styles.sectionTitleStyle}>
            You do not need a perfect day.
          </h2>

          <p style={styles.bodyStyle}>
            You need one completed next step. That is how consistency becomes
            something your body can trust.
          </p>
        </section>
      )}
    </>
  )
}
