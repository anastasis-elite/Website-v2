'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { activityDose, isBodyweightExercise, workoutCompletion, summarizeStrengthSets, summarizeActivityUnits } from '@/lib/workout/activity'
import { initialWorkoutLogs, resumeWorkoutSession, workoutSessionKeys } from '@/lib/workout/session'
import { exerciseOccurrenceLabel } from '@/lib/workout/logging'
import WorkoutSetEditor from '@/components/workout-dashboard/WorkoutSetEditor'
import { getClientLocalDate } from '@/lib/timezone'

type Props = { clientId: string; authUserId: string; program: string; dayName: string; exercises: any[]; plannedExercises?: unknown[]; workoutSource?: 'manual' | 'recommended'; timezone?: string; weightUnit?: 'lb' | 'kg'; onManualExerciseFinished?: (completed?: boolean) => void; onExerciseFocus?: (exercise: any) => void; onExerciseBlur?: () => void }
export default function ActivityWorkoutTracker({ clientId, program, dayName, exercises, plannedExercises = exercises, workoutSource = 'recommended', timezone = 'America/Chicago', weightUnit = 'lb', onExerciseFocus, onExerciseBlur, onManualExerciseFinished }: Props) {
  const router = useRouter(); const lock = useRef(false)
  const date = getClientLocalDate({ timezone }); const legacyKey = `anastasis-session:${clientId}:${program}:${dayName}:${date}`
  const planKeys = JSON.stringify(workoutSessionKeys(exercises)); const key = `${legacyKey}:${workoutSource}:${planKeys}`
  const prescriptionKey = JSON.stringify(exercises.map(exercise => activityDose(exercise, weightUnit)))
  const initialize = () => initialWorkoutLogs(exercises)
  const [logs, setLogs] = useState(initialize); const [ready, setReady] = useState(false); const [saving, setSaving] = useState(false); const [message, setMessage] = useState(''); const [summary, setSummary] = useState(false)
  const [draft, setDraft] = useState(() => exercises.map(e => { const dose = activityDose(e, weightUnit); return { weight: dose.weight, amount: dose.prescribed } }))
  const [dirty, setDirty] = useState(false); const [modifiedAt, setModifiedAt] = useState<string | null>(null); const [retry, setRetry] = useState(0); const [loadFailed, setLoadFailed] = useState(false)
  useEffect(() => {
    let cancelled = false; setReady(false); setSummary(false)
    async function resume() {
      const initial = initialize()
      try {
        let stored = null
        try { stored = JSON.parse(localStorage.getItem(key) || localStorage.getItem(legacyKey) || 'null') } catch { /* A damaged draft must not hide server progress. */ }
        const response = await fetch(`/api/workout-log?clientId=${encodeURIComponent(clientId)}&dayName=${encodeURIComponent(dayName)}&source=${workoutSource}&planKeys=${encodeURIComponent(planKeys)}`, { cache: 'no-store' })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Saved progress could not be loaded.')
        const resumed = resumeWorkoutSession(initial, stored, result.session)
        if (!cancelled) { setLogs(resumed.logs); setDraft(resumed.draft || exercises.map(e => { const dose = activityDose(e, weightUnit); return { weight: dose.weight, amount: dose.prescribed } })); setDirty(resumed.dirty); setModifiedAt(resumed.modifiedAt); setLoadFailed(false); setReady(true) }
      } catch(e) { if (!cancelled) { setLoadFailed(true); setMessage(e instanceof Error ? e.message : 'Saved progress could not be loaded. Retry before editing or saving.'); } }
    }
    void resume(); return () => { cancelled = true }
  // Session keys deliberately scope persisted work to this client, plan, and local day.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, retry, prescriptionKey])
  useEffect(() => { if (ready) { try { localStorage.setItem(key, JSON.stringify({ version: 2, logs, draft, dirty, modifiedAt })) } catch { setMessage('This browser could not retain a draft. Use Save / pause to keep your progress.') } } }, [key, ready, logs, draft, dirty, modifiedAt])
  const counts = workoutCompletion(logs)
  const totals = summarizeActivityUnits(logs, true)
  function markDirty() { setDirty(true); setModifiedAt(new Date().toISOString()) }
  function patch(index: number, values: Record<string, unknown>) { markDirty(); setLogs(current => current.map((log, i) => i === index ? { ...log, ...values } : log)); setSummary(false); setMessage('Your changes are in this draft. Save progress when you’re ready.') }
  function confirm(index: number) {
    const log = logs[index], dose = activityDose(log, weightUnit), actual = draft[index]
    if (dose.metric !== 'completion' && (!Number.isFinite(actual.amount) || actual.amount <= 0 || (['reps','breaths'].includes(dose.metric) && !Number.isInteger(actual.amount))) || dose.kind === 'strength' && !isBodyweightExercise(log) && (!Number.isFinite(actual.weight) || actual.weight < 0)) { setMessage('Enter a valid amount completed before confirming. Repetitions and breaths must be whole numbers.'); return }
    if (dose.kind === 'strength') {
      const set = { set_number: log.set_logs.length + 1, weight: isBodyweightExercise(log) ? 0 : actual.weight, weight_unit: dose.unit, reps: actual.amount, completed_at: new Date().toISOString() }
      const sets = [...log.set_logs, set]
      patch(index, { set_logs: sets, ...summarizeStrengthSets(sets), completed: sets.length >= dose.sets, skipped: false })
    } else patch(index, { actual_duration: ['minutes','seconds'].includes(dose.metric) ? actual.amount : 0, duration_unit: dose.metric,
      actual_reps: 0, actual_breaths: dose.metric === 'breaths' ? actual.amount : 0, activity_completed: dose.metric === 'completion', completed: true, skipped: false, confirmed_at: new Date().toISOString() })
    setMessage('Recorded in your session. Save progress whenever you need to pause.')
  }
  async function save(final = false) {
    if (lock.current) return; lock.current = true; setSaving(true); setMessage('')
    try {
      const response = await fetch('/api/workout-log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: clientId, program, day_name: dayName, workout_source: workoutSource,
        workout_date: new Date().toISOString(), planned_exercises: plannedExercises, exercise_logs: logs, completed: final && counts.completed }) })
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'Session could not be saved.')
      setDirty(false); setModifiedAt(payload.session?.updated_at || new Date().toISOString()); setMessage(final ? 'Session saved. Your plan now reflects what you completed.' : 'Progress saved. You can resume here.'); setSummary(final); router.refresh(); if(final && workoutSource === 'manual') onManualExerciseFinished?.(payload.completed === true)
    } catch(e) { setMessage(e instanceof Error ? e.message : 'Session could not be saved. Your draft is still here.') }
    finally { lock.current = false; setSaving(false) }
  }
  return <section className="activity-session" data-testid="activity-workout-tracker" aria-label="Workout session">
    {!ready ? <p role="status">{loadFailed ? 'Saved progress is unavailable. Retry before editing or saving.' : 'Loading your saved progress…'}</p> : null}
    {loadFailed ? <button type="button" onClick={() => setRetry(value => value + 1)}>Retry saved progress</button> : null}
    <p>{counts.complete} of {counts.total} exercises complete{counts.partial ? ` · ${counts.partial} in progress` : ''}{counts.skipped ? ` · ${counts.skipped} skipped` : ''}</p>
    <p>Prescribed values are a starting point. Confirm each set or activity to record what you did.</p>
    {logs.map((log, index) => {
      const dose = activityDose(log, weightUnit)
      return <article key={log.session_key} className="activity-exercise" data-activity={dose.kind} onFocus={() => onExerciseFocus?.(log)} onBlur={onExerciseBlur}>
        <div className="tier-panel-heading"><h3>{exerciseOccurrenceLabel(logs, index)}</h3><span>{log.completed ? 'Done' : log.skipped ? 'Skipped' : dose.kind === 'strength' ? `${log.set_logs.length}/${dose.sets} sets` : 'Available'}</span></div>
        <p>Prescribed: {dose.metric === 'completion' ? `${log.duration_label || 'Complete the movement comfortably'} · record completion` : <>{dose.kind === 'strength' ? `${dose.sets} sets · ` : ''}{dose.prescribed || log.duration_label || 'Choose a comfortable amount'} {dose.prescribed ? dose.metric : ''}{dose.kind === 'strength' && dose.weight > 0 ? ` · ${dose.weight} ${dose.unit} ${dose.loadLabel}` : ''}</>}</p>
        {dose.kind === 'strength' && dose.weight === 0 ? <p>{isBodyweightExercise(log) ? 'Bodyweight · no added load.' : [log.recommended_weight, log.cycle_adjusted_weight, log.calculated_weight, log.baseline_weight].some(value => value != null) ? `No added load prescribed. Record the ${dose.unit} you actually used, including zero.` : `No load baseline is available yet. Record the ${dose.unit} you actually used; zero means no added load.`}</p> : null}
        {log.available_variants?.length > 1 ? <details><summary>Exercise substitutions</summary><label>Variation<select value={log.selected_variant_id || ''} onChange={e => {
          const variant = log.available_variants.find((v: any) => v.id === e.target.value)
          if (log.set_logs.length) { setMessage('Save this exercise before changing its variation.'); return }
          if (variant) {
            const baseline = Number(log.cycle_adjusted_weight ?? log.baseline_weight ?? log.calculated_weight ?? log.recommended_weight ?? 0)
            const weight = baseline * Number(variant.equipment_modifier || 1)
            const rounded = weight < 5 ? Math.round(weight*2)/2 : weight < 20 ? Math.round(weight) : Math.round(weight/5)*5
            patch(index, { selected_variant_id: variant.id, selected_variant_name: variant.name, selected_equipment: variant.equipment, load_type: variant.load_type, recommended_weight: rounded })
            setDraft(current => current.map((d,i) => i === index ? { ...d, weight: variant.load_type === 'bodyweight' ? 0 : weightUnit === 'kg' ? Math.round(rounded/2.2046226218*10)/10 : rounded } : d))
          }
        }} disabled={!ready || saving || log.set_logs.length > 0}>{!log.available_variants.some((v: any) => v.id === log.selected_variant_id) ? <option value="">Keep prescribed movement</option> : null}{log.available_variants.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label>{log.set_logs.length ? <p>Remove recorded sets before changing variation so each set keeps its equipment and load.</p> : null}</details> : null}
        {!log.completed && !log.skipped ? <>
          <div className="activity-inputs">
            {dose.kind === 'strength' && !isBodyweightExercise(log) ? <label>Weight ({dose.unit}, {dose.loadLabel})<input type="number" disabled={!ready || saving} min="0" step={dose.increment} inputMode="decimal" value={Number.isFinite(draft[index].weight) ? draft[index].weight : ''} onChange={e => { markDirty(); setDraft(current => current.map((d,i) => i === index ? { ...d, weight: e.target.value === '' ? NaN : Number(e.target.value) } : d)) }}/></label> : null}
            {dose.metric !== 'completion' ? <label>{dose.metric === 'minutes' ? 'Duration (minutes)' : dose.metric === 'seconds' ? 'Duration (seconds)' : dose.metric === 'breaths' ? 'Breaths completed' : 'Repetitions completed'}<input type="number" disabled={!ready || saving} min="0" step={dose.metric === 'minutes' ? 0.5 : 1} inputMode="decimal" value={draft[index].amount} onChange={e => { markDirty(); setDraft(current => current.map((d,i) => i === index ? { ...d, amount: Number(e.target.value) } : d)) }}/></label> : <p>Confirm when you have completed this movement.</p>}
          </div>
          <div className="tier-action-row"><button type="button" onClick={() => confirm(index)} disabled={saving || !ready}>{dose.kind === 'strength' ? `Complete set ${log.set_logs.length+1}` : 'Confirm activity'}</button><button type="button" disabled={!ready || saving} onClick={() => patch(index, { skipped: true, completed: false })}>Skip exercise</button></div>
        </> : <button type="button" disabled={!ready || saving} onClick={() => patch(index, { completed: false, skipped: false })}>Edit activity</button>}
        {log.set_logs.length ? <details><summary>Recorded sets</summary>{log.set_logs.map((set: any, n: number) => <div key={`${set.set_number}:${set.completed_at}`}><p>Set {set.set_number}: {set.reps} reps · {set.weight} {set.weight_unit}</p><details><summary>Edit set {set.set_number}</summary><WorkoutSetEditor key={`${set.weight}:${set.reps}`} set={set} increment={dose.increment} loadLabel={dose.loadLabel} disabled={!ready || saving} bodyweight={isBodyweightExercise(log)} onSave={values => {
          const sets = log.set_logs.map((existing: any, i: number) => i === n ? { ...existing, ...values } : existing)
          patch(index, { set_logs: sets, ...summarizeStrengthSets(sets), completed: sets.length >= dose.sets, skipped: false })
        }} /></details><button type="button" disabled={!ready || saving} onClick={() => { const sets = log.set_logs.filter((_: any,i: number) => i !== n).map((s: any,i: number) => ({ ...s, set_number: i+1 })); patch(index, { set_logs: sets, ...summarizeStrengthSets(sets), completed: sets.length >= dose.sets, skipped: false }) }}>Remove set {set.set_number}</button></div>)}</details> : null}
        {log.client_cues?.length ? <details><summary>Form guidance</summary>{log.client_cues.map((cue: string) => <p key={cue}>{cue}</p>)}</details> : null}
      </article>
    })}
    <div className="tier-action-row"><button type="button" disabled={saving || !ready} onClick={() => void save()}>Save / pause</button><button type="button" className="tier-primary-action" disabled={saving || !ready} onClick={() => void save(true)}>{saving ? 'Saving…' : 'Finish and review'}</button></div>
    {ready && !counts.completed ? <p>Finish and review saves a partial session. Complete the remaining exercises to mark the workout complete.</p> : null}
    <p role="status">{message}</p>
    {summary ? <article className="daily-plan-card" aria-label="Session summary"><h3>{workoutSource === 'manual' ? counts.completed ? 'Exercise saved' : 'Partial exercise saved' : counts.completed ? 'Workout complete' : 'Partial session saved'}</h3><p>{counts.complete} complete · {counts.partial} partial · {counts.skipped} skipped · {counts.total} planned</p><p>{totals.sets} strength sets · {totals.reps} reps · {Math.round(totals.minutes * 10) / 10} minutes · {totals.breaths} breaths · {totals.activities} movements completed</p><p>Your confirmed work is saved. You can return to the remaining exercises.</p></article> : null}
  </section>
}
