'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import * as styles from '../../styles/globalstyles'

type Exercise = {
  name: string
  weight?: string | number
  reps?: string | number
}

type WorkoutData = {
  day_name?: string
  focus?: string
  exercises?: Exercise[]
  error?: string
}

function WorkoutContent() {
  const searchParams = useSearchParams()

  const fullName = searchParams.get('fullName') || ''
  const clientId = searchParams.get('client_id') || ''
  const program = searchParams.get('program') || ''

  const firstName = fullName ? fullName.split(' ')[0] : ''

  const [workout, setWorkout] = useState<WorkoutData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadWorkout() {
      try {
        const res = await fetch('/api/program/workout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: clientId,
            program,
          }),
        })

        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || 'Workout load failed')
        }

        setWorkout(data)
      } catch (err) {
        console.error('Workout load error:', err)
        setWorkout(null)
      } finally {
        setLoading(false)
      }
    }

    if (clientId) {
      loadWorkout()
    } else {
      setLoading(false)
    }
  }, [clientId, program])

  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Today’s Training</p>

        <h1 style={styles.heroTitleStyle}>
          {firstName
            ? `${firstName}, here is your workout for today.`
            : 'Here is your workout for today.'}
        </h1>

        <p style={styles.heroTextStyle}>
          This is your training home for today. Your assigned work, progress updates,
          and next layers will live here as your system expands.
        </p>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>Today’s Workout</h2>

          {loading ? (
            <p style={styles.bodyStyle}>Loading your workout...</p>
          ) : workout ? (
            <div style={styles.bodyStyle}>
              <p>
                <strong>Day:</strong> {workout.day_name || 'Not loaded yet'}
              </p>
              <p>
                <strong>Focus:</strong> {workout.focus || 'Not loaded yet'}
              </p>

              {workout.exercises?.length ? (
                <ul>
                  {workout.exercises.map((ex, i) => (
                    <li key={i}>
                      {ex.name} — {ex.weight || 'TBD'} lbs × {ex.reps || 'TBD'} reps
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Your exercise list is not loaded yet.</p>
              )}
            </div>
          ) : (
            <p style={styles.bodyStyle}>
              No workout found yet. Your program data may still be preparing.
            </p>
          )}
        </section>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>Progress updates</h2>

          <div style={styles.bodyStyle}>
            <p>Later, you’ll be able to log weight and rep increases here.</p>
            <p>
              Every update will be saved with a timestamp so progress can be tracked
              over time.
            </p>
          </div>
        </section>

        <div style={styles.buttonRowStyle}>
          <Link
            href={`/dashboard/main?program=${encodeURIComponent(
              program
            )}&client_id=${encodeURIComponent(
              clientId
            )}&fullName=${encodeURIComponent(fullName)}`}
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
