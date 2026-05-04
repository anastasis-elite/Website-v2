'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import * as styles from '../../styles/globalstyles'

function getGreeting() {
  const hour = new Date().getHours()

  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  return 'evening'
}

function DashboardContent() {
  const searchParams = useSearchParams()

  const fullName = searchParams.get('fullName') || ''
  const clientId = searchParams.get('client_id') || ''
  const program = searchParams.get('program') || ''
  const email = searchParams.get('email') || ''

  const email = email()
  const firstName = fullName ? fullName.split(' ')[0] : ''
  const greeting = getGreeting()

  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Dashboard</p>

        <h1 style={styles.heroTitleStyle}>
          Good {greeting}{firstName ? `, ${firstName}` : ''}.
        </h1>

        <p style={styles.heroTextStyle}>
          This is your execution hub. For now, your primary focus is simple:
          show up, complete the work, and let the system build from there.
        </p>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>Today’s focus</h2>

          <div style={styles.bodyStyle}>
            <p>Complete your scheduled training for today.</p>
            <p>More lifestyle, recovery, and nutrition layers will unlock as your consistency builds.</p>
          </div>
        </section>

        <div style={styles.buttonRowStyle}>
          <Link
            href={`/dashboard/workout?program=${encodeURIComponent(program)}&client_id=${encodeURIComponent(clientId)}&fullName=${encodeURIComponent(fullName)}&email=${encodeURIComponent(email)}`}
            style={styles.primaryButtonStyle}
          >
            View Today’s Workout
          </Link>

          <Link href="/dashboard/main" style={styles.secondaryButtonStyle}>
            Dashboard Home
          </Link>
        </div>
      </div>
    </main>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardContent />
    </Suspense>
  )
}
