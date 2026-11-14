'use client'
import { weightInputIncrement } from '@/lib/workout/weightRounding'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { activityDose, isBodyweightExercise, manualWorkoutPlan, prescribedSetCount, workoutCompletion, summarizeStrengthSets, summarizeActivityUnits } from '@/lib/workout/activity'
import { initialWorkoutLogs, matchingWorkoutPlan, resumeWorkoutSession, workoutSessionKeys } from '@/lib/workout/session'
import { exerciseOccurrenceLabel } from '@/lib/workout/logging'
import WorkoutSetEditor from '@/components/workout-dashboard/WorkoutSetEditor'
import { getClientLocalDate } from '@/lib/timezone'
import { isManualCardioExercise } from '@/lib/workout/manualCardio'
import { manualExerciseSignature, manualExerciseIdentity, type ManualSaveEvidence } from '@/lib/workout/manualFinish'
import { canChangePrescriptionVariant, changePrescriptionVariant } from '@/lib/workout/changePrescriptionVariant'
import { discoverResumableLocalPrescription, inspectRetainedLocalPrescription, selectResumablePrescriptionSnapshot } from '@/lib/workout/resumePrescribedSession'
import { exerciseLoadPresentation, weightDraftForInput } from '@/lib/workout/exerciseLoadPresentation'
import { createWorkoutInputDraft, readWorkoutInputDraft } from '@/lib/workout/inputDraft'

type Props = { clientId: string; authUserId: string; program: string; dayName: string; exercises: any[]; plannedExercises?: unknown[]; loadGuidanceExercises?: any[]; workoutSource?: 'manual' | 'recommended'; timezone?: string; weightUnit?: 'lb' | 'kg'; resumeOnly?: boolean; onManualExerciseFinished?: (completed?: boolean, evidence?: ManualSaveEvidence) => void; onExerciseFocus?: (exercise: any) => void; onExerciseBlur?: () => void }
export default function ActivityWorkoutTracker({ clientId, program, dayName, exercises, plannedExercises = exercises, loadGuidanceExercises = exercises, workoutSource = 'recommended', timezone = 'America/Chicago', weightUnit = 'lb', resumeOnly = false, onExerciseFocus, onExerciseBlur, onManualExerciseFinished }: Props) {
  const router = useRouter(); const lock = useRef(false)
  const carousel = useRef<HTMLDivElement | null>(null)
  const manualDate = useRef(getClientLocalDate({ timezone }))
  const date = workoutSource === 'manual' ? manualDate.current : getClientLocalDate({ timezone }); const legacyKey = `anastasis-session:${clientId}:${program}:${dayName}:${date}`
  const planKeys = JSON.stringify(workoutSessionKeys(exercises)); const key = `${legacyKey}:${workoutSource}:${planKeys}`
  const resumedIdentity = useRef({ storageKey: key, dayName, keys: workoutSessionKeys(exercises) })
  const retainedGuidance = useRef(false)
  const projectedKeys = workoutSessionKeys(loadGuidanceExercises)
  const guidanceContext = (exercise: any, index: number) => ({ source: workoutSource,
    projectedExercise: retainedGuidance.current ? undefined : loadGuidanceExercises[projectedKeys.indexOf(String(exercise.session_key || workoutSessionKeys(exercises)[index]))] })
  const prescriptionKey = JSON.stringify(exercises.map((exercise, index) => [activityDose(exercise, weightUnit), exerciseLoadPresentation(exercise, {
    source: workoutSource, projectedExercise: loadGuidanceExercises[projectedKeys.indexOf(workoutSessionKeys(exercises)[index])],
  })]))
  const initialize = () => initialWorkoutLogs(exercises)
  const manualCardio = workoutSource === 'manual' && exercises.length > 0 && exercises.every(isManualCardioExercise)
  const [logs, setLogs] = useState(initialize); const [ready, setReady] = useState(false); const [saving, setSaving] = useState(false); const [message, setMessage] = useState(''); const [summary, setSummary] = useState(false)
  const [draft, setDraft] = useState(() => exercises.map((e, index) => { const dose = activityDose(e, weightUnit); return { ...weightDraftForInput(e, weightUnit, guidanceContext(e, index)), amount: dose.prescribed } }))
  const [dirty, setDirty] = useState(false); const [modifiedAt, setModifiedAt] = useState<string | null>(null); const [retry, setRetry] = useState(0); const [loadFailed, setLoadFailed] = useState(false)
  const [resumeUnavailable, setResumeUnavailable] = useState(false)
  const [exercisePosition, setExercisePosition] = useState({ key, index: 0 })
  const [sessionPlan, setSessionPlan] = useState<any[]>(plannedExercises as any[])
  const activeIndex = exercisePosition.key === key ? Math.min(exercisePosition.index, Math.max(0, logs.length - 1)) : 0
  function selectExercise(index: number) {
    const next = Math.max(0, Math.min(index, logs.length - 1))
    const track = carousel.current
    // Move focus before a swipe makes the focused card inert.
    if (next !== activeIndex && track?.children[activeIndex]?.contains(track.ownerDocument.activeElement)) track.focus({ preventScroll: true })
    setExercisePosition({ key, index: next })
    return next
  }
  function showExercise(index: number) {
    const next = selectExercise(index)
    if (carousel.current) carousel.current.scrollTo({ left: next * carousel.current.clientWidth, behavior: 'auto' })
  }
  useEffect(() => {
    let cancelled = false; setReady(false); setSummary(false); setResumeUnavailable(false)
    async function resume() {
      const initial = initialize()
      try {
        let identity = { storageKey: key, dayName, keys: workoutSessionKeys(exercises) }
        let stored = null
        try { stored = JSON.parse(localStorage.getItem(key) || localStorage.getItem(legacyKey) || 'null') } catch {
          if (workoutSource === 'recommended') {
            if (!cancelled) { setResumeUnavailable(true); setLoadFailed(false); setMessage('Your saved workout could not be read safely. Your browser draft has been left unchanged. Retry saved progress or ask your coach to review this session.') }
            return
          }
        }
        if (Array.isArray(stored)) stored = { logs: stored }
        async function readSession(requestIdentity = identity) {
          const response = await fetch(`/api/workout-log?clientId=${encodeURIComponent(clientId)}&dayName=${encodeURIComponent(requestIdentity.dayName)}&source=${workoutSource}&planKeys=${encodeURIComponent(JSON.stringify(requestIdentity.keys))}`, { cache: 'no-store' })
          const result = await response.json()
          if (!response.ok) throw new Error(result.error || 'Saved progress could not be loaded.')
          return result
        }
        let result = await readSession()
        const retainedLocal = inspectRetainedLocalPrescription({ keys: identity.keys, stored })
        const retainedServer = result.session ? inspectRetainedLocalPrescription({ keys: identity.keys, stored: {
          logs: result.session.exercise_logs, plannedExercises: result.session.planned_exercises, completed: result.session.completed,
          draft: result.session.exercise_logs?.map((log: any, index: number) => readWorkoutInputDraft(log?.input_draft, identity.keys[index])),
        } }) : null
        if (workoutSource === 'recommended' && (retainedLocal.status === 'incomplete' || retainedServer?.status === 'incomplete')) {
          if (!cancelled) { setResumeUnavailable(true); setLoadFailed(false); setMessage('The saved workout is missing its original set prescription. Your entered data and browser draft have been kept unchanged. Ask your coach to review this session before resuming.') }
          return
        }
        const exactPreserved = selectResumablePrescriptionSnapshot({ keys: identity.keys, stored, session: result.session })
        let preserved = workoutSource === 'recommended' || resumeOnly ? exactPreserved : null
        // Keep browser-only input when the server has no actual work; otherwise
        // retain the usual timestamp precedence for started sessions.
        const newerLocal = stored?.dirty === true && Number.isFinite(Date.parse(stored.modifiedAt)) &&
          Date.parse(stored.modifiedAt) > Date.parse(result.session?.updated_at || '1970-01-01')
        const useRetainedLocal = retainedLocal.status === 'coherent' &&
          (!matchingWorkoutPlan(result.session?.exercise_logs, identity.keys) || newerLocal || retainedServer?.status === 'none')
        if (!preserved && workoutSource === 'recommended' && useRetainedLocal && retainedLocal.status === 'coherent') {
          preserved = { source: 'local', plan: retainedLocal.plan }
        }
        if (!preserved && workoutSource === 'recommended' && !useRetainedLocal && retainedServer?.status === 'coherent') {
          preserved = { source: 'server', plan: retainedServer.plan }
        }
        if (!preserved && workoutSource === 'recommended') {
          const discovered = discoverResumableLocalPrescription({ storage: localStorage, clientId, program, date })
          if (discovered) {
            const candidateIdentity = { storageKey: discovered.storageKey, dayName: discovered.dayName, keys: discovered.keys }
            const candidateResult = await readSession(candidateIdentity)
            const candidatePreserved = selectResumablePrescriptionSnapshot({ keys: candidateIdentity.keys, stored: discovered.stored, session: candidateResult.session })
            if (!candidatePreserved) {
              if (!cancelled) { setResumeUnavailable(true); setLoadFailed(false); setMessage('The saved workout and browser draft need review before they can be reconciled. Both have been kept. Contact your coach before resuming this session.') }
              return
            }
            identity = candidateIdentity; stored = discovered.stored; result = candidateResult; preserved = candidatePreserved
          }
        }
        if (resumeOnly && !preserved) {
          if (!cancelled) { setResumeUnavailable(true); setLoadFailed(false); setMessage('This saved workout needs review before it can be resumed. Your recorded work and browser draft have been kept. Contact your coach to review the original prescription.') }
          return
        }
        // Browser defaults can refresh until work or an edit starts a session.
        // An explicitly saved issued prescription resumes from the server.
        const fixedPlan = preserved?.plan || plannedExercises
        const resumed = resumeWorkoutSession(workoutSource === 'recommended' ? initialWorkoutLogs(fixedPlan) : initial, stored, preserved?.source === 'local' && retainedServer?.status === 'none' ? null : result.session, Boolean(preserved))
        retainedGuidance.current = Boolean(preserved)
        if (!cancelled) { setLogs(resumed.logs); setDraft(resumed.logs.map((e: any, index: number) => {
          const dose = activityDose(e, weightUnit), actualDuration = Number(e.actual_duration || 0)
          const retained = preserved || workoutSource === 'manual' ? resumed.draft?.[index] : undefined
          const amount = retained?.amountEdited === true
            ? typeof retained.amount === 'number' && Number.isFinite(retained.amount) ? retained.amount : NaN
            : retained?.amount ?? (isManualCardioExercise(e) ? actualDuration : dose.prescribed)
          return { ...weightDraftForInput(e, weightUnit, guidanceContext(e, index), retained), amountEdited: retained?.amountEdited === true, amount }
        })); setDirty(resumed.dirty); setModifiedAt(resumed.modifiedAt); setLoadFailed(false); setReady(true)
          resumedIdentity.current = identity
          setSessionPlan(fixedPlan)
          const savedIndex = resumed.logs.findIndex((log: { session_key: string }) => log.session_key === stored?.activeExerciseKey)
          const index = savedIndex >= 0 ? savedIndex : 0
          setExercisePosition({ key, index })
          if (carousel.current) carousel.current.scrollTo({ left: index * carousel.current.clientWidth, behavior: 'auto' })
        }
      } catch(e) { if (!cancelled) { setLoadFailed(true); setMessage(e instanceof Error ? e.message : 'Saved progress could not be loaded. Retry before editing or saving.'); } }
    }
    void resume(); return () => { cancelled = true }
  // Session keys deliberately scope persisted work to this client, plan, and local day.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, retry, prescriptionKey, resumeOnly])
  useEffect(() => { if (ready) { try { localStorage.setItem(resumedIdentity.current.storageKey, JSON.stringify({ version: 2, logs, plannedExercises: sessionPlan, draft, dirty, modifiedAt, activeExerciseKey: logs[activeIndex]?.session_key })) } catch { setMessage('This browser could not retain a draft. Use Save / pause to keep your progress.') } } }, [key, ready, logs, sessionPlan, draft, dirty, modifiedAt, activeIndex])
  const counts = workoutCompletion(logs, workoutSource === 'manual' ? manualWorkoutPlan(logs) : sessionPlan)
  // This display uses all retained prescribed work, independently of halfway credit.
  const progressPercentage = counts.totalSets > 0 && sessionPlan.every(exercise => prescribedSetCount(exercise) > 0)
    ? counts.completedSets >= counts.totalSets ? 100 : Math.max(0, Math.min(99, Math.floor(counts.completedSets * 100 / counts.totalSets)))
    : null
  const totals = summarizeActivityUnits(logs, true)
  function markDirty() { setDirty(true); setModifiedAt(new Date().toISOString()) }
  function patch(index: number, values: Record<string, unknown>) { markDirty(); setLogs(current => current.map((log, i) => i === index ? { ...log, ...values } : log)); setSummary(false); setMessage('Your changes are in this draft. Save progress when you’re ready.') }
  function confirm(index: number) {
    if (!ready) return
    const log = logs[index], dose = activityDose(log, weightUnit), actual = draft[index]
    if (dose.metric !== 'completion' && (!Number.isFinite(actual.amount) || actual.amount <= 0 || (['reps','breaths'].includes(dose.metric) && !Number.isInteger(actual.amount))) || dose.kind === 'strength' && !isBodyweightExercise(log) && (!Number.isFinite(actual.weight) || actual.weight < 0)) { setMessage('Enter a valid amount completed before confirming. Repetitions and breaths must be whole numbers.'); return }
    if (dose.kind === 'strength') {
      const set = { set_number: log.set_logs.length + 1, weight: isBodyweightExercise(log) ? 0 : actual.weight, weight_unit: dose.unit, reps: actual.amount, completed_at: new Date().toISOString() }
      const sets = [...log.set_logs, set]
      const progress = workoutCompletion([{ ...log, set_logs: sets }])
      patch(index, { set_logs: sets, ...summarizeStrengthSets(sets), completed: progress.totalSets > 0 && progress.completedSets === progress.totalSets, skipped: false })
    } else patch(index, { actual_duration: ['minutes','seconds'].includes(dose.metric) ? actual.amount : 0, duration_unit: dose.metric,
      actual_reps: 0, actual_breaths: dose.metric === 'breaths' ? actual.amount : 0, activity_completed: dose.metric === 'completion', completed: true, skipped: false, confirmed_at: new Date().toISOString() })
    setMessage('Recorded in your session. Save progress whenever you need to pause.')
  }
  async function save(final = false) {
    if (!ready || lock.current) return; lock.current = true; setSaving(true); setMessage('')
    try {
      if (workoutSource === 'manual' && getClientLocalDate({ timezone }) !== date) throw new Error('A new day has started. Reopen Workout before saving this session.')
      const response = await fetch('/api/workout-log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: clientId, program, day_name: resumedIdentity.current.dayName, workout_source: workoutSource,
        workout_date: new Date().toISOString(), planned_exercises: workoutSource === 'manual' ? plannedExercises : sessionPlan,
        exercise_logs: logs.map((log, index) => {
          const { input_draft: previousDraft, ...recorded } = log
          const input = createWorkoutInputDraft(draft[index], log.session_key, weightUnit)
          return input ? { ...recorded, input_draft: input } : recorded
        }), completed: counts.completed }) })
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'Session could not be saved.')
      let evidence: ManualSaveEvidence | undefined
      if (final && workoutSource === 'manual') {
        const signature = logs.length === 1 ? manualExerciseSignature(logs[0]) : null
        if (payload.success !== true || typeof payload.session?.id !== 'string' || !payload.session.id || !signature ||
          !matchingWorkoutPlan(payload.session.exercise_logs, workoutSessionKeys(logs)) ||
          manualExerciseSignature(payload.session.exercise_logs[0]) !== signature) throw new Error('Exercise save could not be confirmed. Your draft remains available.')
        if (getClientLocalDate({ timezone }) !== date) throw new Error('A new day has started. Reopen Workout to review your saved activity.')
        evidence = { workoutLogId: payload.session.id, exerciseId: manualExerciseIdentity(logs[0]), dayName, signature }
      }
      setDirty(false); setModifiedAt(payload.session?.updated_at || new Date().toISOString()); setMessage(final ? 'Session saved. Your recorded progress is available in workout history.' : 'Progress saved. You can resume here.'); setSummary(final); router.refresh(); if(final && workoutSource === 'manual') onManualExerciseFinished?.(payload.completed === true, evidence)
    } catch(e) { setMessage(e instanceof Error ? e.message : 'Session could not be saved. Your draft is still here.') }
    finally { lock.current = false; setSaving(false) }
  }
  if ((workoutSource === 'recommended' || resumeOnly || resumeUnavailable) && !ready) return <section className="activity-session" data-testid="activity-workout-tracker" aria-label="Saved workout progress"><p role="status">{resumeUnavailable || loadFailed ? message : 'Checking your saved workout progress…'}</p>{resumeUnavailable || loadFailed ? <button type="button" onClick={() => setRetry(value => value + 1)}>Retry saved progress</button> : null}</section>
  return <section className="activity-session" data-testid="activity-workout-tracker" aria-label="Workout session">
    {!ready ? <p role="status">{loadFailed ? 'Saved progress is unavailable. Retry before editing or saving.' : 'Loading your saved progress…'}</p> : null}
    {loadFailed ? <button type="button" onClick={() => setRetry(value => value + 1)}>Retry saved progress</button> : null}
    {workoutSource === 'recommended' ? progressPercentage === null ? <p className="activity-progress-unavailable">Workout progress unavailable.</p> : <div className="activity-workout-progress">
      <div className="activity-progress-label"><span>Workout progress</span><strong>{progressPercentage}%</strong></div>
      <div className="activity-progress-bar" role="progressbar" aria-label="Today's workout progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercentage} aria-valuetext={`${progressPercentage}% of prescribed workout completed`}>
        <span style={{ width: `${progressPercentage}%` }} />
      </div>
    </div> : null}
    {manualCardio ? <p>Manual duration logging. Enter and confirm the time you actually completed. No duration target is prescribed. Distance and automatic readings are not recorded here.</p> : null}
    {logs.length ? <section className="activity-exercise-carousel" aria-label="Exercises" aria-roledescription="carousel">
      <div className="activity-carousel-pagination">
        <span role="status" aria-live="polite" aria-atomic="true">Exercise {activeIndex + 1} of {logs.length}</span>
      </div>
      <p className="activity-carousel-hint">Swipe left or right, or focus the cards and use arrow keys.</p>
      <div className="activity-exercise-track" ref={carousel} tabIndex={0} role="region" aria-label="Exercise cards" onKeyDown={event => {
        // Arrow keys inside number inputs, selects and other controls retain their native behavior.
        if (event.target !== event.currentTarget || !ready || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
        event.preventDefault()
        showExercise(event.key === 'Home' ? 0 : event.key === 'End' ? logs.length - 1 : activeIndex + (event.key === 'ArrowRight' ? 1 : -1))
      }} onScroll={event => {
        const viewport = event.currentTarget
        if (viewport.clientWidth > 0) selectExercise(Math.round(viewport.scrollLeft / viewport.clientWidth))
      }}>
      {logs.map((log, index) => {
      const dose = activityDose(log, weightUnit)
      const loadGuidance = exerciseLoadPresentation(log, guidanceContext(log, index))
      return <article key={log.session_key} className="activity-exercise" data-activity={dose.kind} role="group" aria-roledescription="slide" aria-label={`Exercise ${index + 1} of ${logs.length}: ${exerciseOccurrenceLabel(logs, index)}`} aria-hidden={index !== activeIndex} ref={node => { if (node) node.inert = index !== activeIndex }} onFocus={() => { if (index !== activeIndex) showExercise(index); onExerciseFocus?.(log) }} onBlur={onExerciseBlur}>
        <div className="tier-panel-heading"><h3>{exerciseOccurrenceLabel(logs, index)}</h3><span>{log.completed ? 'Done' : log.skipped ? 'Skipped' : dose.kind === 'strength' ? `${log.set_logs.length}/${dose.sets} sets` : 'Available'}</span></div>
        {isManualCardioExercise(log) ? <p>Record actual duration in {dose.metric}. This is a manual activity log.</p> : <p>Prescribed: {dose.metric === 'completion' ? `${log.duration_label || 'Complete the movement comfortably'} · record completion` : <>{dose.kind === 'strength' ? `${dose.sets} sets · ` : ''}{dose.prescribed || log.duration_label || 'Choose a comfortable amount'} {dose.prescribed ? dose.metric : ''}{dose.kind === 'strength' && loadGuidance.recommendationAvailable && dose.weight > 0 ? ` · ${dose.weight} ${dose.unit} ${dose.loadLabel}` : ''}</>}</p>}
        {dose.kind === 'strength' && loadGuidance.recommendationAvailable && dose.weight > 0 ? <p>Experimental load estimate, not a tested maximum for this exercise. Start conservatively and adjust to a manageable weight.</p> : null}
        {dose.kind === 'strength' && !loadGuidance.recommendationAvailable ? <p>Load recommendation unavailable. {loadGuidance.reason} Enter the {dose.unit} you actually used; zero means no added load.</p> : dose.kind === 'strength' && dose.weight === 0 ? <p>{isBodyweightExercise(log) ? 'Bodyweight · no added load.' : `No added load prescribed. Record the ${dose.unit} you actually used, including zero.`}</p> : null}
        {log.available_variants?.length > 1 ? <div className="activity-equipment-selector"><label>Equipment<select aria-label="Equipment" value={log.selected_variant_id || ''} onChange={e => {
          if (log.set_logs.length) { setMessage('Equipment is locked for this exercise because sets have been recorded.'); return }
          const selected = changePrescriptionVariant(log, e.target.value)
          if (!selected) { setMessage('This saved prescription needs review before changing its equipment. Your recorded work is preserved.'); return }
          patch(index, { ...selected, prescription_variant_edited: true })
          setDraft(current => current.map((d,i) => i === index ? { ...d, weight: selected.load_guidance_status ? NaN : activityDose(selected, weightUnit).weight, weightEdited: false, inputWeight: undefined } : d))
        }} disabled={!ready || saving || !canChangePrescriptionVariant(log)}>{!log.available_variants.some((v: any) => v.id === log.selected_variant_id) ? <option value="">Keep prescribed movement</option> : null}{log.available_variants.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label>{log.set_logs.length ? <p>Equipment is locked after recording sets so your recorded work keeps its equipment and load.</p> : !canChangePrescriptionVariant(log) ? <p>This saved prescription needs review before changing its equipment. You can keep recording your actual sets.</p> : null}</div> : null}
        {!log.completed && !log.skipped ? <>
          <div className="activity-inputs">
            {dose.kind === 'strength' && !isBodyweightExercise(log) ? <label>Weight ({dose.unit}, {dose.loadLabel})<input type="number" disabled={!ready || saving} min="0" step={weightInputIncrement(log, draft[index].weight, dose.unit)} inputMode="decimal" value={Number.isFinite(draft[index].weight) ? draft[index].weight : ''} onChange={e => { markDirty(); setDraft(current => current.map((d,i) => i === index ? { ...d, weight: e.target.value === '' ? NaN : Number(e.target.value), weightEdited: true, inputWeight: { value: e.target.value === '' ? null : Number(e.target.value), unit: weightUnit } } : d)) }}/></label> : null}
            {dose.metric !== 'completion' ? <label>{isManualCardioExercise(log) ? `Actual duration (${dose.metric})` : dose.metric === 'minutes' ? 'Duration (minutes)' : dose.metric === 'seconds' ? 'Duration (seconds)' : dose.metric === 'breaths' ? 'Breaths completed' : 'Repetitions completed'}<input type="number" disabled={!ready || saving} min="0" step={dose.metric === 'minutes' ? 0.5 : 1} inputMode="decimal" value={Number.isFinite(draft[index].amount) ? draft[index].amount : ''} onChange={e => { markDirty(); setDraft(current => current.map((d,i) => i === index ? { ...d, amount: e.target.value === '' ? NaN : Number(e.target.value), amountEdited: true } : d)) }}/></label> : <p>Confirm when you have completed this movement.</p>}
          </div>
          <div className="tier-action-row"><button type="button" onClick={() => confirm(index)} disabled={saving || !ready}>{dose.kind === 'strength' ? `Complete set ${log.set_logs.length+1}` : 'Confirm activity'}</button><button type="button" disabled={!ready || saving} onClick={() => patch(index, { skipped: true, completed: false })}>Skip exercise</button></div>
        </> : <button type="button" disabled={!ready || saving} onClick={() => patch(index, { completed: false, skipped: false })}>Edit activity</button>}
        {log.set_logs.length ? <details><summary>Recorded sets</summary>{log.set_logs.map((set: any, n: number) => <div key={`${set.set_number}:${set.completed_at}`}><p>Set {set.set_number}: {set.reps} reps · {set.weight} {set.weight_unit}</p><details><summary>Edit set {set.set_number}</summary><WorkoutSetEditor key={`${set.weight}:${set.reps}`} set={set} increment={weightInputIncrement(log, Number(set.weight), set.weight_unit === 'kg' ? 'kg' : 'lb')} loadLabel={dose.loadLabel} disabled={!ready || saving} bodyweight={isBodyweightExercise(log)} onSave={values => {
          const sets = log.set_logs.map((existing: any, i: number) => i === n ? { ...existing, ...values } : existing)
          const progress = workoutCompletion([{ ...log, set_logs: sets }])
          patch(index, { set_logs: sets, ...summarizeStrengthSets(sets), completed: progress.totalSets > 0 && progress.completedSets === progress.totalSets, skipped: false })
        }} /></details><button type="button" disabled={!ready || saving} onClick={() => { const sets = log.set_logs.filter((_: any,i: number) => i !== n).map((s: any,i: number) => ({ ...s, set_number: i+1 })); const progress = workoutCompletion([{ ...log, set_logs: sets }]); patch(index, { set_logs: sets, ...summarizeStrengthSets(sets), completed: progress.totalSets > 0 && progress.completedSets === progress.totalSets, skipped: false }) }}>Remove set {set.set_number}</button></div>)}</details> : null}
        {log.client_cues?.length ? <details><summary>Form guidance</summary>{log.client_cues.map((cue: string) => <p key={cue}>{cue}</p>)}</details> : null}
      </article>
      })}
      </div>
    </section> : null}
    <div className="tier-action-row"><button type="button" disabled={saving || !ready} onClick={() => void save()}>Save / pause</button><button type="button" className="tier-primary-action" disabled={saving || !ready} onClick={() => void save(true)}>{saving ? 'Saving…' : 'Finish and review'}</button></div>
    {ready ? <p>{manualCardio ? counts.completed ? 'Your confirmed duration is ready to save in workout history.' : 'Save / pause retains this session. Confirm your actual duration before marking it complete.' : counts.completed ? 'Your recorded sets meet the workout checkoff threshold. Save your progress; you can continue with the remaining sets.' : 'Finish and review saves a partial session. Record at least half of all prescribed sets to qualify for workout checkoff.'}</p> : null}
    <p role="status">{message}</p>
    {summary ? <article className="daily-plan-card phone-app-session-summary" aria-label="Session summary" role="status">
      <span className="phone-app-save-mark" aria-hidden="true">✓</span><p className="phone-app-eyebrow">Session saved</p>
      <h3>{workoutSource === 'manual' ? counts.completed ? 'Exercise saved' : 'Partial exercise saved' : counts.completed ? 'You made time for strength.' : 'Partial session saved'}</h3>
      <p>{counts.complete} complete · {counts.partial} partial · {counts.skipped} skipped · {counts.total} planned</p><p>{totals.sets} strength sets · {totals.reps} reps · {Math.round(totals.minutes * 10) / 10} minutes · {totals.breaths} breaths · {totals.activities} movements completed</p>
      {manualCardio ? <p>{counts.completed ? 'Confirmed duration saved.' : 'This activity remains incomplete.'}</p> : <p>{counts.completedSets} of {counts.totalSets} prescribed sets recorded. {counts.completed ? 'Workout checkoff threshold met.' : 'Workout checkoff threshold not met yet.'}</p>}
      <p>Your confirmed work is saved. You can return to the remaining exercises.</p>
      <details><summary>Session overview · Recorded sets</summary>{logs.filter(log => log.set_logs.length).map(log => <section key={log.session_key}><h4>{log.display_name || log.exercise}</h4>{log.set_logs.map((set: any, index: number) => <p key={index}>Set {set.set_number}: {set.reps} reps · {set.weight} {set.weight_unit}{set.completed_at ? ` · ${new Date(set.completed_at).toLocaleTimeString([], { timeZone: timezone, hour: 'numeric', minute: '2-digit' })}` : ''}</p>)}</section>)}<p>Heart-rate readings and continuous set/rest intervals are unavailable. No watch connection is established by this screen.</p></details>
      <Link href={`/dashboard/program/${program}`}>Back to Today</Link>
    </article> : null}
  </section>
}
