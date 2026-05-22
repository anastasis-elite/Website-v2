'use client'

import { useEffect, useRef, useState } from 'react'
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

type WorkoutLog = {
  exercise: string
  planned_sets: number
  planned_reps: number
  planned_weight: number
  baseline_reps: number
  baseline_weight: number
  actual_weight: number
  actual_reps: number
  cycle_adjustment_label: string
  cycle_adjustment_note: string
  cycle_caution_active: boolean
  completed: boolean
  notes: string
}

type Props = {
  clientId: string
  authUserId: string
  program: string
  dayName: string
  exercises: Exercise[]
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

function buildNumberOptions({
  min,
  max,
  step,
  includeValue,
}: {
  min: number
  max: number
  step: number
  includeValue?: number
}) {
  const options: number[] = []

  for (let i = min; i <= max; i += step) {
    options.push(Number(i.toFixed(1)))
  }

  if (
    typeof includeValue === 'number' &&
    !options.includes(includeValue)
  ) {
    options.push(includeValue)
  }

  return options.sort((a, b) => a - b)
}

function ScrollPicker({
  label,
  value,
  options,
  onChange,
  suffix = '',
}: {
  label: string
  value: number
  options: number[]
  onChange: (value: number) => void
  suffix?: string
}) {
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  useEffect(() => {
    const key = String(value)
    const current = itemRefs.current[key]

    if (current) {
      current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      })
    }
  }, [value])

  return (
    <div>
      <p
        style={{
          margin: '0 0 8px',
          color: 'rgba(215,199,182,0.72)',
          fontSize: '0.78rem',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </p>

      <div
        style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          padding: '4px 2px 10px',
        }}
      >
        {options.map((option) => {
          const active = option === value

          return (
            <button
              key={option}
              ref={(element) => {
                itemRefs.current[String(option)] = element
              }}
              type="button"
              onClick={() => onChange(option)}
              style={{
                flex: '0 0 auto',
                scrollSnapAlign: 'center',
                border: active
                  ? '1px solid rgba(181,110,67,0.52)'
                  : '1px solid rgba(181,110,67,0.16)',
                borderRadius: '999px',
                padding: '10px 14px',
                minWidth: '64px',
                background: active
                  ? 'rgba(181,110,67,0.16)'
                  : 'rgba(255,255,255,0.035)',
                color: active
                  ? '#f5f0e8'
                  : 'rgba(215,199,182,0.76)',
                cursor: 'pointer',
                fontSize: active ? '1rem' : '0.92rem',
                transform: active ? 'scale(1.03)' : 'scale(1)',
                transition: 'all 0.18s ease',
              }}
            >
              {option}
              {suffix}
            </button>
          )
        })}
      </div>
    </div>
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
  const cardRefs = useRef<Record<number, HTMLDivElement | null>>({})

  const [activeIndex, setActiveIndex] = useState(0)

  const [logs, setLogs] = useState<WorkoutLog[]>(
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

  function updateLog(index: number, field: keyof WorkoutLog, value: any) {
    setLogs((prev) =>
      prev.map((log, i) =>
        i === index ? { ...log, [field]: value } : log
      )
    )
  }

  function scrollToExercise(index: number) {
    const card = cardRefs.current[index]

    if (card) {
      card.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      })
    }

    setActiveIndex(index)
  }

  function goNext() {
    const nextIndex = Math.min(activeIndex + 1, logs.length - 1)
    scrollToExercise(nextIndex)
  }

  function goBack() {
    const previousIndex = Math.max(activeIndex - 1, 0)
    scrollToExercise(previousIndex)
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
    <div>
      <div
        style={{
          display: 'flex',
          gap: '8px',
          justifyContent: 'center',
          marginBottom: '18px',
        }}
      >
        {logs.map((_, index) => (
          <button
            key={index}
            type="button"
            onClick={() => scrollToExercise(index)}
            style={{
              width: index === activeIndex ? '24px' : '8px',
              height: '8px',
              borderRadius: '999px',
              border: 'none',
              background:
                index === activeIndex
                  ? 'rgba(181,110,67,0.9)'
                  : 'rgba(215,199,182,0.28)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            aria-label={`Go to exercise ${index + 1}`}
          />
        ))}
      </div>

      <div
        style={{
          display: 'flex',
          gap: '22px',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          padding: '8px 4px 28px',
          WebkitOverflowScrolling: 'touch',
        }}
        onScroll={(event) => {
          const container = event.currentTarget
          const containerCenter =
            container.scrollLeft + container.offsetWidth / 2

          let nearestIndex = 0
          let nearestDistance = Number.POSITIVE_INFINITY

          Object.entries(cardRefs.current).forEach(([key, element]) => {
            if (!element) return

            const elementCenter =
              element.offsetLeft + element.offsetWidth / 2

            const distance = Math.abs(containerCenter - elementCenter)

            if (distance < nearestDistance) {
              nearestDistance = distance
              nearestIndex = Number(key)
            }
          })

          setActiveIndex(nearestIndex)
        }}
      >
        {logs.map((exercise, index) => {
          const weightOptions = buildNumberOptions({
            min: exercise.planned_weight < 15 ? 1 : 0,
            max: Math.max(100, exercise.planned_weight + 100),
            step: exercise.planned_weight < 15 ? 0.5 : 5,
            includeValue: exercise.actual_weight,
          })

          const repOptions = buildNumberOptions({
            min: 0,
            max: Math.max(30, exercise.planned_reps + 15),
            step: 1,
            includeValue: exercise.actual_reps,
          })

          return (
            <section
              key={index}
              ref={(element) => {
                cardRefs.current[index] = element
              }}
              style={{
                flex: '0 0 min(86vw, 620px)',
                scrollSnapAlign: 'center',
                border: exercise.cycle_caution_active
                  ? '1px solid rgba(181,110,67,0.32)'
                  : '1px solid rgba(255,255,255,0.08)',
                borderRadius: '34px',
                padding: '32px',
                minHeight: '520px',
                background: exercise.cycle_caution_active
                  ? 'rgba(181,110,67,0.08)'
                  : 'rgba(18,18,18,0.48)',
                boxShadow:
                  '0 24px 80px rgba(0,0,0,0.18), inset 0 0 30px rgba(255,255,255,0.012)',
                backdropFilter: 'blur(18px)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <p
                  style={{
                    margin: '0 0 14px',
                    color: 'rgba(197,139,87,0.95)',
                    fontSize: '0.74rem',
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                  }}
                >
                  Exercise {index + 1} of {logs.length}
                </p>

                <h3
                  style={{
                    margin: '0 0 12px',
                    fontSize: 'clamp(1.8rem, 4vw, 2.8rem)',
                    lineHeight: 1.05,
                    fontWeight: 500,
                    letterSpacing: '-0.04em',
                    color: '#f5f0e8',
                  }}
                >
                  {exercise.exercise}
                </h3>

                <p
                  style={{
                    margin: '0 0 10px',
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
                      margin: '0 0 20px',
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
                    marginBottom: '24px',
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

                <div
                  style={{
                    display: 'grid',
                    gap: '18px',
                    marginTop: '18px',
                  }}
                >
                  <ScrollPicker
                    label="Actual Weight"
                    value={exercise.actual_weight}
                    options={weightOptions}
                    suffix=" lb"
                    onChange={(value) =>
                      updateLog(index, 'actual_weight', value)
                    }
                  />

                  <ScrollPicker
                    label="Actual Reps"
                    value={exercise.actual_reps}
                    options={repOptions}
                    onChange={(value) =>
                      updateLog(index, 'actual_reps', value)
                    }
                  />

                  <label>
                    <p
                      style={{
                        margin: '0 0 8px',
                        color: 'rgba(215,199,182,0.72)',
                        fontSize: '0.78rem',
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                      }}
                    >
                      Notes
                    </p>

                    <textarea
                      value={exercise.notes}
                      onChange={(e) =>
                        updateLog(index, 'notes', e.target.value)
                      }
                      style={{
                        width: '100%',
                        marginTop: '4px',
                      }}
                      placeholder="Anything to note for this exercise?"
                    />
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      gap: 8,
                      alignItems: 'center',
                      color: 'rgba(215,199,182,0.86)',
                    }}
                  >
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
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: '12px',
                  justifyContent: 'space-between',
                  marginTop: '30px',
                }}
              >
                <button
                  type="button"
                  onClick={goBack}
                  disabled={index === 0}
                  style={{
                    borderRadius: '999px',
                    border: '1px solid rgba(181,110,67,0.24)',
                    background: 'rgba(181,110,67,0.055)',
                    color: '#f5f0e8',
                    padding: '12px 18px',
                    cursor: index === 0 ? 'default' : 'pointer',
                    opacity: index === 0 ? 0.4 : 1,
                  }}
                >
                  Back
                </button>

                {index < logs.length - 1 ? (
                  <button
                    type="button"
                    onClick={goNext}
                    style={{
                      borderRadius: '999px',
                      border: 'none',
                      background:
                        'linear-gradient(180deg, rgba(181,110,67,0.58), rgba(120,72,44,0.46))',
                      color: '#f5f0e8',
                      padding: '12px 18px',
                      cursor: 'pointer',
                    }}
                  >
                    Next Exercise
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={saveWorkout}
                    disabled={saving}
                    style={{
                      borderRadius: '999px',
                      border: 'none',
                      background:
                        'linear-gradient(180deg, rgba(181,110,67,0.58), rgba(120,72,44,0.46))',
                      color: '#f5f0e8',
                      padding: '12px 18px',
                      cursor: 'pointer',
                      opacity: saving ? 0.65 : 1,
                    }}
                  >
                    {saving
                      ? 'Saving...'
                      : saved
                      ? 'Workout Saved'
                      : 'Save Workout'}
                  </button>
                )}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
