'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
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
  getBilateralMuscleIds,
  getMuscleIdsForExercise,
  type MuscleId,
  type MuscleReadiness,
} from '@/lib/workout/muscleReadiness'
import type { CanonicalMuscle } from '@/lib/workout-os/types'
import type { SelectedExercisePrescription } from '@/lib/workout/selectedPrescriptionTypes'
import { getClientLocalDate } from '@/lib/timezone'
import styles from './ManualSelectionDialog.module.css'

type Props = {
  clientId: string
  authUserId: string
  program: string
  timezone?: string
  weightUnit?: 'lb' | 'kg'
  recommendedDayName: string
  recommendedExercises: unknown[]
  memberEquipment: string[]
  readiness: MuscleReadiness[]
  trackingOnly?: boolean
  onExerciseFocus?: (muscleIds: MuscleId[]) => void
  onExerciseBlur?: () => void
}

type Step = 'muscle' | 'equipment' | 'exercise' | 'logging' | 'complete'
type ActiveExercise = ManualWorkoutExercise & {
  catalogExerciseId?: string
  prescription?: Readonly<SelectedExercisePrescription>
  recommendationStatus?: 'available' | 'unavailable' | 'tracking_only'
  recommendationMessage?: string
  recommendationSetupHref?: string
}

function titleCase(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}
function regionToMuscles(regionId: MuscleId | null): CanonicalMuscle[] {
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
  return [exercise.movement_family_label, titleCase(exercise.selected_equipment), secondary ? `Secondary: ${secondary}` : null].filter(Boolean).join(' · ')
}
function internalSetupHref(value: unknown) {
  return typeof value === 'string' && value.startsWith('/dashboard/') ? value : undefined
}
function confirmedPrescription(value: any, exerciseId: string, variantId: string): value is SelectedExercisePrescription {
  return value && value.exerciseId === exerciseId && value.variantId === variantId &&
    Number.isInteger(value.sets) && value.sets > 0 && Number.isInteger(value.reps) && value.reps > 0 &&
    typeof value.weightLb === 'number' && Number.isFinite(value.weightLb) && value.weightLb >= 0 &&
    typeof value.loadType === 'string' && value.version === 'founder-selected-v1'
}

export default function ManualWorkoutBuilder({
  clientId, authUserId, program, timezone, weightUnit, recommendedDayName, recommendedExercises,
  memberEquipment, readiness, trackingOnly = false, onExerciseFocus, onExerciseBlur,
}: Props) {
  const [step, setStep] = useState<Step>('muscle')
  const [selectedRegionId, setSelectedRegionId] = useState<MuscleId | null>(null)
  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(null)
  const [selectedMovementFamily, setSelectedMovementFamily] = useState<string | null>(null)
  const [activeExercise, setActiveExercise] = useState<ActiveExercise | null>(null)
  const [completedExercises, setCompletedExercises] = useState<Array<ActiveExercise & { completion_status?: string }>>([])
  const [restoredDraftKey, setRestoredDraftKey] = useState<string | null>(null)
  const [draftMessage, setDraftMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectionError, setSelectionError] = useState('')
  const [blocked, setBlocked] = useState(false)
  const [setupHref, setSetupHref] = useState<string | undefined>()
  const [pendingExercise, setPendingExercise] = useState<ManualWorkoutExercise | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const dialogHeading = useRef<HTMLHeadingElement>(null)
  const trigger = useRef<HTMLElement | SVGElement | null>(null)
  const requestRevision = useRef(0)
  const request = useRef<AbortController | null>(null)
  const mounted = useRef(true)
  const dialogId = useId()
  const draftKey = `aos-manual-builder:v1:${clientId}:${program}:${getClientLocalDate({ timezone })}`
  const contextKey = `${authUserId}:${draftKey}`
  const currentContext = useRef(contextKey)
  currentContext.current = contextKey
  const draftLoaded = restoredDraftKey === draftKey

  function invalidateRequest() {
    requestRevision.current++
    request.current?.abort()
    request.current = null
  }
  useEffect(() => {
    mounted.current = true
    invalidateRequest()
    dialog.current?.close()
    setLoading(false); setSelectionError(''); setBlocked(false); setSetupHref(undefined); setPendingExercise(null)
    setStep('muscle'); setActiveExercise(null); setCompletedExercises([])
    setSelectedRegionId(null); setSelectedEquipment(null); setSelectedMovementFamily(null); setDraftMessage('')
    try {
      const saved = JSON.parse(localStorage.getItem(draftKey) || 'null')
      if (saved?.version === 1) {
        const active = saved.activeExercise
        const validActive = active && typeof active.id === 'string' && typeof active.exercise === 'string' && Array.isArray(active.available_variants)
        setCompletedExercises(Array.isArray(saved.completedExercises) ? saved.completedExercises.slice(0, 100).filter((exercise: any) => exercise && typeof exercise.exercise === 'string') : [])
        if (validActive) {
          const restored = { ...active }
          if (active.prescription) restored.prescription = Object.freeze({ ...active.prescription })
          if (!active.recommendationStatus) {
            restored.recommendationStatus = trackingOnly ? 'tracking_only' : 'unavailable'
            restored.recommendationMessage = 'Recommendation unavailable for this restored draft. Your saved entries are retained.'
          }
          setActiveExercise(restored); setStep('logging')
        } else setStep(saved.completedExercises?.length ? 'complete' : 'muscle')
      }
    } catch { /* A damaged local draft must not prevent a new manual workout. */ }
    setRestoredDraftKey(draftKey)
    return () => { mounted.current = false; invalidateRequest() }
  }, [draftKey, authUserId, trackingOnly])
  useEffect(() => {
    if (!draftLoaded) return
    try { localStorage.setItem(draftKey, JSON.stringify({ version: 1, activeExercise, completedExercises })) }
    catch { setDraftMessage('This browser could not retain the manual workout view. Your saved sets remain in workout history.') }
  }, [draftKey, draftLoaded, activeExercise, completedExercises])

  const selectedMuscles = useMemo(() => regionToMuscles(selectedRegionId), [selectedRegionId])
  const primaryMuscle = selectedMuscles[0]
  const readinessSummary = primaryMuscle ? getReadinessSummaryForCanonicalMuscle(readiness, primaryMuscle) : null
  const availableEquipment = useMemo(() => {
    const derived = getAvailableEquipmentForMuscles(selectedMuscles)
    const member = normalizeEquipmentList(memberEquipment)
    if (!member.length || member.includes('*')) return derived
    const memberSet = new Set(member)
    const overlap = derived.filter((equipment) => memberSet.has(equipment))
    // Preserve the existing fallback without adding equipment or catalog entries.
    return overlap.length ? overlap : derived
  }, [memberEquipment, selectedMuscles])
  const movementFamilies = useMemo(() => selectedEquipment ? getAvailableMovementFamilies({ muscles: selectedMuscles, equipment: [selectedEquipment] }) : [], [selectedEquipment, selectedMuscles])
  const exercises = useMemo(() => {
    if (!selectedEquipment) return []
    return sortManualExercisesByReadiness(filterManualExercises({ muscles: selectedMuscles, equipment: [selectedEquipment], movementFamily: selectedMovementFamily }), readinessSummary?.state || 'unknown')
  }, [readinessSummary?.state, selectedEquipment, selectedMovementFamily, selectedMuscles])

  function clearPending() {
    invalidateRequest(); setLoading(false); setSelectionError(''); setBlocked(false); setSetupHref(undefined); setPendingExercise(null)
  }
  function resetSelection(nextStep: Step = 'muscle') {
    clearPending(); dialog.current?.close()
    setSelectedRegionId(null); setSelectedEquipment(null); setSelectedMovementFamily(null); setActiveExercise(null)
    setStep(nextStep); onExerciseBlur?.()
  }
  function dismissSelection() {
    clearPending(); dialog.current?.close(); setStep('muscle')
    setSelectedRegionId(null); setSelectedEquipment(null); setSelectedMovementFamily(null)
    onExerciseBlur?.()
  }
  function chooseRegion(regionId: MuscleId) {
    clearPending()
    trigger.current = document.activeElement as HTMLElement | SVGElement | null
    setSelectedRegionId(regionId); setSelectedEquipment(null); setSelectedMovementFamily(null); setStep('equipment')
    onExerciseFocus?.(getBilateralMuscleIds(regionId))
    dialog.current?.showModal(); dialogHeading.current?.focus()
  }
  function chooseEquipment(equipment: string) {
    clearPending(); setSelectedEquipment(equipment); setSelectedMovementFamily(null); setStep('exercise')
  }
  function changeEquipment() {
    clearPending(); setSelectedEquipment(null); setSelectedMovementFamily(null); setStep('equipment')
  }
  function commitExercise(exercise: ManualWorkoutExercise, status: 'available' | 'unavailable' | 'tracking_only', message?: string, prescription?: SelectedExercisePrescription, href?: string) {
    const variant = exercise.available_variants.find(item => item.equipment === selectedEquipment)
    if (!variant) { setSelectionError('This equipment option is no longer available. Choose equipment again.'); return }
    const selected: ActiveExercise = {
      ...exercise, id: `${exercise.id}:${crypto.randomUUID()}`, catalogExerciseId: exercise.id,
      selected_variant_id: variant.id, selected_variant_name: variant.name,
      selected_equipment: variant.equipment, equipment: variant.equipment, load_type: variant.load_type,
      recommendationStatus: status, recommendationMessage: message, recommendationSetupHref: href,
    }
    // Catalog browsing defaults are not a personalized prescription.
    for (const field of ['sets', 'reps', 'target_reps', 'recommended_reps', 'baseline_reps', 'calculated_weight', 'recommended_weight', 'baseline_weight', 'rpe_target']) delete selected[field]
    if (prescription) {
      selected.prescription = Object.freeze({ ...prescription })
      Object.assign(selected, { sets: prescription.sets, reps: prescription.reps, recommended_reps: prescription.reps,
        baseline_reps: prescription.reps, recommended_weight: prescription.weightLb, calculated_weight: prescription.weightLb,
        baseline_weight: prescription.weightLb, load_type: prescription.loadType, weight_unit: 'lb' })
    }
    clearPending(); dialog.current?.close(); setActiveExercise(selected); setStep('logging')
  }
  async function chooseExercise(exercise: ManualWorkoutExercise) {
    const variant = exercise.available_variants.find(item => item.equipment === selectedEquipment)
    if (!variant) { setSelectionError('This equipment option is no longer available. Choose equipment again.'); return }
    clearPending(); setPendingExercise(exercise)
    if (trackingOnly) { commitExercise(exercise, 'tracking_only', 'Manual logging without coaching guidance.'); return }
    const revision = requestRevision.current, startedContext = currentContext.current
    const controller = new AbortController(); request.current = controller; setLoading(true)
    const current = () => mounted.current && requestRevision.current === revision && currentContext.current === startedContext
    try {
      const response = await fetch('/api/workout/prescription', { method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ exerciseId: exercise.id, variantId: variant.id }), signal: controller.signal })
      const result = await response.json().catch(() => null)
      if (!current()) return
      const href = internalSetupHref(result?.setupHref)
      if (result?.status === 'blocked') {
        setBlocked(true); setSetupHref(href); setSelectionError(result.message || 'Recommendation unavailable. Review the available guidance before continuing.'); return
      }
      if (!response.ok || !result) throw new Error('request_failed')
      if (result.status === 'available' && confirmedPrescription(result.prescription, exercise.id, variant.id)) {
        commitExercise(exercise, 'available', result.message, result.prescription); return
      }
      if (result.status === 'unavailable' || result.status === 'tracking_only') {
        commitExercise(exercise, result.status, result.message || 'Recommendation unavailable.', undefined, href); return
      }
      throw new Error('unconfirmed')
    } catch {
      if (current()) { setSelectionError('Recommendation could not be loaded. Retry, or continue with manual logging without guidance.'); setBlocked(false) }
    } finally { if (current()) { setLoading(false); request.current = null } }
  }
  function finishExercise(completed = true) {
    if (activeExercise) setCompletedExercises(previous => [...previous, { ...activeExercise, completion_status: completed ? 'Complete' : 'Partial exercise saved' }])
    setActiveExercise(null); setStep('complete'); onExerciseBlur?.()
  }

  if (!draftLoaded) return <p role="status">Loading your manual workout view…</p>

  return <div className={`manual-workout-builder${step === 'logging' ? ' manual-workout-builder--logging' : ''}`} data-testid="manual-workout-builder">
    {draftMessage ? <p role="status">{draftMessage}</p> : null}
    {step === 'logging' && activeExercise ? <WorkoutTracker
      key={`${draftKey}:${exerciseKey(activeExercise, completedExercises.length)}`}
      clientId={clientId} authUserId={authUserId} program={program} timezone={timezone} weightUnit={weightUnit}
      dayName="Manual Workout" workoutSource="manual" plannedExercises={recommendedExercises} exercises={[activeExercise]}
      onExerciseFocus={exercise => onExerciseFocus?.(getMuscleIdsForExercise(exercise))} onExerciseBlur={onExerciseBlur}
      onManualExerciseFinished={finishExercise}
      onManualRecommendationReset={() => resetSelection('muscle')}
    /> : <>
      <div className="manual-workout-summary"><div><p className="tier-dashboard-label">Manual Workout</p>
        <h3>{step === 'complete' ? 'Session in progress' : trackingOnly ? 'Choose an exercise to log' : 'Choose from readiness'}</h3>
      </div>{!trackingOnly ? <small>Plan preserved: {recommendedDayName}</small> : null}</div>
      {completedExercises.length ? <ol className="manual-workout-list" data-testid="manual-workout-list">
        {completedExercises.map((exercise, index) => <li key={`${exercise.id}-${index}`}><span>{index + 1}</span><div>
          <strong>{exercise.display_name}</strong><small>{String(exercise.completion_status || 'Saved')} · {summarizeExercise(exercise)}</small>
        </div></li>)}
      </ol> : null}
      {step !== 'complete' ? <MuscleReadinessMap readiness={readiness} selectedMuscleId={selectedRegionId} bilateralSelection
        onSelectMuscle={chooseRegion} heading="Choose muscle" eyebrow={trackingOnly ? 'Manual selection' : 'Readiness from your logs'} /> : null}
      {step === 'complete' ? <div className="manual-session-actions">
        <button type="button" className="manual-primary-button" onClick={() => resetSelection('muscle')}>Add another exercise</button>
        <button type="button" className="manual-secondary-button" onClick={() => resetSelection('complete')}>Finish workout</button>
      </div> : null}
    </>}

    <dialog id={dialogId} ref={dialog} className={styles.dialog} aria-labelledby={`${dialogId}-title`} aria-describedby={`${dialogId}-description`}
      onCancel={event => { event.preventDefault(); dismissSelection() }} onClose={() => trigger.current?.focus()}>
      <header className={styles.header}><h2 ref={dialogHeading} tabIndex={-1} id={`${dialogId}-title`}>{firstMuscleLabel(selectedMuscles)} · {step === 'equipment' ? 'Choose equipment' : 'Choose exercise'}</h2>
        <button type="button" className="manual-secondary-button" onClick={dismissSelection}>Close</button>
      </header>
      <p id={`${dialogId}-description`}>Choose available equipment, then an exercise. Both matching sides stay selected; record one weight for the exercise.</p>
      {!trackingOnly && readinessSummary ? <section className="manual-readiness-context" data-testid="manual-readiness-context">
        <span>{firstMuscleLabel(selectedMuscles)}</span><strong>{readinessSummary.label}</strong><small>{readinessSummary.guidance}</small>
        {readinessSummary.reason ? <small>{readinessSummary.reason}</small> : null}
      </section> : null}
      {step === 'equipment' ? <section className="manual-builder-section"><p className="manual-builder-label">Equipment</p>
        <div className="manual-equipment-row" data-testid="manual-equipment-filter">
          {availableEquipment.map(equipment => <button key={equipment} type="button" onClick={() => chooseEquipment(equipment)}>{titleCase(equipment)}</button>)}
        </div>{availableEquipment.length ? null : <p role="status">No supported equipment options are available for this muscle.</p>}
      </section> : null}
      {step === 'exercise' ? <section className="manual-builder-section" aria-busy={loading}>
        <button type="button" className="manual-secondary-button" onClick={changeEquipment}>Back · change equipment</button>
        <p className="manual-builder-label">{titleCase(selectedEquipment || '')} exercises</p>
        <label className={styles.filter}>Movement family (optional)<select value={selectedMovementFamily || ''} data-testid="manual-movement-filter" disabled={loading}
          onChange={event => { clearPending(); setSelectedMovementFamily(event.target.value || null) }}>
          <option value="">All matching exercises</option>{movementFamilies.map(family => <option key={family.id} value={family.id}>{family.label}</option>)}
        </select></label>
        <div className="manual-exercise-results" data-testid="manual-exercise-results">
          {exercises.map(exercise => <article key={exercise.id} onMouseEnter={() => onExerciseFocus?.(getMuscleIdsForExercise(exercise))}
            onMouseLeave={onExerciseBlur} onFocus={() => onExerciseFocus?.(getMuscleIdsForExercise(exercise))} onBlur={onExerciseBlur}>
            <div><strong>{exercise.display_name}</strong><small>{summarizeExercise(exercise)}</small>
              {!trackingOnly ? <small>{exercise.demand_profile === 'higher_loading' ? 'Higher training demand' : exercise.demand_profile === 'controlled' ? 'Controlled option' : 'Moderate demand'}</small> : null}
            </div><button type="button" disabled={loading} onClick={() => { void chooseExercise(exercise) }}>Open</button>
          </article>)}
        </div>{exercises.length ? null : <p role="status">No matching exercises are available. Change equipment or clear the optional movement filter.</p>}
        {loading ? <p role="status" aria-live="polite">Loading your selected exercise recommendation…</p> : null}
        {selectionError ? <div role="alert"><p>{selectionError}</p>{setupHref ? <Link href={setupHref}>Review setup or assessment</Link> : null}
          {pendingExercise ? <button type="button" className="manual-secondary-button" disabled={loading} onClick={() => { void chooseExercise(pendingExercise) }}>Retry recommendation</button> : null}
          {!blocked && pendingExercise ? <button type="button" className="manual-secondary-button" disabled={loading}
            onClick={() => commitExercise(pendingExercise, 'unavailable', 'Recommendation unavailable. Manual logging without guidance.')}>Continue without recommendation</button> : null}
        </div> : null}
      </section> : null}
    </dialog>
  </div>
}
