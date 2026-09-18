'use client'

import { useMemo, useState } from 'react'

import WorkoutTracker from '@/components/WorkoutTracker'
import MuscleReadinessMap from '@/components/workout-dashboard/MuscleReadinessMap'
import {
  filterManualExercises,
  getAvailableEquipmentForMuscles,
  getAvailableMovementFamilies,
  getReadinessSummaryForCanonicalMuscle,
  normalizeEquipmentList,
  sortManualExercisesByReadiness,
  type ManualWorkoutExercise,
} from '@/lib/workout/manualWorkout'
import {
  MUSCLE_REGIONS,
  getMuscleIdsForExercise,
  type MuscleId,
  type MuscleReadiness,
} from '@/lib/workout/muscleReadiness'
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

type Step = 'muscle' | 'equipment' | 'movement' | 'exercise' | 'logging' | 'complete'

function titleCase(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function regionToMuscles(regionId: MuscleId | null): CanonicalMuscle[] {
  if (!regionId) return []
  return MUSCLE_REGIONS.find((region) => region.id === regionId)?.canonicalMuscles || []
}

function firstMuscleLabel(muscles: CanonicalMuscle[]) {
  return muscles[0] ? titleCase(muscles[0]) : 'Muscle'
}

function exerciseKey(exercise: ManualWorkoutExercise, index: number) {
  return `${exercise.id}:${exercise.selected_variant_id}:${index}`
}

function summarizeExercise(exercise: ManualWorkoutExercise) {
  const secondary = exercise.secondary_muscles?.slice(0, 2).map(titleCase).join(', ')
  return [
    exercise.movement_family_label,
    titleCase(exercise.selected_equipment),
    secondary ? `Secondary: ${secondary}` : null,
  ].filter(Boolean).join(' · ')
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
  const [step, setStep] = useState<Step>('muscle')
  const [selectedRegionId, setSelectedRegionId] = useState<MuscleId | null>(null)
  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(null)
  const [selectedMovementFamily, setSelectedMovementFamily] = useState<string | null>(null)
  const [activeExercise, setActiveExercise] = useState<ManualWorkoutExercise | null>(null)
  const [completedExercises, setCompletedExercises] = useState<ManualWorkoutExercise[]>([])

  const selectedMuscles = useMemo(() => regionToMuscles(selectedRegionId), [selectedRegionId])
  const primaryMuscle = selectedMuscles[0]
  const readinessSummary = primaryMuscle
    ? getReadinessSummaryForCanonicalMuscle(readiness, primaryMuscle)
    : null

  const availableEquipment = useMemo(() => {
    const derived = getAvailableEquipmentForMuscles(selectedMuscles)
    const member = normalizeEquipmentList(memberEquipment)
    if (!member.length || member.includes('*')) return derived
    const memberSet = new Set(member)
    const overlap = derived.filter((equipment) => memberSet.has(equipment))
    return overlap.length ? overlap : derived
  }, [memberEquipment, selectedMuscles])

  const movementFamilies = useMemo(() => {
    if (!selectedEquipment) return []
    return getAvailableMovementFamilies({
      muscles: selectedMuscles,
      equipment: [selectedEquipment],
    })
  }, [selectedEquipment, selectedMuscles])

  const exercises = useMemo(() => {
    if (!selectedEquipment || !selectedMovementFamily) return []
    const filtered = filterManualExercises({
      muscles: selectedMuscles,
      equipment: [selectedEquipment],
      movementFamily: selectedMovementFamily,
    })
    return sortManualExercisesByReadiness(filtered, readinessSummary?.state || 'unknown')
  }, [readinessSummary?.state, selectedEquipment, selectedMovementFamily, selectedMuscles])

  function resetSelection(nextStep: Step = 'muscle') {
    setSelectedRegionId(null)
    setSelectedEquipment(null)
    setSelectedMovementFamily(null)
    setActiveExercise(null)
    setStep(nextStep)
    onExerciseBlur?.()
  }

  function chooseRegion(regionId: MuscleId) {
    setSelectedRegionId(regionId)
    setSelectedEquipment(null)
    setSelectedMovementFamily(null)
    setActiveExercise(null)
    setStep('equipment')
  }

  function chooseEquipment(equipment: string) {
    setSelectedEquipment(equipment)
    setSelectedMovementFamily(null)
    setActiveExercise(null)
    setStep('movement')
  }

  function chooseMovement(family: string) {
    setSelectedMovementFamily(family)
    setActiveExercise(null)
    setStep('exercise')
  }

  function chooseExercise(exercise: ManualWorkoutExercise) {
    setActiveExercise({
      ...exercise,
      id: `${exercise.id}-${Date.now()}`,
    })
    setStep('logging')
  }

  function finishExercise() {
    if (activeExercise) {
      setCompletedExercises((previous) => [...previous, activeExercise])
    }
    setActiveExercise(null)
    setStep('complete')
    onExerciseBlur?.()
  }

  function finishWorkout() {
    resetSelection('complete')
  }

  if (step === 'logging' && activeExercise) {
    return (
      <div className="manual-workout-builder manual-workout-builder--logging" data-testid="manual-workout-builder">
        <WorkoutTracker
          key={exerciseKey(activeExercise, completedExercises.length)}
          clientId={clientId}
          authUserId={authUserId}
          program={program}
          dayName="Manual Workout"
          workoutSource="manual"
          plannedExercises={recommendedExercises}
          exercises={[activeExercise]}
          onExerciseFocus={(exercise) => onExerciseFocus?.(getMuscleIdsForExercise(exercise))}
          onExerciseBlur={onExerciseBlur}
          onManualExerciseFinished={finishExercise}
        />
      </div>
    )
  }

  return (
    <div className="manual-workout-builder" data-testid="manual-workout-builder">
      <div className="manual-workout-summary">
        <div>
          <p className="tier-dashboard-label">Manual Workout</p>
          <h3>{step === 'complete' ? 'Session in progress' : 'Choose from readiness'}</h3>
        </div>
        <small>Plan preserved: {recommendedDayName}</small>
      </div>

      {completedExercises.length ? (
        <ol className="manual-workout-list" data-testid="manual-workout-list">
          {completedExercises.map((exercise, index) => (
            <li key={`${exercise.id}-${index}`}>
              <span>{index + 1}</span>
              <div>
                <strong>{exercise.display_name}</strong>
                <small>{summarizeExercise(exercise)}</small>
              </div>
            </li>
          ))}
        </ol>
      ) : null}

      {step === 'muscle' || step === 'equipment' ? (
        <MuscleReadinessMap
          readiness={readiness}
          selectedMuscleId={selectedRegionId}
          onSelectMuscle={chooseRegion}
          heading="Choose muscle"
          eyebrow="Live Readiness Map"
        />
      ) : null}

      {selectedRegionId && readinessSummary ? (
        <section className="manual-readiness-context" data-testid="manual-readiness-context">
          <span>{firstMuscleLabel(selectedMuscles)}</span>
          <strong>{typeof readinessSummary.score === 'number' ? `${readinessSummary.score}% ready` : readinessSummary.label}</strong>
          <small>{readinessSummary.guidance}</small>
          {readinessSummary.reason ? <small>{readinessSummary.reason}</small> : null}
        </section>
      ) : null}

      {step === 'equipment' ? (
        <section className="manual-builder-section">
          <p className="manual-builder-label">Equipment</p>
          <div className="manual-equipment-row" data-testid="manual-equipment-filter">
            {availableEquipment.map((equipment) => (
              <button
                key={equipment}
                type="button"
                className={selectedEquipment === equipment ? 'is-selected' : ''}
                onClick={() => chooseEquipment(equipment)}
              >
                {titleCase(equipment)}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {step === 'movement' ? (
        <section className="manual-builder-section">
          <p className="manual-builder-label">Movement Family</p>
          <div className="manual-chip-grid manual-chip-grid--single" data-testid="manual-movement-filter">
            {movementFamilies.map((family) => (
              <button
                key={family.id}
                type="button"
                className={selectedMovementFamily === family.id ? 'is-selected' : ''}
                onClick={() => chooseMovement(family.id)}
              >
                <span>{family.label}</span>
                <small>{firstMuscleLabel(selectedMuscles)} · {titleCase(selectedEquipment || '')}</small>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {step === 'exercise' ? (
        <section className="manual-builder-section">
          <p className="manual-builder-label">Exercise</p>
          <div className="manual-exercise-results" data-testid="manual-exercise-results">
            {exercises.map((exercise) => (
              <article
                key={exercise.id}
                onMouseEnter={() => onExerciseFocus?.(getMuscleIdsForExercise(exercise))}
                onMouseLeave={onExerciseBlur}
                onFocus={() => onExerciseFocus?.(getMuscleIdsForExercise(exercise))}
                onBlur={onExerciseBlur}
              >
                <div>
                  <strong>{exercise.display_name}</strong>
                  <small>{summarizeExercise(exercise)}</small>
                  <small>{exercise.demand_profile === 'higher_loading' ? 'Higher training demand' : exercise.demand_profile === 'controlled' ? 'Controlled option' : 'Moderate demand'}</small>
                </div>
                <button type="button" onClick={() => chooseExercise(exercise)}>Open</button>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {step === 'complete' ? (
        <div className="manual-session-actions">
          <button type="button" className="manual-primary-button" onClick={() => resetSelection('muscle')}>
            Add another exercise
          </button>
          <button type="button" className="manual-secondary-button" onClick={finishWorkout}>
            Finish workout
          </button>
        </div>
      ) : null}

      {step !== 'muscle' && step !== 'complete' ? (
        <button type="button" className="manual-secondary-button" onClick={() => resetSelection('muscle')}>
          Back to readiness map
        </button>
      ) : null}
    </div>
  )
}
