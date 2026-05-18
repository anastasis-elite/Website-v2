import Link from 'next/link'
import * as styles from '../styles/globalstyles'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { getNextLesson } from '@/lib/education/getNextLesson'

export default async function DashboardPage() {
  const assessmentStatus = 'available'

  const { supabase, client, user } = await getDashboardContext()

  const program = client.program || 'ignite'

  const lesson = await getNextLesson({
    supabase,
    client,
    user,
  })

  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Client Dashboard</p>

        <h1 style={styles.heroTitleStyle}>Your system for today.</h1>

        <p style={styles.heroTextStyle}>
          This is your home base for assessment, training, nutrition, recovery,
          and daily execution.
        </p>

        {lesson ? (
          <section
            style={styles.cartBoxStyle}
            className="dashboard-section"
          >
            <h2 style={styles.sectionTitleStyle}>Today’s Insight</h2>

            <p style={styles.bodyStyle}>
              <strong>{lesson.title}</strong>
            </p>

            <p style={styles.bodyStyle}>{lesson.body}</p>
          </section>
        ) : null}

        <section
          style={styles.cartBoxStyle}
          className="dashboard-section"
        >
          <h2 style={styles.sectionTitleStyle}>Assessment</h2>

          <p style={styles.bodyStyle}>
            Complete your assessment so your program can stay aligned with your
            current body, strength, recovery, and goals.
          </p>

          {assessmentStatus === 'available' && (
            <Link
              href={`/dashboard/assessment/start?program=${program}`}
              style={styles.primaryButtonStyle}
            >
              Start Assessment
            </Link>
          )}
        </section>

        <section
          style={styles.cartBoxStyle}
          className="dashboard-section"
        >
          <h2 style={styles.sectionTitleStyle}>Today’s Training</h2>

          <p style={styles.bodyStyle}>
            View your current program and complete today’s assigned workout.
          </p>

          <Link
            href={`/dashboard/program/${program}/plan`}
            style={styles.primaryButtonStyle}
          >
            View Workout Program
          </Link>

          <label style={styles.bodyStyle}>
            <input type="checkbox" /> Today’s workout completed
          </label>
        </section>

        <section
          style={styles.cartBoxStyle}
          className="dashboard-section"
        >
          <h2 style={styles.sectionTitleStyle}>Nutrition</h2>

          <p style={styles.bodyStyle}>
            Track your macros, meals, and water intake for the day.
          </p>

          <Link href="/dashboard/nutrition" style={styles.primaryButtonStyle}>
            View Nutrition Dashboard
          </Link>
        </section>

        <section
          style={styles.cartBoxStyle}
          className="dashboard-section"
        >
          <h2 style={styles.sectionTitleStyle}>Daily Checklist</h2>

          <div className="dashboard-checklist">
            <label>
              <input type="checkbox" /> Workout completed
            </label>
            <br />
            <label>
              <input type="checkbox" /> Macros logged
            </label>
            <br />
            <label>
              <input type="checkbox" /> Water logged
            </label>
            <br />
            <label>
              <input type="checkbox" /> Daily check-in completed
            </label>
          </div>
        </section>

        <section
          style={styles.cartBoxStyle}
          className="dashboard-section"
        >
          <h2 style={styles.sectionTitleStyle}>Progress Snapshot</h2>

          <p style={styles.bodyStyle}>
            Your progress chart will appear here after your second assessment.
          </p>

          <div style={styles.bodyStyle}>
            <p>
              <strong>Starting Point:</strong> Pending
            </p>
            <p>
              <strong>Current Progress:</strong> Pending
            </p>
            <p>
              <strong>Change Over Time:</strong> Pending
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}
