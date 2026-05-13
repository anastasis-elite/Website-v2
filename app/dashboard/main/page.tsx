import Link from 'next/link'
import * as styles from '../../styles/globalstyles'
import { getClientData } from '@/lib/supabase/getClient'

function getGreeting() {
  const hour = new Date().getHours()

  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  return 'evening'
}

export default async function DashboardPage() {
  const client = await getClientData()

  if (!client) {
    return null
  }

  const fullName = client.full_name || ''
  const firstName = fullName
    ? fullName.split(' ')[0]
    : ''

  const greeting = getGreeting()

  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Dashboard</p>

        <h1 style={styles.heroTitleStyle}>
          Good {greeting}
          {firstName ? `, ${firstName}` : ''}.
        </h1>

        <p style={styles.heroTextStyle}>
          This is your execution hub. Today, your job is not to do everything.
          Your job is to complete the next layer the system has placed in front
          of you.
        </p>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>
            Today’s Focus
          </h2>

          <div style={styles.bodyStyle}>
            <p>
              <strong>Current layer:</strong>{' '}
              Training foundation
            </p>

            <p>
              Complete your scheduled workout and let the
              system build from consistency first.
            </p>

            <p>
              Recovery, nutrition timing, sauna, and deeper
              lifestyle protocols will unlock as your
              execution stabilizes.
            </p>
          </div>
        </section>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>
            Today’s Training
          </h2>

          <div style={styles.bodyStyle}>
            <p>
              Your workout plan is ready to be viewed from
              your training page.
            </p>

            <p>
              Use this page to complete your assigned work
              and begin building your progress history.
            </p>
          </div>

          <div style={styles.buttonRowStyle}>
            <Link
              href="/dashboard/workout"
              style={styles.primaryButtonStyle}
            >
              View Today’s Workout
            </Link>
          </div>
        </section>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>
            Nutrition
          </h2>

          <div style={styles.bodyStyle}>
            <p>
              Nutrition guidance will expand as your
              training consistency builds.
            </p>

            <p>
              For now: focus on hydration, protein, and
              keeping your body supported enough to show up.
            </p>
          </div>

          <div style={styles.buttonRowStyle}>
            <Link
              href="/dashboard/nutrition"
              style={styles.secondaryButtonStyle}
            >
              View Nutrition
            </Link>
          </div>
        </section>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>
            Recovery
          </h2>

          <div style={styles.bodyStyle}>
            <p>
              Recovery protocols will unlock progressively.
            </p>

            <p>
              The system will not overload you before your
              foundation is stable.
            </p>
          </div>
        </section>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>
            Progress
          </h2>

          <div style={styles.bodyStyle}>
            <p>
              <strong>Phase:</strong> Foundation
            </p>

            <p>
              <strong>Next unlock:</strong> Recovery layer
              after consistent training execution.
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}
