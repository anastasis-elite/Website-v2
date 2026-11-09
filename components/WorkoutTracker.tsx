'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { getClientLocalDate } from '@/lib/timezone'
import { activityDose, isBodyweightExercise, isValidCompletedSet, summarizeStrengthSets } from '@/lib/workout/activity'
import { manualSetStorageKey, parseStrengthSetInput } from '@/lib/workout/logging'
import ActivityWorkoutTracker from '@/components/ActivityWorkoutTracker'
import WorkoutSetEditor from '@/components/workout-dashboard/WorkoutSetEditor'
import { useRouter } from 'next/navigation'
import { manualDesiredSets, prescriptionSnapshot, readManualPrescriptionDraft, type ManualPrescriptionSnapshot } from '@/lib/workout/manualPrescriptionDraft'
import { readSessionEquipmentContext, type SessionEquipmentContext } from '@/lib/workout/selectedPrescriptionTypes'
import { confirmedManualSummary, manualExerciseSignature, type ManualSaveEvidence } from '@/lib/workout/manualFinish'

class ReselectPrescriptionError extends Error {}

type ExerciseVariant = {
  id: string
  name: string
  equipment: string
  load_type: string
  equipment_modifier: number
}

type Exercise = {
  id?: string | number

  exercise?: string
  name?: string
  display_name?: string

  exercise_category?: string
  movement_type?: string
  category?: string
  type?: string

  primary_muscles?: string[]
  secondary_muscles?: string[]
  intended_muscles?: string[]
  compensatory_muscles?: string[]

  sets?: number | string

  reps?: number | string
  target_reps?: number | string
  recommended_reps?: number | string
  cycle_adjusted_reps?: number | string
  baseline_reps?: number | string

  calculated_weight?: number | string
  recommended_weight?: number | string
  cycle_adjusted_weight?: number | string
  baseline_weight?: number | string

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
  duration_label?: string
  prescription?: ManualPrescriptionSnapshot
  recommendationStatus?: string
  recommendationMessage?: string
  recommendationSetupHref?: string
  equipmentContext?: Readonly<SessionEquipmentContext>
}

type WorkoutLog = {
  id?: string | number
  exercise: string
  display_name: string

  exercise_category: string
  movement_type: string

  primary_muscles: string[]
  secondary_muscles: string[]
  intended_muscles: string[]
  compensatory_muscles: string[]

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
  duration_label: string
  started_at?: string
  finished_at?: string
  set_logs?: ManualSetLog[]
  user_intent?: { desired_set_count: number }
}

type Props = {
  clientId: string
  authUserId: string
  program: string
  dayName: string
  exercises: Exercise[]
  timezone?: string
  weightUnit?: 'lb' | 'kg'
  workoutSource?: 'recommended' | 'manual'
  plannedExercises?: unknown[]
  loadGuidanceExercises?: any[]
  resumeOnly?: boolean
  onExerciseFocus?: (exercise: Exercise) => void
  onExerciseBlur?: () => void
  onManualExerciseFinished?: (completed?: boolean, evidence?: ManualSaveEvidence) => void
  onManualRecommendationReset?: () => void
  onManualExerciseChange?: (completed?: boolean, evidence?: ManualSaveEvidence) => boolean
}

type ManualSetLog = {
  id: string
  set_number: number
  weight: number
  weight_unit: 'lb' | 'kg'
  reps: number
  set_started_at: string
  completed_at: string
}

type ManualPendingSave = {
  intent: 'sets' | 'finish' | 'change'
  body: {
    client_id: string; auth_user_id: string; program: string; day_name: string; workout_source: 'manual'
    workout_date: string; planned_exercises: unknown[]; exercise: Exercise; exercise_started_at: string
    exercise_finished_at: string | null; exercise_logs: WorkoutLog[]; sets: ManualSetLog[]; completed: boolean
  }
}

function getExerciseName(exercise: Exercise): string {
  return (
    exercise.exercise ||
    exercise.name ||
    'Exercise'
  )
}

export default function WorkoutTracker(props: Props) {
  if (props.workoutSource === 'manual' && props.exercises.length === 1 && activityDose(props.exercises[0]).kind === 'strength') {
    return (
      <ManualSetLogger
        key={manualSetStorageKey(props.clientId, props.program, props.exercises[0], getWorkoutSessionDate(props.timezone))}
        clientId={props.clientId}
        authUserId={props.authUserId}
        program={props.program}
        dayName={props.dayName}
        exercise={props.exercises[0]}
        plannedExercises={props.plannedExercises || props.exercises}
        timezone={props.timezone}
        weightUnit={props.weightUnit}
        onExerciseFocus={props.onExerciseFocus}
        onExerciseBlur={props.onExerciseBlur}
        onManualExerciseFinished={props.onManualExerciseFinished}
        onManualRecommendationReset={props.onManualRecommendationReset}
        onManualExerciseChange={props.onManualExerciseChange}
      />
    )
  }

  return <ActivityWorkoutTracker {...props} />
}

function getDisplayName(exercise: Exercise): string {
  return (
    exercise.display_name ||
    getExerciseName(exercise)
  )
}

function getRecommendedWeight(
  exercise: Exercise,
): number {
  return Number(
    exercise.recommended_weight ??
      exercise.cycle_adjusted_weight ??
      exercise.calculated_weight ??
      exercise.baseline_weight ??
      0,
  )
}

function getRecommendedReps(
  exercise: Exercise,
): number {
  return Number(
    exercise.recommended_reps ??
      exercise.cycle_adjusted_reps ??
      exercise.reps ??
      exercise.target_reps ??
      exercise.baseline_reps ??
      0,
  )
}

function getBaselineWeight(
  exercise: Exercise,
): number {
  return Number(
    exercise.baseline_weight ??
      exercise.calculated_weight ??
      exercise.recommended_weight ??
      0,
  )
}

function getBaselineReps(
  exercise: Exercise,
): number {
  return Number(
    exercise.baseline_reps ??
      exercise.reps ??
      exercise.target_reps ??
      exercise.recommended_reps ??
      0,
  )
}

function getLoadLabel(
  loadType: string,
): string {
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

function getWorkoutSessionDate(timezone = 'America/Chicago'): string { return getClientLocalDate({timezone}) }

function buildManualWorkoutLog(exercise: Exercise, sets: ManualSetLog[], originalPlannedSets = Number(exercise.sets || 0), prescription: Readonly<ManualPrescriptionSnapshot> | null = null, desiredSetCount?: number): WorkoutLog {
  const totalReps = sets.reduce((sum, set) => sum + set.reps, 0)
  const actuals = summarizeStrengthSets(sets)
  const selectedVariant = exercise.available_variants?.find((variant) => variant.id === exercise.selected_variant_id)
  const firstSet = sets[0]
  const equipmentContext = readSessionEquipmentContext(exercise.equipmentContext ?? prescription?.equipmentContext, exercise.selected_variant_id)

  return {
    id: exercise.id,
    exercise: getExerciseName(exercise),
    display_name: selectedVariant?.name || getDisplayName(exercise),
    exercise_category: exercise.exercise_category || exercise.category || 'strength',
    movement_type: exercise.movement_type || exercise.type || 'strength',
    primary_muscles: exercise.primary_muscles || [],
    secondary_muscles: exercise.secondary_muscles || [],
    intended_muscles: exercise.intended_muscles || [],
    compensatory_muscles: exercise.compensatory_muscles || [],
    selected_variant_id: selectedVariant?.id || exercise.selected_variant_id || null,
    selected_variant_name: selectedVariant?.name || exercise.selected_variant_name || getExerciseName(exercise),
    selected_equipment: selectedVariant?.equipment || exercise.selected_equipment || null,
    load_type: selectedVariant?.load_type || exercise.load_type || 'total_load',
    available_variants: exercise.available_variants || [],
    planned_sets: originalPlannedSets,
    planned_reps: prescription?.reps ?? getRecommendedReps(exercise),
    planned_weight: prescription?.weightLb ?? getRecommendedWeight(exercise),
    ...(prescription ? { prescription } : {}),
    ...(equipmentContext ? { equipment_context: equipmentContext } : {}),
    ...(desiredSetCount ? { user_intent: { desired_set_count: desiredSetCount } } : {}),
    baseline_reps: getBaselineReps(exercise),
    baseline_weight: getBaselineWeight(exercise),
    ...actuals,
    cycle_adjustment_label: exercise.cycle_adjustment_label || 'Manual training load',
    cycle_adjustment_note: exercise.cycle_adjustment_note || '',
    cycle_caution_active: Boolean(exercise.cycle_caution_active),
    completed: sets.length > 0,
    notes: '',
    client_cues: (exercise.client_cues || []).slice(0, 3),
    rest_seconds: exercise.rest_seconds || null,
    rpe_target: exercise.rpe_target || '',
    duration_label: sets.length ? `${sets.length} sets · ${totalReps} total reps · ${Math.round(actuals.actual_weight * 10) / 10} lb avg` : '',
    started_at: firstSet?.set_started_at,
    finished_at: sets[sets.length - 1]?.completed_at,
    set_logs: sets,
  } as WorkoutLog
}

function ManualSetLogger({
  clientId,
  authUserId,
  program,
  dayName,
  exercise,
  plannedExercises,
  onExerciseFocus,
  onExerciseBlur,
  onManualExerciseFinished,
  onManualExerciseChange,
  timezone = 'America/Chicago',
  weightUnit = 'lb',
}: {
  clientId: string
  authUserId: string
  program: string
  dayName: string
  exercise: Exercise
  plannedExercises: unknown[]
  timezone?: string
  weightUnit?: 'lb' | 'kg'
  onExerciseFocus?: (exercise: Exercise) => void
  onExerciseBlur?: () => void
  onManualExerciseFinished?: (completed?: boolean, evidence?: ManualSaveEvidence) => void
  onManualRecommendationReset?: () => void
  onManualExerciseChange?: (completed?: boolean, evidence?: ManualSaveEvidence) => boolean
}) {
  const router = useRouter()
  const lock = useRef(false)
  const departed = useRef(false)
  const mounted = useRef(true)
  const editorEdits = useRef(new Set<string>())
  const context = `${authUserId}:${clientId}:${program}:${exercise.id}:${exercise.selected_variant_id}`
  const currentContext = useRef(context)
  currentContext.current = context
  const dose = activityDose(exercise, weightUnit)
  const sessionDate = useRef(getWorkoutSessionDate(timezone))
  const storageKey = manualSetStorageKey(clientId, program, exercise, sessionDate.current)
  const [restored] = useState(() => {
    if (typeof window !== 'undefined') {
      try { return readManualPrescriptionDraft(JSON.parse(window.localStorage.getItem(storageKey) || 'null')) } catch { /* Invalid draft fields do not invent performed work. */ }
    }
    return readManualPrescriptionDraft(null)
  })
  const pending = useRef(restored.pendingSave as ManualPendingSave | null)
  const [hasPendingSave, setHasPendingSave] = useState(Boolean(restored.pendingSave))
  const legacyCheck = useRef(restored.hadDraft && !restored.changeSafe)
  const [prescription] = useState(() => restored.prescription || prescriptionSnapshot(exercise.prescription))
  const [equipmentContext] = useState(() => restored.equipmentContext || prescription?.equipmentContext || readSessionEquipmentContext(exercise.equipmentContext, exercise.selected_variant_id))
  const originalPlannedSets = useRef(prescription?.sets || restored.originalPlannedSets || manualDesiredSets(exercise.sets) || 0)
  const savedDesiredSetCount = useRef(restored.savedDesiredSetCount || originalPlannedSets.current)
  const [exerciseStartedAt] = useState(() => new Date().toISOString())
  const [setStartedAt, setSetStartedAt] = useState(() => new Date().toISOString())
  const unguided = ['unavailable', 'tracking_only'].includes(exercise.recommendationStatus || '')
  const [weight, setWeight] = useState(() => {
    if (restored.weight !== undefined) {
      if (restored.weightUnit && restored.weightUnit !== weightUnit && restored.weight.trim() && Number.isFinite(Number(restored.weight))) {
        return String(Math.round(Number(restored.weight) * (weightUnit === 'kg' ? 1 / 2.2046226218 : 2.2046226218) * 10) / 10)
      }
      return restored.weight
    }
    return prescription ? String(Math.round(prescription.weightLb / (weightUnit === 'kg' ? 2.2046226218 : 1) * 10) / 10) : !unguided && (exercise.recommended_weight !== undefined || exercise.calculated_weight !== undefined || exercise.baseline_weight !== undefined) ? String(dose.weight) : ''
  })
  const [reps, setReps] = useState(() => restored.reps ?? (prescription ? String(prescription.reps) : !unguided && getRecommendedReps(exercise) > 0 ? String(getRecommendedReps(exercise)) : ''))
  const [desiredSetCount, setDesiredSetCount] = useState(() => restored.desiredSetCount ?? (originalPlannedSets.current ? String(originalPlannedSets.current) : ''))
  const [sets, setSets] = useState<ManualSetLog[]>(() => restored.sets)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [needsReselect, setNeedsReselect] = useState(false)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const bodyweight = isBodyweightExercise(exercise)
  const loadLabel = bodyweight ? 'no added load' : getLoadLabel(exercise.load_type || 'total_load')
  const nextSetNumber = sets.length + 1

  function draft(nextSets: ManualSetLog[]) {
    return { version: 3, sets: nextSets, weight, weightUnit, reps, desiredSetCount, originalPlannedSets: originalPlannedSets.current, prescription, equipmentContext,
      pendingSave: pending.current, savedDesiredSetCount: savedDesiredSetCount.current, changeSafe: !legacyCheck.current }
  }

  useEffect(() => {
    if (typeof window === 'undefined' || departed.current) return
    try { window.localStorage.setItem(storageKey, JSON.stringify(draft(sets))) }
    catch { /* A failed browser draft never changes server-confirmed history. */ }
  }, [storageKey, sets, weight, weightUnit, reps, desiredSetCount, prescription, equipmentContext, hasPendingSave])

  function persistDraft(nextSets: ManualSetLog[]) {
    if (typeof window === 'undefined') return true
    try { window.localStorage.setItem(storageKey, JSON.stringify(draft(nextSets))); return true }
    catch { return false }
  }

  function current() {
    return mounted.current && !departed.current && currentContext.current === context && getWorkoutSessionDate(timezone) === sessionDate.current
  }

  function begin() {
    if (lock.current || pending.current || !current()) return false
    lock.current = true; setSaving(true)
    return true
  }

  function clearPendingSave() {
    pending.current = null; setHasPendingSave(false)
  }

  async function sendPendingSave(mutation: ManualPendingSave, retry = false): Promise<ManualSaveEvidence> {
    const body = mutation?.body
    // Restored requests must still belong to this exact member/day/occurrence.
    if (!current() || !body || body.client_id !== clientId || body.auth_user_id !== authUserId || body.program !== program ||
      body.day_name !== dayName || body.workout_source !== 'manual' || body.exercise?.id !== exercise.id ||
      body.exercise?.selected_variant_id !== exercise.selected_variant_id || !Array.isArray(body.sets) || body.sets.length > 100 ||
      body.sets.some(set => !isValidCompletedSet(set)) || body.exercise_logs?.length !== 1 || body.exercise_logs[0].id !== exercise.id ||
      !Number.isFinite(Date.parse(body.workout_date)) || getClientLocalDate({ timezone }, new Date(body.workout_date)) !== sessionDate.current) {
      throw new Error('The original save cannot be retried in this workout view. Your draft is retained.')
    }
    const response = await fetch('/api/workout-set-log', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const result = await response.json().catch(() => null)
    if (!current()) throw new Error('The workout view changed. Your original draft is retained.')
    if (!response.ok) {
      if (result?.code === 'prescription_changed') {
        // This explicit first-attempt rejection occurs before any server write.
        // An earlier ambiguous attempt must remain recoverable even if retry is rejected.
        if (!retry) { clearPendingSave(); persistDraft(sets) }
        throw new ReselectPrescriptionError(result.error || 'Change exercise to review a fresh recommendation. Your entries have not changed.')
      }
      throw new Error('Set save failed')
    }
    const signature = manualExerciseSignature(body.exercise_logs[0])
    if (result?.success !== true || typeof result.workout_log_id !== 'string' || !result.workout_log_id ||
      typeof result.exercise_session_id !== 'string' || !result.exercise_session_id || !signature) throw new Error('Exercise save could not be confirmed.')
    savedDesiredSetCount.current = body.exercise_logs[0].user_intent?.desired_set_count || originalPlannedSets.current
    clearPendingSave(); setNeedsReselect(false)
    return { workoutLogId: result.workout_log_id, exerciseId: String(exercise.id), dayName, signature }
  }

  async function persistSets(nextSets: ManualSetLog[], finishedAt?: string, intent: ManualPendingSave['intent'] = 'sets') {
    if (!current()) throw new Error('A new day has started. Reopen Workout before saving this session.')
    const desired = intent === 'change' ? savedDesiredSetCount.current || originalPlannedSets.current : manualDesiredSets(desiredSetCount)
    if (!desired) throw new Error('Choose a desired set count from 1 to 100.')
    if (!originalPlannedSets.current) originalPlannedSets.current = desired
    const sessionExercise = { ...exercise, ...(equipmentContext ? { equipmentContext } : {}) }
    const exerciseLog = { ...buildManualWorkoutLog(sessionExercise, nextSets, originalPlannedSets.current, prescription, desired),
      completed: Boolean(finishedAt) && nextSets.length >= originalPlannedSets.current, actual_weight_unit: 'lb' }
    const mutation: ManualPendingSave = { intent, body: {
      client_id: clientId, auth_user_id: authUserId, program, day_name: dayName, workout_source: 'manual',
      workout_date: new Date().toISOString(), planned_exercises: plannedExercises, exercise: sessionExercise,
      exercise_started_at: exerciseStartedAt, exercise_finished_at: finishedAt || null,
      exercise_logs: [exerciseLog], sets: nextSets, completed: exerciseLog.completed,
    } }
    pending.current = mutation; setHasPendingSave(true)
    // Never send work that cannot be recovered after an interrupted request.
    if (!persistDraft(sets)) {
      clearPendingSave()
      throw new Error('This browser could not retain the save for retry. No request was sent.')
    }
    return sendPendingSave(mutation)
  }

  function saveFailed(error: unknown, fallback: string) {
    if (!mounted.current || currentContext.current !== context) return
    if (error instanceof ReselectPrescriptionError) { setNeedsReselect(true); setMessage(error.message) }
    else setMessage(pending.current
      ? `${fallback} The save could not be confirmed. Keep this exercise open and use Retry save before changing exercises.`
      : error instanceof Error ? error.message : fallback)
  }

  async function completeSet() {
    if (lock.current || pending.current || departed.current) return
    if (!manualDesiredSets(desiredSetCount)) { setMessage('Choose a desired set count from 1 to 100.'); return }
    const values = parseStrengthSetInput(bodyweight ? 0 : weight, reps)
    if (!values) { setMessage('Enter a nonnegative weight and a positive whole number of reps.'); return }
    const nextSet: ManualSetLog = { id: `${Date.now()}-${nextSetNumber}`, set_number: nextSetNumber,
      weight: values.weight, weight_unit: weightUnit, reps: values.reps,
      set_started_at: setStartedAt, completed_at: new Date().toISOString() }
    const nextSets = [...sets, nextSet]
    if (!begin()) return
    try {
      await persistSets(nextSets)
      setSets(nextSets)
      const retained = persistDraft(nextSets)
      setWeight(String(nextSet.weight)); setReps(String(nextSet.reps)); setSetStartedAt(new Date().toISOString())
      setMessage(`Set ${nextSet.set_number} saved.${retained ? '' : ' This browser could not retain a draft; saved work remains in workout history.'}`)
      router.refresh()
    } catch (error) { saveFailed(error, 'Set could not be saved.') }
    finally { lock.current = false; if (mounted.current) setSaving(false) }
  }

  async function updateSet(id: string, values: { weight: number; reps: number }) {
    if (!begin()) return
    const nextSets = sets.map(set => set.id === id ? { ...set, ...values } : set)
    try {
      await persistSets(nextSets)
      setSets(nextSets); editorEdits.current.delete(id); persistDraft(nextSets)
      setMessage('Set updated.'); router.refresh()
    } catch (error) { saveFailed(error, 'Set update failed.') }
    finally { lock.current = false; if (mounted.current) setSaving(false) }
  }

  async function deleteSet(id: string) {
    if (lock.current || pending.current || !current() || !window.confirm('Delete this set?') || !begin()) return
    const nextSets = sets.filter(set => set.id !== id).map((set, index) => ({ ...set, set_number: index + 1 }))
    try {
      await persistSets(nextSets)
      setSets(nextSets); editorEdits.current.delete(id); persistDraft(nextSets)
      setMessage('Set deleted.'); router.refresh()
    } catch (error) { saveFailed(error, 'Set delete failed.') }
    finally { lock.current = false; if (mounted.current) setSaving(false) }
  }

  async function retrySave() {
    if (lock.current || !pending.current || !current()) return
    const mutation = pending.current
    lock.current = true; setSaving(true)
    try {
      await sendPendingSave(mutation, true)
      for (const id of editorEdits.current) {
        const before = sets.find(set => set.id === id), after = mutation.body.sets.find(set => set.id === id)
        if (!after || after.weight !== before?.weight || after.reps !== before?.reps) editorEdits.current.delete(id)
      }
      setSets(mutation.body.sets); persistDraft(mutation.body.sets)
      setMessage('Save confirmed. Review your recorded sets, then continue or change exercise.'); router.refresh()
    } catch (error) { saveFailed(error, 'Save retry failed.') }
    finally { lock.current = false; if (mounted.current) setSaving(false) }
  }

  async function finishExercise(change = false) {
    if (!current()) { setMessage('Exercise finish failed. Reopen Workout before saving this session.'); return }
    if (!sets.length) { setMessage('Record at least one set before finishing this exercise.'); return }
    if (!begin()) return
    try {
      const evidence = await persistSets(sets, new Date().toISOString(), change ? 'change' : 'finish')
      if (!current()) return
      if (change && !onManualExerciseChange?.(sets.length >= originalPlannedSets.current, evidence)) {
        persistDraft(sets); setMessage('Your saved sets are retained. The exercise picker could not be opened. Try again.'); return
      }
      departed.current = true
      try { window.localStorage.removeItem(storageKey) } catch { /* Saved work remains in workout history. */ }
      if (!change) onManualExerciseFinished?.(sets.length >= originalPlannedSets.current, evidence)
      router.refresh()
    } catch (error) { saveFailed(error, 'Exercise finish failed.') }
    finally { lock.current = false; if (mounted.current) setSaving(false) }
  }

  async function checkLegacyDraft() {
    const response = await fetch(`/api/workout-log?${new URLSearchParams({ manualSummary: '1', clientId, date: sessionDate.current, program })}`, {
      method: 'GET', credentials: 'same-origin', cache: 'no-store',
    })
    const value = await response.json().catch(() => null)
    if (!current()) return false
    if (!response.ok || !confirmedManualSummary(value, { clientId, authUserId, program, date: sessionDate.current })) throw new Error('Your saved records could not be checked. Your exercise draft is retained. Try Change exercise again.')
    const saved = value.sessions.flatMap(session => session.exercises).find(item => item.id === String(exercise.id))
    if (saved) {
      // The summary signature retains original set IDs and units, unlike display-only rows.
      const signature = JSON.parse(saved.signature)
      if (signature.id !== exercise.id || signature.variant !== (exercise.selected_variant_id || null) || signature.plannedSets !== saved.plannedSets) throw new Error('Saved work could not be matched. Your original exercise draft is retained.')
      const recovered: ManualSetLog[] = signature.sets?.map((set: any) => ({ id: set.id, set_number: set.number,
        weight: set.weight, weight_unit: set.unit, reps: set.reps, completed_at: set.at, set_started_at: set.at }))
      if (!Array.isArray(recovered) || recovered.some(set => typeof set.id !== 'string' || !isValidCompletedSet(set)) || !saved.plannedSets || !recovered.length && saved.completed) throw new Error('Saved work was found. Keep this exercise open and review workout history before changing it.')
      const local = manualExerciseSignature(buildManualWorkoutLog(exercise, sets, originalPlannedSets.current, prescription, savedDesiredSetCount.current || 1))
      if (local && JSON.stringify(JSON.parse(local).sets) === JSON.stringify(signature.sets) && originalPlannedSets.current === saved.plannedSets) {
        legacyCheck.current = false; persistDraft(sets); return true
      }
      originalPlannedSets.current = saved.plannedSets
      savedDesiredSetCount.current = saved.plannedSets
      setSets(recovered); legacyCheck.current = false; persistDraft(recovered)
      setMessage('Saved sets were recovered under this exercise. Review them, then use Change exercise to keep the saved work and choose another.')
      return false
    }
    legacyCheck.current = false; persistDraft(sets)
    return true
  }

  function editedInputs() {
    const last = sets.at(-1)
    const defaultWeight = last ? last.weight * (last.weight_unit === weightUnit ? 1 : weightUnit === 'kg' ? 1 / 2.2046226218 : 2.2046226218)
      : prescription ? prescription.weightLb / (weightUnit === 'kg' ? 2.2046226218 : 1)
        : !unguided && (exercise.recommended_weight !== undefined || exercise.calculated_weight !== undefined || exercise.baseline_weight !== undefined) ? dose.weight : ''
    const defaultReps = last?.reps ?? prescription?.reps ?? (!unguided && getRecommendedReps(exercise) > 0 ? getRecommendedReps(exercise) : '')
    const defaultSets = sets.length ? savedDesiredSetCount.current || originalPlannedSets.current : prescription?.sets || (unguided ? '' : manualDesiredSets(exercise.sets) || '')
    const differs = (value: string, baseline: string | number) => value.trim() === '' || baseline === '' ? value.trim() !== String(baseline) : Number(value) !== Number(baseline)
    return editorEdits.current.size > 0 || !bodyweight && differs(weight, defaultWeight === '' ? '' : Math.round(defaultWeight * 10) / 10) || differs(reps, defaultReps) || differs(desiredSetCount, defaultSets)
  }

  async function changeExercise() {
    if (!onManualExerciseChange || lock.current || pending.current || !current()) return
    if (legacyCheck.current) {
      lock.current = true; setSaving(true)
      try { if (!await checkLegacyDraft()) return }
      catch (error) { saveFailed(error, 'Saved records could not be checked.'); return }
      finally { lock.current = false; if (mounted.current) setSaving(false) }
    }
    if (!current()) return
    if (sets.length) {
      if (!window.confirm(`Keep ${sets.length} recorded set${sets.length === 1 ? '' : 's'} for ${getDisplayName(exercise)} and choose another exercise?${editedInputs() ? ' Unrecorded edits will be discarded.' : ''} Cancel to continue this exercise.`)) return
      await finishExercise(true)
    } else {
      if (editedInputs() && !window.confirm('Discard the unrecorded inputs and change exercise? Cancel to keep editing this exercise.')) return
      lock.current = true
      if (!onManualExerciseChange()) { lock.current = false; setMessage('Your inputs are retained. The exercise picker could not be opened. Try again.'); return }
      departed.current = true
      try { window.localStorage.removeItem(storageKey) } catch { /* Only this abandoned occurrence may remain locally. */ }
    }
  }

  const disabled = saving || hasPendingSave

  return (
    <section
      className="manual-set-logger"
      data-testid="manual-set-logger"
      onMouseEnter={() => onExerciseFocus?.(exercise)}
      onMouseLeave={onExerciseBlur}
      onFocus={() => onExerciseFocus?.(exercise)}
      onBlur={onExerciseBlur}
    >
      <div className="manual-set-heading">
        <p className="tier-dashboard-label">Log Sets</p>
        <h3>{getDisplayName(exercise)}</h3>
        <small>{exercise.selected_equipment ? `${exercise.selected_equipment} · ` : ''}{loadLabel}</small>
        {onManualExerciseChange ? <button type="button" className="manual-secondary-button manual-change-exercise" disabled={disabled} onClick={() => { void changeExercise() }}>Change exercise</button> : null}
      </div>

      {prescription ? <p data-testid="manual-recommendation"><strong>Recommended:</strong> {Math.round(prescription.weightLb / (weightUnit === 'kg' ? 2.2046226218 : 1) * 10) / 10} {weightUnit} ({loadLabel}) · {prescription.sets} sets · {prescription.reps} reps</p>
        : <div data-testid="manual-recommendation"><p>{exercise.recommendationStatus === 'tracking_only' ? 'Manual logging without coaching guidance.' : 'Recommendation unavailable.'} {exercise.recommendationMessage || 'Enter the work you intend to do.'}</p>{exercise.recommendationSetupHref ? <Link href={exercise.recommendationSetupHref}>Review setup or assessment</Link> : null}</div>}

      {sets.length ? (
        <div className="manual-set-history" data-testid="manual-set-history">
          {sets.map((set) => (
            <article key={set.id}>
              <span>Set {set.set_number}</span>
              <WorkoutSetEditor key={`${set.weight}:${set.reps}`} set={set} increment={dose.increment} loadLabel={loadLabel} disabled={disabled} bodyweight={bodyweight} onSave={values => void updateSet(set.id, values)} onDirtyChange={dirty => { if (dirty) editorEdits.current.add(set.id); else editorEdits.current.delete(set.id) }} />
              <button type="button" disabled={disabled} onClick={() => deleteSet(set.id)}>Delete</button>
              <small>{new Date(set.completed_at).toLocaleTimeString([], { timeZone:timezone,hour: 'numeric', minute: '2-digit' })}</small>
            </article>
          ))}
        </div>
      ) : null}

      <div className="manual-current-set">
        <strong>Set {nextSetNumber}</strong>
        <div>
          <label>Desired sets<input type="number" inputMode="numeric" min="1" max="100" step="1" value={desiredSetCount} disabled={disabled} onChange={event => setDesiredSetCount(event.target.value)} /></label>
          {!bodyweight ? <label>
            Weight ({weightUnit}, {loadLabel})
            <input
              inputMode="decimal"
              type="number"
              min="0"
              step={dose.increment}
              value={weight}
              disabled={disabled}
              onChange={(event) => setWeight(event.target.value)}
            />
          </label> : <p>Bodyweight · no added load</p>}
          <label>
            Reps
            <input
              inputMode="numeric"
              type="number"
              min="1"
              step="1"
              value={reps}
              disabled={disabled}
              onChange={(event) => setReps(event.target.value)}
            />
          </label>
        </div>
        <button type="button" className="manual-primary-button" onClick={completeSet} disabled={disabled}>
          {saving ? 'Saving...' : 'Set Done'}
        </button>
      </div>

      {message ? <p className="manual-set-message" role="status">{message}</p> : null}
      {needsReselect ? <p role="status">Use Change exercise to review a fresh recommendation while keeping any recorded work.</p> : null}
      {hasPendingSave ? <div role="status"><p>A save is awaiting confirmation. Your original exercise and pending work are retained, including after reload.</p><button type="button" className="manual-secondary-button" disabled={saving} onClick={() => { void retrySave() }}>Retry save</button></div> : null}

      <p id="manual-finish-guidance">{sets.length === 0 ? 'Record at least one set before finishing this exercise.' : sets.length < originalPlannedSets.current ? `${originalPlannedSets.current - sets.length} original planned sets remain. Finish Exercise saves your partial work.` : 'The original planned sets are recorded. Finish Exercise saves completion.'} Editing desired sets does not change the original completion target.</p>

      <div className="manual-session-actions">
        <button type="button" className="manual-secondary-button" onClick={() => { void finishExercise() }} disabled={disabled || sets.length === 0} aria-describedby="manual-finish-guidance">
          Finish Exercise
        </button>
      </div>
    </section>
  )
}
