'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type ExerciseVariant = {
  id: string
  name: string
  equipment: string
  load_type: string
  equipment_modifier: number
}

type Exercise = {
  exercise?: string
  name?: string
  display_name?: string

  sets?: number | string

  reps?: number | string
  target_reps?: number
  recommended_reps?: number
  cycle_adjusted_reps?: number
  baseline_reps?: number

  calculated_weight?: number
  recommended_weight?: number
  cycle_adjusted_weight?: number
  baseline_weight?: number

  selected_variant_id?: string
  selected_variant_name?: string
  selected_equipment?: string
  load_type?: string
  available_variants?: ExerciseVariant[]

  cycle_adjustment_label?: string
  cycle_adjustment_note?: string
  cycle_caution_active?: boolean
  client_cues?: string[]
  rest_seconds?: number
  rpe_target?: string
}

type WorkoutLog = {
  exercise: string
  display_name: string

  selected_variant_id: string | null
  selected_variant_name: string
  selected_equipment: string | null
  load_type: string

  available_variants: ExerciseVariant[]

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
  client_cues: string[]
  rest_seconds: number | null
  rpe_target: string
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

function getDisplayName(exercise: Exercise) {
  return exercise.display_name || getExerciseName(exercise)
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

function roundTrainingWeight(weight: number) {
  if (!weight || Number.isNaN(weight)) return 0

  if (weight < 5) return Math.round(weight * 2) / 2
  if (weight < 20) return Math.round(weight)

  return Math.round(weight / 5) * 5
}

function getVariantAdjustedWeight({
  baselineWeight,
  variant,
}: {
  baselineWeight: number
  variant?: ExerciseVariant | null
}) {
  if (!variant) return roundTrainingWeight(baselineWeight)

  return roundTrainingWeight(
    baselineWeight * Number(variant.equipment_modifier || 1)
  )
}

function getLoadLabel(loadType: string) {
  switch (loadType) {
    case 'per_hand':
      return 'per hand'
    case 'single_side':
      return 'single side'
    case 'machine_total':
      return 'machine total'
    case 'band_tension':
      return 'band tension'
    case 'total_load':
    default:
      return 'total'
  }
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

  function setItemRef(key: string) {
    return (element: HTMLButtonElement | null): void => {
      itemRefs.current[key] = element
    }
  }

  useEffect(() => {
    const key = String(value)
    const current = itemRefs.current[key]

    if (current) {
      current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest',
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
          position: 'relative',
          height: '142px',
          overflowY: 'auto',
          scrollSnapType: 'y mandatory',
          WebkitOverflowScrolling: 'touch',
          borderRadius: '26px',
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0.045), rgba(255,255,255,0.025))',
          boxShadow:
            'inset 0 0 34px rgba(0,0,0,0.22), 0 16px 42px rgba(0,0,0,0.12)',
          padding: '46px 0',
        }}
      >
        <div
          style={{
            pointerEvents: 'none',
            position: 'sticky',
            top: '46px',
            height: '50px',
            marginTop: '-46px',
            borderTop: '1px solid rgba(181,110,67,0.28)',
            borderBottom: '1px solid rgba(181,110,67,0.28)',
            background: 'rgba(181,110,67,0.055)',
            zIndex: 1,
          }}
        />

        {options.map((option) => {
          const active = option === value

          return (
            <button
              key={option}
              ref={setItemRef(String(option))}
              type="button"
              onClick={() => onChange(option)}
              style={{
                position: 'relative',
                zIndex: 2,
                width: '100%',
                height: '50px',
                scrollSnapAlign: 'center',
                border: 'none',
                background: 'transparent',
                color: active
                  ? '#f5f0e8'
                  : 'rgba(215,199,182,0.44)',
                fontSize: active ? '1.35rem' : '1rem',
                fontFamily: 'inherit',
                cursor: 'pointer',
                transition: 'all 0.16s ease',
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

  function setCardRef(index: number) {
    return (element: HTMLDivElement | null): void => {
      cardRefs.current[index] = element
    }
  }

  const [activeIndex, setActiveIndex] = useState(0)

  const [logs, setLogs] = useState<WorkoutLog[]>(
    exercises.map((exercise) => {
      const recommendedWeight = getRecommendedWeight(exercise)
      const recommendedReps = getRecommendedReps(exercise)
      const baselineWeight = getBaselineWeight(exercise)
      const baselineReps = getBaselineReps(exercise)

      const availableVariants = exercise.available_variants || []
      const selectedVariant =
        availableVariants.find(
          (variant) => variant.id === exercise.selected_variant_id
        ) || availableVariants[0]

      return {
        exercise: getExerciseName(exercise),
        display_name: getDisplayName(exercise),

        selected_variant_id:
          selectedVariant?.id || exercise.selected_variant_id || null,
        selected_variant_name:
          selectedVariant?.name ||
          exercise.selected_variant_name ||
          getExerciseName(exercise),
        selected_equipment:
          selectedVariant?.equipment || exercise.selected_equipment || null,
        load_type:
          selectedVariant?.load_type || exercise.load_type || 'total_load',

        available_variants: availableVariants,

        planned_sets: Number(exercise.sets || 0),
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
        client_cues: (exercise.client_cues || []).slice(0,3),
        rest_seconds: exercise.rest_seconds || null,
        rpe_target: exercise.rpe_target || '',
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

  function changeVariant(index: number, variantId: string) {
    setLogs((prev) =>
      prev.map((log, i) => {
        if (i !== index) return log

        const selectedVariant = log.available_variants.find(
          (variant) => variant.id === variantId
        )

        if (!selectedVariant) return log

        const adjustedWeight = getVariantAdjustedWeight({
          baselineWeight: log.baseline_weight,
          variant: selectedVariant,
        })

        return {
          ...log,
          selected_variant_id: selectedVariant.id,
          selected_variant_name: selectedVariant.name,
          selected_equipment: selectedVariant.equipment,
          load_type: selectedVariant.load_type,
          planned_weight: adjustedWeight,
          actual_weight: adjustedWeight,
          notes: log.notes,
        }
      })
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
          const loadLabel = getLoadLabel(exercise.load_type)

          const weightOptions =
            exercise.planned_weight < 15
              ? [1, 2, 2.5, 5, 8, 10, 12, 15]
              : buildNumberOptions({
                  min: Math.max(0, exercise.planned_weight - 20),
                  max: exercise.planned_weight + 20,
                  step: 5,
                  includeValue: exercise.actual_weight,
                })

          const repOptions = buildNumberOptions({
            min: Math.max(0, exercise.planned_reps - 8),
            max: exercise.planned_reps + 8,
            step: 1,
            includeValue: exercise.actual_reps,
          })

          return (
            <section
              key={index}
              ref={setCardRef(index)}
              style={{
                flex: '0 0 min(86vw, 620px)',
                scrollSnapAlign: 'center',
                border: exercise.cycle_caution_active
                  ? '1px solid rgba(181,110,67,0.32)'
                  : '1px solid rgba(255,255,255,0.08)',
                borderRadius: '34px',
                padding: '32px',
                minHeight: '560px',
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
                    margin: '0 0 8px',
                    fontSize: 'clamp(1.8rem, 4vw, 2.8rem)',
                    lineHeight: 1.05,
                    fontWeight: 500,
                    letterSpacing: '-0.04em',
                    color: '#f5f0e8',
                  }}
                >
                  {exercise.display_name}
                </h3>

                <p
                  style={{
                    margin: '0 0 18px',
                    color: 'rgba(215,199,182,0.68)',
                    fontSize: '0.92rem',
                  }}
                >
                  Selected: {exercise.selected_variant_name}
                </p>
                {exercise.client_cues.length ? <ul className="workout-os-cues">{exercise.client_cues.map((cue)=><li key={cue}>{cue}</li>)}</ul> : null}
                {exercise.rpe_target || exercise.rest_seconds ? <p className="workout-os-dose">{exercise.rpe_target}{exercise.rpe_target?' · ':''}Rest until heart rate is below 115 bpm. If HR is unavailable, rest until breathing is controlled and you feel ready to repeat with good form.</p> : null}

                {exercise.available_variants.length > 1 && (
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
                      Equipment / Variation
                    </p>

                    <select
                      value={exercise.selected_variant_id || ''}
                      onChange={(event) =>
                        changeVariant(index, event.target.value)
                      }
                      style={{
                        width: '100%',
                        borderRadius: '999px',
                        border: '1px solid rgba(181,110,67,0.26)',
                        background: 'rgba(5,5,5,0.34)',
                        color: '#f5f0e8',
                        padding: '14px 16px',
                        marginBottom: '18px',
                        fontFamily: 'inherit',
                      }}
                    >
                      {exercise.available_variants.map((variant) => (
                        <option key={variant.id} value={variant.id}>
                          {variant.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

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
                    {exercise.planned_weight} lbs {loadLabel}
                  </p>

                  <p style={{ margin: 0, opacity: 0.72 }}>
                    <strong>Program baseline:</strong>{' '}
                    {exercise.planned_sets} sets · {exercise.baseline_reps} reps ·{' '}
                    {exercise.baseline_weight} lbs before equipment conversion
                  </p>

                  {exercise.load_type === 'per_hand' && (
                    <p style={{ margin: 0, opacity: 0.72 }}>
                      Dumbbell load is shown per hand. It is intentionally not
                      calculated by simply dividing a barbell load in half.
                    </p>
                  )}
                </div>

                <div
                  style={{
                    display: 'grid',
                    gap: '18px',
                    marginTop: '18px',
                  }}
                >
                  <ScrollPicker
                    label={`Actual Weight (${loadLabel})`}
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
