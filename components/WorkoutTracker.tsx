'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Exercise = {
  exercise?: string
  name?: string

  sets?: number

  reps?: number
  target_reps?: number
  recommended_reps?: number
  cycle_adjusted_reps?: number
  baseline_reps?: number

  calculated_weight?: number
  recommended_weight?: number
  cycle_adjusted_weight?: number
  baseline_weight?: number

  cycle_adjustment_label?: string
  cycle_adjustment_note?: string
  cycle_caution_active?: boolean
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

function getExerciseName(exercise: Exercise) {
  return exercise.exercise || exercise.name || 'Exercise'
}

function getRecommendedWeight(exercise: Exercise) {
  return Number(
    exercise.recommended_weight ||
      exercise.cycle_adjusted_weight ||
      exercise.calculated_weight ||
      exercise.baseline_weight ||
      0
  )
}

function getRecommendedReps(exercise: Exercise) {
  return Number(
    exercise.recommended_reps ||
      exercise.cycle_adjusted_reps ||
      exercise.reps ||
      exercise.target_reps ||
      exercise.baseline_reps ||
      0
  )
}

function getBaselineWeight(exercise: Exercise) {
  return Number(
    exercise.baseline_weight ||
      exercise.calculated_weight ||
      exercise.recommended_weight ||
      0
  )
}

function getBaselineReps(exercise: Exercise) {
  return Number(
    exercise.baseline_reps ||
      exercise.reps ||
      exercise.target_reps ||
      exercise.recommended_reps ||
      0
  )
}

export default function WorkoutTracker({
  clientId,
  authUserId,
  program,
  dayName,
  exercises,
}: Props) {
  const router = useRouter()

  const [logs, setLogs] = useState(
    exercises.map((exercise) => {
      const recommendedWeight = getRecommendedWeight(exercise)
      const recommendedReps = getRecommendedReps(exercise)
      const baselineWeight = getBaselineWeight(exercise)
      const baselineReps = getBaselineReps(exercise)

      return {
        exercise: getExerciseName(exercise),

        planned_sets: exercise.sets || 0,

        planned_reps: recommendedReps,
        planned_weight: recommendedWeight,

        baseline_reps: baselineReps,
        baseline_weight: baselineWeight,

        actual_weight: recommendedWeight,
        actual_reps: recommendedReps,

        cycle_adjustment_label:
          exercise.cycle_adjustment_label || 'Baseline training load',
        cycle_adjustment_note: exercise.cycle_adjustment_note || '',
        cycle_caution_active: !!exercise.cycle_caution_active,

        completed: false,
        notes: '',
      }
    })
  )

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  function updateLog(index: number, field: string, value: any) {
    setLogs((prev) =>
      prev.map((log, i) =>
        i === index ? { ...log, [field]: value } : log
      )
    )
  }

  async function saveWorkout() {
    try {
      setSaving(true)

      const completedLogs = logs.map((log) => ({
        ...log,
        completed: true,
      }))

      const response = await fetch('/api/workout-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          auth_user_id: authUserId,
          program,
          day_name: dayName,
          workout_date: new Date().toISOString(),
          exercise_logs: completedLogs,
          completed: true,
        }),
      })

      if (!response.ok) {
        throw new Error('Workout save failed')
      }

      setLogs(completedLogs)
      setSaved(true)
      router.push('/dashboard')
      router.refresh()
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
            border: exercise.cycle_caution_active
              ? '1px solid rgba(181,110,67,0.32)'
              : '1px solid rgba(255,255,255,0.1)',
            borderRadius: 18,
            padding: 22,
            background: exercise.cycle_caution_active
              ? 'rgba(181,110,67,0.08)'
              : 'rgba(255,255,255,0.03)',
          }}
        >
          <h3
            style={{
              margin: '0 0 10px',
              fontSize: '1.25rem',
              fontWeight: 500,
              color: '#f5f0e8',
            }}
          >
            {exercise.exercise}
          </h3>

          <p
            style={{
              margin: '0 0 8px',
              color: 'rgba(197,139,87,0.95)',
              fontSize: '0.9rem',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            {exercise.cycle_adjustment_label}
          </p>

          {exercise.cycle_adjustment_note ? (
            <p
              style={{
                margin: '0 0 16px',
                color: 'rgba(215,199,182,0.78)',
                lineHeight: 1.65,
              }}
            >
              {exercise.cycle_adjustment_note}
            </p>
          ) : null}

          <div
            style={{
              display: 'grid',
              gap: '10px',
              marginBottom: '18px',
              color: '#d7c7b6',
              lineHeight: 1.65,
            }}
          >
            <p style={{ margin: 0 }}>
              <strong>Recommended today:</strong>{' '}
              {exercise.planned_sets} sets · {exercise.planned_reps} reps ·{' '}
              {exercise.planned_weight} lbs
            </p>

            <p style={{ margin: 0, opacity: 0.72 }}>
              <strong>Program baseline:</strong>{' '}
              {exercise.planned_sets} sets · {exercise.baseline_reps} reps ·{' '}
              {exercise.baseline_weight} lbs
            </p>
          </div>

          <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
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
                style={{
                  width: '100%',
                  marginTop: '8px',
                }}
              />
            </label>

            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={exercise.completed}
                onChange={(e) =>
                  updateLog(index, 'completed', e.target.checked)
                }
                style={{ accentColor: '#b56e43' }}
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
          borderRadius: 999,
          border: 'none',
          cursor: 'pointer',
          background:
            'linear-gradient(180deg, rgba(181,110,67,0.58), rgba(120,72,44,0.46))',
          color: '#f5f0e8',
          fontSize: '1rem',
        }}
      >
        {saving ? 'Saving Workout...' : saved ? 'Workout Saved' : 'Save Workout'}
      </button>
    </div>
  )
}
