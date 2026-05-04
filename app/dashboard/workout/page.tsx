'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import * as styles from '../../styles/globalstyles'

function WorkoutContent() {
  const searchParams = useSearchParams()

  useEffect(() => {
  async function loadWorkout() {
    try {
      const res = await fetch('/api/program/workout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          program: program,
        }),
      })

      const data = await res.json()

      setWorkout(data)
    } catch (err) {
      console.error('Workout load error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (clientId) {
    loadWorkout()
  }
}, [clientId, program])
  
  const fullName = searchParams.get('fullName') || ''
  const clientId = searchParams.get('client_id') || ''
  const program = searchParams.get('program') || ''

  const firstName = fullName ? fullName.split(' ')[0] : ''

  const [workout, setWorkout] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  
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
          {loading ? (
  <p style={styles.bodyStyle}>Loading your workout...</p>
) : workout ? (
  <div style={styles.bodyStyle}>
    <p><strong>Day:</strong> {workout.day_name}</p>
    <p><strong>Focus:</strong> {workout.focus}</p>

    <ul>
      {workout.exercises?.map((ex: any, i: number) => (
        <li key={i}>
          {ex.name} — {ex.weight} lbs × {ex.reps}
        </li>
      ))}
    </ul>
  </div>
) : (
  <p style={styles.bodyStyle}>No workout found.</p>
)}
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
            href={`/dashboard/main?program=${encodeURIComponent(program)}&client_id=${encodeURIComponent(clientId)}&fullName=${encodeURIComponent(fullName)}`}
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
