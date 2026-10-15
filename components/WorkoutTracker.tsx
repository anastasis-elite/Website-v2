'use client'

import { useRef,useState } from 'react'
import { getClientLocalDate } from '@/lib/timezone'
import { activityDose, isBodyweightExercise, summarizeStrengthSets } from '@/lib/workout/activity'
import { manualSetStorageKey, parseStrengthSetInput } from '@/lib/workout/logging'
import ActivityWorkoutTracker from '@/components/ActivityWorkoutTracker'
import WorkoutSetEditor from '@/components/workout-dashboard/WorkoutSetEditor'
import { useRouter } from 'next/navigation'

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
  onExerciseFocus?: (exercise: Exercise) => void
  onExerciseBlur?: () => void
  onManualExerciseFinished?: (completed?: boolean) => void
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

function buildManualWorkoutLog(exercise: Exercise, sets: ManualSetLog[]): WorkoutLog {
  const totalReps = sets.reduce((sum, set) => sum + set.reps, 0)
  const actuals = summarizeStrengthSets(sets)
  const selectedVariant = exercise.available_variants?.find((variant) => variant.id === exercise.selected_variant_id)
  const firstSet = sets[0]

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
    planned_sets: Number(exercise.sets || 0),
    planned_reps: getRecommendedReps(exercise),
    planned_weight: getRecommendedWeight(exercise),
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
  onManualExerciseFinished?: (completed?: boolean) => void
}) {
  const router = useRouter()
  const lock = useRef(false)
  const dose = activityDose(exercise, weightUnit)
  const storageKey = manualSetStorageKey(clientId, program, exercise, getWorkoutSessionDate(timezone))
  const [exerciseStartedAt] = useState(() => new Date().toISOString())
  const [setStartedAt, setSetStartedAt] = useState(() => new Date().toISOString())
  const [weight, setWeight] = useState(() => String(dose.weight))
  const [reps, setReps] = useState(() => String(getRecommendedReps(exercise) || 10))
  const [sets, setSets] = useState<ManualSetLog[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const parsed = JSON.parse(window.localStorage.getItem(storageKey) || '[]')
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const bodyweight = isBodyweightExercise(exercise)
  const loadLabel = bodyweight ? 'no added load' : getLoadLabel(exercise.load_type || 'total_load')
  const nextSetNumber = sets.length + 1

  function persistDraft(nextSets: ManualSetLog[]) {
    if (typeof window === 'undefined') return true
    try { window.localStorage.setItem(storageKey, JSON.stringify(nextSets)); return true }
    catch { return false }
  }

  async function persistSets(nextSets: ManualSetLog[], finishedAt?: string) {
    const exerciseLog = {...buildManualWorkoutLog(exercise, nextSets), completed: Boolean(finishedAt) && nextSets.length >= dose.sets, actual_weight_unit: 'lb'}
    const response = await fetch('/api/workout-set-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        auth_user_id: authUserId,
        program,
        day_name: dayName,
        workout_source: 'manual',
        workout_date: new Date().toISOString(),
        planned_exercises: plannedExercises,
        exercise,
        exercise_started_at: exerciseStartedAt,
        exercise_finished_at: finishedAt || null,
        exercise_logs: [exerciseLog],
        sets: nextSets,
        completed: Boolean(finishedAt) && nextSets.length >= dose.sets,
      }),
    })

    if (!response.ok) {
      throw new Error('Set save failed')
    }
  }

  async function completeSet() {
    const values = parseStrengthSetInput(bodyweight ? 0 : weight, reps)
    if(!values){setMessage('Enter a nonnegative weight and a positive whole number of reps.');return}
    const completedAt = new Date().toISOString()
    const nextSet: ManualSetLog = {
      id: `${Date.now()}-${nextSetNumber}`,
      set_number: nextSetNumber,
      weight: values.weight,
      weight_unit: weightUnit,
      reps: values.reps,
      set_started_at: setStartedAt,
      completed_at: completedAt,
    }
    const nextSets = [...sets, nextSet]

    try {
      if(lock.current)return
      lock.current=true
      setSaving(true)
      await persistSets(nextSets)
      setSets(nextSets)
      const draftRetained = persistDraft(nextSets)
      setWeight(String(nextSet.weight))
      setReps(String(nextSet.reps))
      setSetStartedAt(new Date().toISOString())
      setMessage(`Set ${nextSet.set_number} saved.${draftRetained ? '' : ' This browser could not retain a draft; saved work remains in workout history.'}`)
      router.refresh()
    } catch (error) {
      console.error(error)
      setMessage('Set could not be saved.')
    } finally {
      lock.current=false
      setSaving(false)
    }
  }

  async function updateSet(id: string, values: { weight: number; reps: number }) {
    const nextSets = sets.map((set) => (set.id === id ? { ...set, ...values } : set))

    try {
      if(lock.current)return
      lock.current=true
      setSaving(true)
      await persistSets(nextSets)
      setSets(nextSets)
      const draftRetained = persistDraft(nextSets)
      setMessage(`Set updated.${draftRetained ? '' : ' This browser could not retain a draft; saved work remains in workout history.'}`)
      router.refresh()
    } catch (error) {
      console.error(error)
      setMessage('Set update failed.')
    } finally {
      lock.current=false
      setSaving(false)
    }
  }

  async function deleteSet(id: string) {
    const confirmed = window.confirm('Delete this set?')
    if (!confirmed) return
    const nextSets = sets
      .filter((set) => set.id !== id)
      .map((set, index) => ({ ...set, set_number: index + 1 }))

    try {
      if(lock.current)return
      lock.current=true
      setSaving(true)
      await persistSets(nextSets)
      setSets(nextSets)
      const draftRetained = persistDraft(nextSets)
      setMessage(`Set deleted.${draftRetained ? '' : ' This browser could not retain a draft; saved work remains in workout history.'}`)
      router.refresh()
    } catch (error) {
      console.error(error)
      setMessage('Set delete failed.')
    } finally {
      lock.current=false
      setSaving(false)
    }
  }

  async function finishExercise() {
    if (!sets.length) { setMessage('Record at least one set before finishing this exercise.'); return }
    try {
      if(lock.current)return
      lock.current=true
      setSaving(true)
      await persistSets(sets, new Date().toISOString())
      try { if (typeof window !== 'undefined') window.localStorage.removeItem(storageKey) } catch { /* Server completion succeeded; browser cleanup is optional. */ }
      onManualExerciseFinished?.(sets.length >= dose.sets)
      router.refresh()
    } catch (error) {
      console.error(error)
      setMessage('Exercise finish failed.')
    } finally {
      lock.current=false
      setSaving(false)
    }
  }

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
      </div>

      {sets.length ? (
        <div className="manual-set-history" data-testid="manual-set-history">
          {sets.map((set) => (
            <article key={set.id}>
              <span>Set {set.set_number}</span>
              <WorkoutSetEditor key={`${set.weight}:${set.reps}`} set={set} increment={dose.increment} loadLabel={loadLabel} disabled={saving} bodyweight={bodyweight} onSave={values => void updateSet(set.id, values)} />
              <button type="button" disabled={saving} onClick={() => deleteSet(set.id)}>Delete</button>
              <small>{new Date(set.completed_at).toLocaleTimeString([], { timeZone:timezone,hour: 'numeric', minute: '2-digit' })}</small>
            </article>
          ))}
        </div>
      ) : null}

      <div className="manual-current-set">
        <strong>Set {nextSetNumber}</strong>
        <div>
          {!bodyweight ? <label>
            Weight ({weightUnit}, {loadLabel})
            <input
              inputMode="decimal"
              type="number"
              min="0"
              step={dose.increment}
              value={weight}
              disabled={saving}
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
              disabled={saving}
              onChange={(event) => setReps(event.target.value)}
            />
          </label>
        </div>
        <button type="button" className="manual-primary-button" onClick={completeSet} disabled={saving}>
          {saving ? 'Saving...' : 'Set Done'}
        </button>
      </div>

      {message ? <p className="manual-set-message" role="status">{message}</p> : null}

      <p id="manual-finish-guidance">{sets.length === 0 ? 'Record at least one set before finishing this exercise.' : sets.length < dose.sets ? `${dose.sets - sets.length} prescribed set${dose.sets - sets.length === 1 ? '' : 's'} remain. Finish Exercise saves your partial work.` : 'All prescribed sets are recorded. Finish Exercise saves completion.'}</p>

      <div className="manual-session-actions">
        <button type="button" className="manual-secondary-button" onClick={finishExercise} disabled={saving || sets.length === 0} aria-describedby="manual-finish-guidance">
          Finish Exercise
        </button>
      </div>
    </section>
  )
}
