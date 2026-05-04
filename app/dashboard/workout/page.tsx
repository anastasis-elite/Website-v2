'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import * as styles from '../../styles/globalstyles'

function WorkoutContent() {
  const searchParams = useSearchParams()

  const fullName = searchParams.get('fullName') || ''
  const clientId = searchParams.get('client_id') || ''
  const program = searchParams.get('program') || ''

  const firstName = fullName ? fullName.split(' ')[0] : ''

  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Today’s Training</p>

        <h1 style={styles.heroTitleStyle}>
          {firstName ? `${firstName}, here is your workout for today.` : 'Here is your workout for today.'}
        </h1>

        <p style={styles.heroTextStyle}>
          This page will connect to your program data and display your assigned training,
          weights, reps, rest guidance, and progress updates.
        </p>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>Workout placeholder</h2>

          <div style={styles.bodyStyle}>
            <p><strong>Program:</strong> {program || 'Not loaded yet'}</p>
            <p><strong>Client ID:</strong> {clientId || 'Not loaded yet'}</p>
            <p>Once connected, this section will show today’s workout from your program sheet.</p>
          </div>
        </section>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>Progress updates</h2>

          <div style={styles.bodyStyle}>
            <p>Later, you’ll be able to log weight and rep increases here.</p>
            <p>Every update will be saved with a timestamp so progress can be tracked over time.</p>
          </div>
        </section>

        <div style={styles.buttonRowStyle}>
          <Link
            href={`/dashboard?program=${encodeURIComponent(program)}&client_id=${encodeURIComponent(clientId)}&fullName=${encodeURIComponent(fullName)}`}
            style={styles.secondaryButtonStyle}
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </main>
  )
}

export default function WorkoutPage() {
  return (
    <Suspense fallback={null}>
      <WorkoutContent />
    </Suspense>
  )
}
