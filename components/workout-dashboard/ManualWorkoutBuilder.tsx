'use client'

import { useMemo, useState } from 'react'

import WorkoutTracker from '@/components/WorkoutTracker'
import {
  MANUAL_WORKOUT_MUSCLES,
  filterManualExercises,
  getReadinessForCanonicalMuscle,
  normalizeEquipmentList,
  type ManualWorkoutExercise,
} from '@/lib/workout/manualWorkout'
import { getMuscleIdsForExercise, type MuscleId, type MuscleReadiness } from '@/lib/workout/muscleReadiness'
import type { CanonicalMuscle } from '@/lib/workout-os/types'

type Props = {
  clientId: string
  authUserId: string
  program: string
  recommendedDayName: string
  recommendedExercises: unknown[]
  memberEquipment: string[]
  readiness: MuscleReadiness[]
  onExerciseFocus?: (muscleIds: MuscleId[]) => void
  onExerciseBlur?: () => void
}

function titleCase(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function summarizeMuscles(exercise: ManualWorkoutExercise) {
  const primary = exercise.primary_muscles?.map(titleCase).join(', ') || 'General'
  const secondary = exercise.secondary_muscles?.slice(0, 3).map(titleCase).join(', ')
  return { primary, secondary }
}

function applySelectedEquipment(exercise: ManualWorkoutExercise, equipment: string[]): ManualWorkoutExercise {
  const normalized = normalizeEquipmentList(equipment)
  const variants = normalized.includes('*')
    ? exercise.available_variants
    : exercise.available_variants.filter((variant) =>
        normalized.some((item) => item === variant.equipment || item.includes(variant.equipment) || variant.equipment.includes(item)),
      )
  const availableVariants = variants.length ? variants : exercise.available_variants
  const selected = availableVariants[0] || exercise.available_variants[0]

  return {
    ...exercise,
    display_name: selected?.name || exercise.display_name,
    selected_variant_id: selected?.id || exercise.selected_variant_id,
    selected_variant_name: selected?.name || exercise.selected_variant_name,
    selected_equipment: selected?.equipment || exercise.selected_equipment,
    equipment: selected?.equipment || exercise.equipment,
    load_type: selected?.load_type || exercise.load_type,
    available_variants: availableVariants,
  }
}

export default function ManualWorkoutBuilder({
  clientId,
  authUserId,
  program,
  recommendedDayName,
  recommendedExercises,
  memberEquipment,
  readiness,
  onExerciseFocus,
  onExerciseBlur,
}: Props) {
  const savedEquipment = useMemo(() => normalizeEquipmentList(memberEquipment), [memberEquipment])
  const [selectedMuscles, setSelectedMuscles] = useState<CanonicalMuscle[]>([])
  const [temporaryEquipment, setTemporaryEquipment] = useState(savedEquipment)
  const [search, setSearch] = useState('')
  const [workout, setWorkout] = useState<ManualWorkoutExercise[]>([])

  const allEquipment = useMemo(() => {
    const fromResults = filterManualExercises({ muscles: [], equipment: ['*'] })
      .flatMap((exercise) => exercise.available_variants.map((variant) => variant.equipment))
    return Array.from(new Set([...savedEquipment.filter((item) => item !== '*'), ...fromResults])).sort()
  }, [savedEquipment])

  const results = useMemo(
    () => filterManualExercises({ muscles: selectedMuscles, equipment: temporaryEquipment, search }).slice(0, 18),
    [selectedMuscles, temporaryEquipment, search],
  )

  function toggleMuscle(muscle: CanonicalMuscle) {
    setSelectedMuscles((previous) =>
      previous.includes(muscle) ? previous.filter((item) => item !== muscle) : [...previous, muscle],
    )
  }

  function toggleEquipment(equipment: string) {
    setTemporaryEquipment((previous) => {
      const withoutAll = previous.filter((item) => item !== '*')
      const next = withoutAll.includes(equipment)
        ? withoutAll.filter((item) => item !== equipment)
        : [...withoutAll, equipment]
      return next.length ? next : ['bodyweight']
    })
  }

  function addExercise(exercise: ManualWorkoutExercise) {
    const prepared = applySelectedEquipment(exercise, temporaryEquipment)
    setWorkout((previous) => [
      ...previous,
      {
        ...prepared,
        id: `${prepared.id}-${previous.length + 1}`,
      },
    ])
  }

  function removeExercise(index: number) {
    setWorkout((previous) => previous.filter((_, currentIndex) => currentIndex !== index))
  }

  if (workout.length) {
    return (
      <div className="manual-workout-builder" data-testid="manual-workout-builder">
        <div className="manual-workout-summary">
          <div>
            <p className="tier-dashboard-label">Manual Workout</p>
            <h3>{workout.length} exercise{workout.length === 1 ? '' : 's'}</h3>
          </div>
          <button type="button" className="manual-secondary-button" onClick={() => setWorkout([])}>
            Clear
          </button>
        </div>
        <ol className="manual-workout-list" data-testid="manual-workout-list">
          {workout.map((exercise, index) => (
            <li key={`${exercise.id}-${index}`}>
              <span>{index + 1}</span>
              <div>
                <strong>{exercise.display_name}</strong>
                <small>{exercise.sets} x {exercise.reps} · {exercise.selected_equipment}</small>
              </div>
              <button type="button" onClick={() => removeExercise(index)}>Remove</button>
            </li>
          ))}
        </ol>
        <details className="manual-add-more">
          <summary>Add exercise</summary>
          <ManualExercisePicker
            selectedMuscles={selectedMuscles}
            toggleMuscle={toggleMuscle}
            readiness={readiness}
            allEquipment={allEquipment}
            temporaryEquipment={temporaryEquipment}
            toggleEquipment={toggleEquipment}
            search={search}
            setSearch={setSearch}
            results={results}
            addExercise={addExercise}
            onExerciseFocus={onExerciseFocus}
            onExerciseBlur={onExerciseBlur}
          />
        </details>
        <WorkoutTracker
          key={workout.map((exercise) => exercise.id).join('|')}
          clientId={clientId}
          authUserId={authUserId}
          program={program}
          dayName="Manual Workout"
          workoutSource="manual"
          plannedExercises={recommendedExercises}
          exercises={workout}
          onExerciseFocus={(exercise) => onExerciseFocus?.(getMuscleIdsForExercise(exercise))}
          onExerciseBlur={onExerciseBlur}
        />
      </div>
    )
  }

  return (
    <div className="manual-workout-builder" data-testid="manual-workout-builder">
      <div className="manual-workout-summary">
        <div>
          <p className="tier-dashboard-label">Manual</p>
          <h3>Build today&apos;s workout</h3>
        </div>
        <small>Recommendation preserved: {recommendedDayName}</small>
      </div>
      <ManualExercisePicker
        selectedMuscles={selectedMuscles}
        toggleMuscle={toggleMuscle}
        readiness={readiness}
        allEquipment={allEquipment}
        temporaryEquipment={temporaryEquipment}
        toggleEquipment={toggleEquipment}
        search={search}
        setSearch={setSearch}
        results={results}
        addExercise={addExercise}
        onExerciseFocus={onExerciseFocus}
        onExerciseBlur={onExerciseBlur}
      />
    </div>
  )
}

function ManualExercisePicker({
  selectedMuscles,
  toggleMuscle,
  readiness,
  allEquipment,
  temporaryEquipment,
  toggleEquipment,
  search,
  setSearch,
  results,
  addExercise,
  onExerciseFocus,
  onExerciseBlur,
}: {
  selectedMuscles: CanonicalMuscle[]
  toggleMuscle: (muscle: CanonicalMuscle) => void
  readiness: MuscleReadiness[]
  allEquipment: string[]
  temporaryEquipment: string[]
  toggleEquipment: (equipment: string) => void
  search: string
  setSearch: (value: string) => void
  results: ManualWorkoutExercise[]
  addExercise: (exercise: ManualWorkoutExercise) => void
  onExerciseFocus?: (muscleIds: MuscleId[]) => void
  onExerciseBlur?: () => void
}) {
  return (
    <>
      <div className="manual-builder-section">
        <p className="manual-builder-label">Muscle groups</p>
        <div className="manual-chip-grid" data-testid="manual-muscle-selector">
          {MANUAL_WORKOUT_MUSCLES.map((muscle) => {
            const state = getReadinessForCanonicalMuscle(readiness, muscle)
            return (
              <button
                key={muscle}
                type="button"
                className={selectedMuscles.includes(muscle) ? 'is-selected' : ''}
                onClick={() => toggleMuscle(muscle)}
              >
                <span>{titleCase(muscle)}</span>
                <small>{titleCase(state)}</small>
              </button>
            )
          })}
        </div>
      </div>
      <div className="manual-builder-section">
        <p className="manual-builder-label">Different equipment today</p>
        <div className="manual-equipment-row" data-testid="manual-equipment-filter">
          {allEquipment.map((equipment) => (
            <button
              key={equipment}
              type="button"
              className={temporaryEquipment.includes(equipment) || temporaryEquipment.includes('*') ? 'is-selected' : ''}
              onClick={() => toggleEquipment(equipment)}
            >
              {titleCase(equipment)}
            </button>
          ))}
        </div>
      </div>
      <label className="manual-search">
        <span>Search exercises</span>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search exercises..." />
      </label>
      <div className="manual-exercise-results" data-testid="manual-exercise-results">
        {results.length ? results.map((exercise) => {
          const muscles = summarizeMuscles(exercise)
          const equipment = Array.from(new Set(exercise.available_variants.map((variant) => variant.equipment))).map(titleCase).join(', ')
          return (
            <article
              key={exercise.id}
              onMouseEnter={() => onExerciseFocus?.(getMuscleIdsForExercise(exercise))}
              onMouseLeave={onExerciseBlur}
              onFocus={() => onExerciseFocus?.(getMuscleIdsForExercise(exercise))}
              onBlur={onExerciseBlur}
            >
              <div>
                <strong>{exercise.display_name}</strong>
                <small>Primary: {muscles.primary}</small>
                {muscles.secondary ? <small>Secondary: {muscles.secondary}</small> : null}
                <small>Equipment: {equipment}</small>
              </div>
              <button type="button" onClick={() => addExercise(exercise)}>Add</button>
            </article>
          )
        }) : <p className="tier-calendar-empty">No exercises match these filters.</p>}
      </div>
    </>
  )
}
