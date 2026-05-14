'use client'

import { useState } from 'react'

type Exercise = {
  exercise?: string
  name?: string
  sets?: number
  reps?: number
  calculated_weight?: number
}

type Props = {
  clientId: string
  authUserId: string
  program: string
  dayName: string
  exercises: Exercise[]
}

function NumberRoller({
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
}) {
  const options = []

  for (let i = min; i <= max; i += step) {
    options.push(i)
  }

  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{
        width: '100%',
        padding: '14px',
        borderRadius: '12px',
        background: '#080808',
        color: '#f3eee8',
        border: '1px solid rgba(181,110,67,0.35)',
        fontSize: '1rem',
      }}
    >
      {options.map((num) => (
        <option key={num} value={num}>
          {num}
        </option>
      ))}
    </select>
  )
}

export default function WorkoutTracker({
  clientId,
  authUserId,
  program,
  dayName,
  exercises,
}: Props) {
  const [logs, setLogs] = useState(
    exercises.map((exercise) => ({
      exercise: exercise.exercise || exercise.name || '',
      planned_sets: exercise.sets || 0,
      planned_reps: exercise.reps || 0,
      planned_weight: exercise.calculated_weight || 0,

      actual_weight: exercise.calculated_weight || 0,
      actual_reps: exercise.reps || 0,

      completed: false,
      notes: '',
    }))
  )

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  function updateLog(index: number, field: string, value: any) {
    setLogs((prev) =>
      prev.map((log, i) =>
        i === index
          ? {
              ...log,
              [field]: value,
            }
          : log
      )
    )
  }

  async function saveWorkout() {
    try {
      setSaving(true)

      const response = await fetch('/api/workout-log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          auth_user_id: authUserId,
          program,
          day_name: dayName,
          workout_date: new Date().toISOString(),
          exercise_logs: logs,
        }),
      })

      if (!response.ok) {
        throw new Error('Workout save failed')
      }

      setSaved(true)
    } catch (error) {
      console.error(error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {logs.map((exercise, index) => (
        <section
          key={index}
          style={{
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 16,
            padding: 20,
            background: 'rgba(255,255,255,0.03)',
          }}
        >
          <h3 style={{ marginBottom: 8 }}>
            {exercise.exercise}
          </h3>

          <p>
            Planned: {exercise.planned_sets} sets ·{' '}
            {exercise.planned_reps} reps ·{' '}
            {exercise.planned_weight} lbs
          </p>

          <div
            style={{
              display: 'grid',
              gap: 12,
              marginTop: 16,
            }}
          >
            <label>
  Actual Weight
  <NumberRoller
    value={exercise.actual_weight}
    min={0}
    max={500}
    step={5}
    onChange={(value) =>
      updateLog(index, 'actual_weight', value)
    }
  />
</label>

            <label>
  Actual Reps
  <NumberRoller
    value={exercise.actual_reps}
    min={0}
    max={50}
    step={1}
    onChange={(value) =>
      updateLog(index, 'actual_reps', value)
    }
  />
</label>

            <label>
              Notes
              <textarea
                value={exercise.notes}
                onChange={(e) =>
                  updateLog(index, 'notes', e.target.value)
                }
              />
            </label>

            <label
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'center',
              }}
            >
              <input
                type="checkbox"
                checked={exercise.completed}
                onChange={(e) =>
                  updateLog(
                    index,
                    'completed',
                    e.target.checked
                  )
                }
              />

              Completed
            </label>
          </div>
        </section>
      ))}

      <button
        onClick={saveWorkout}
        disabled={saving}
        style={{
          padding: '16px 24px',
          borderRadius: 12,
          border: 'none',
          cursor: 'pointer',
        }}
      >
        {saving
          ? 'Saving Workout...'
          : saved
          ? 'Workout Saved'
          : 'Save Workout'}
      </button>
    </div>
  )
}
