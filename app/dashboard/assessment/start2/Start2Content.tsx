'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { StrengthDraftSession } from '@/lib/assessments/strengthDraftSession'
import { STRENGTH_FIELDS } from '@/lib/assessments/strengthAssessment'
import { useStrengthDraftAutosave, useUnsavedAssessmentGuard } from '@/lib/assessments/useStrengthDraft'
import Link from 'next/link'
import PhoneAppFrame from '@/components/phone-app/PhoneAppFrame'
import { strengthFormDefaults, strengthMovements, type StrengthFormHistory } from '@/lib/assessment/strengthForm'
import '@/components/phone-app/assessments.css'

type ClientData = {
  client_id: string
  full_name?: string
  email?: string
  birthdate?: string
  program?: string
  height_in?: number | string
}

function displayDate(value: string | null, timeZone: string, withTime = true) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString(undefined, withTime
    ? { timeZone, year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }
    : { timeZone: /^\d{4}-\d{2}-\d{2}$/.test(value) ? 'UTC' : timeZone, year: 'numeric', month: 'long', day: 'numeric' })
}
function displayPeriod(value: string | null) {
  return value ? new Date(`${value.slice(0, 10)}T12:00:00Z`).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' }) : ''
}

export default function Start2Content({ client, history, period, assessmentId, timeZone = 'America/Chicago', canEdit = true }: {
  client: ClientData; history: StrengthFormHistory; period?: string; assessmentId?: string; timeZone?: string; canEdit?: boolean
}) {
  const router = useRouter()
  const [session] = useState(() => {
    const defaults = strengthFormDefaults(client, history)
    return new StrengthDraftSession(Object.fromEntries(STRENGTH_FIELDS.map(field => [field, defaults[field] || ''])), undefined, client.client_id)
  })
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot)
  const [offline, setOffline] = useState(false)
  const [submittedHere, setSubmittedHere] = useState(false)
  const refreshedWrites = useRef(0)
  const completed = state.status === 'completed'
  const disabled = !canEdit || !state.loaded || state.loading || state.submitting || completed
  const formData = state.values
  useUnsavedAssessmentGuard(session)
  useStrengthDraftAutosave(session, state, offline || !canEdit)
  useEffect(() => { void session.load(period, assessmentId) }, [session, period, assessmentId])
  useEffect(() => {
    if (state.confirmedWrites <= refreshedWrites.current) return
    refreshedWrites.current = state.confirmedWrites
    window.dispatchEvent(new Event('anastasis:daily-plan-updated'))
    router.refresh()
  }, [router, state.confirmedWrites])
  useEffect(() => {
    const disconnected = () => setOffline(true)
    const connected = () => { setOffline(false); if (canEdit && session.getSnapshot().unsaved) void session.save() }
    setOffline(!navigator.onLine)
    window.addEventListener('offline', disconnected)
    window.addEventListener('online', connected)
    return () => { window.removeEventListener('offline', disconnected); window.removeEventListener('online', connected) }
  }, [session, canEdit])
  function handleChange(event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    if (!canEdit) return
    session.change(event.target.name, event.target.value)
  }
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canEdit || !state.canComplete) return
    if (await session.submit()) setSubmittedHere(true)
  }
  function reviewSaved() {
    if (state.unsaved && !window.confirm('Replace the values on this page with the assessment saved to your account? Unsaved changes on this page will be discarded.')) return
    void session.reviewSaved()
  }

  const previous = (key: string, unit: string) => history.unavailable
    ? 'Previous results unavailable.'
    : history.values[key] !== undefined ? `Last: ${history.values[key]} ${unit}` : 'No previous result.'

  return (
    <PhoneAppFrame eyebrow="Strength Assessment" title="Strength Assessment" subtitle={completed ? 'Your saved assessment results.' : state.status === 'draft' ? 'Continue where you stopped.' : 'Let’s measure your current capacity.'}>
      <main className="assessment-content">
        <p className="assessment-history">{history.completedAt
          ? `Last completed: ${new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(history.completedAt))}`
          : history.unavailable ? 'Previous assessment could not be loaded. Your new results remain blank.' : 'Your first completed assessment will become your comparison baseline.'}</p>
        <details className="assessment-notice"><summary>About assessment timing</summary><p>Your first strength baseline is available now. Reassessment becomes eligible three calendar months after your latest completed strength assessment and is scheduled as your workout on the next Monday, including that day when it is Monday. If Monday’s workout is already completed, the assessment moves to Tuesday. Your saved draft stays available.</p></details>
        {!completed && state.eligibleDate && !state.canComplete ? <p role="status" className="assessment-notice">Your next strength reassessment is eligible on {displayDate(state.eligibleDate, timeZone, false)}. You can keep saving your draft.</p> : null}
        {state.period ? <p className="assessment-history">Assessment month: {displayPeriod(state.period)}</p> : null}
        {completed ? <p role="status">Completed · Original assessment date: <time dateTime={state.assessmentDate || state.completedAt || undefined}>{displayDate(state.assessmentDate || state.completedAt, timeZone, false)}</time></p> : null}
        {state.loading ? <p role="status">Loading your saved assessment…</p> : null}
        {state.loadError ? <div role="alert" className="assessment-notice"><p>{state.loadError}</p><button type="button" className="assessment-action" disabled={state.loading} onClick={() => { if (state.unsaved) reviewSaved(); else void session.load(state.period || period, state.assessmentId || assessmentId) }}>Retry loading</button></div> : null}
        {state.previousDraft?.period && state.previousDraft.period !== state.period ? <section className="assessment-notice"><p>An unfinished assessment for {displayPeriod(state.previousDraft.period)} was last saved {displayDate(state.previousDraft.savedAt, timeZone)}.</p><button type="button" className="assessment-action" disabled={state.unsaved || state.saving || state.submitting} onClick={() => { void session.load(state.previousDraft?.period) }}>Resume earlier assessment</button></section> : null}
        {state.period && state.currentPeriod && state.period !== state.currentPeriod ? <section className="assessment-notice"><p>{state.monthChanged ? 'A new month started before your first save. Your entered measurements are still on this page.' : `You are continuing your ${displayPeriod(state.period)} assessment. Completing it preserves that month’s history.`}</p>{state.monthChanged ? <button type="button" className="assessment-action" disabled={!canEdit || state.loading || state.saving || state.submitting} onClick={() => { void session.continueInCurrentPeriod() }}>Save entered values for the new month</button> : <button type="button" className="assessment-action" disabled={state.unsaved || state.saving || state.submitting} onClick={() => { void session.load(state.currentPeriod || undefined) }}>View current-month assessment</button>}</section> : null}
        <form onSubmit={handleSubmit} className="assessment-form" aria-busy={state.loading || state.submitting}>
          <section className="assessment-notice" aria-label="Cloud save status">
            <div role="status" aria-live="polite" aria-atomic="true">
              {completed ? <p>Your assessment is complete. These saved results are read-only.</p>
                : !canEdit ? <p>Your saved assessment is available to read. An eligible active membership is required to save or complete an assessment.</p>
                  : state.submitting ? <p>Submitting your assessment… Keep this page open until completion is confirmed.</p>
                  : state.saving ? <p>Saving draft to your account…</p>
                    : offline && state.unsaved ? <p>You’re offline. Changes are only held on this page and haven’t been saved to your account. Keep this page open and retry when connected.</p>
                      : state.unsaved ? <p>Changes haven’t been saved yet.</p>
                        : state.status === 'draft' ? <p>In Progress · Your assessment was saved as a draft.</p>
                          : state.loaded ? <p>Drafts save automatically after you make changes. You can also choose Save Draft.</p> : null}
              {state.savedAt ? <p>Last successful cloud save: <time dateTime={state.savedAt}>{displayDate(state.savedAt, timeZone)}</time> ({timeZone})</p> : null}
            </div>
            {state.saveError ? <p role="alert">{state.saveError}</p> : null}
            {state.submitError ? <p role="alert">{state.submitError}</p> : null}
            {state.conflict ? <button type="button" className="assessment-action" disabled={state.loading} onClick={reviewSaved}>Review saved assessment</button> : null}
            {!completed ? <button type="button" className="assessment-action" disabled={disabled || state.saving || state.conflict} onClick={() => { void session.save() }}>{state.saving ? 'Saving Draft…' : state.saveError ? 'Retry Saving Draft' : 'Save Draft'}</button> : null}
          </section>
          <fieldset disabled={disabled} className="assessment-section">
            <legend>Your details</legend>
            <p>{client.full_name}<br />{client.email}</p>
            <div className="assessment-fields">
              <label className="assessment-field" htmlFor="birthdate">Birthdate
                <input id="birthdate" name="birthdate" type="date" value={formData.birthdate} onChange={handleChange} readOnly={Boolean(client.birthdate)} />
                {client.birthdate ? <small>From your saved profile</small> : <small>No saved birthdate</small>}
              </label>
              <label className="assessment-field" htmlFor="height_in">Height (inches)
                <input id="height_in" name="height_in" inputMode="decimal" required value={formData.height_in} onChange={handleChange} />
                {strengthFormDefaults(client, history).height_in ? <small>From your saved details</small> : <small>No saved height. Enter it here.</small>}
              </label>
              <label className="assessment-field" htmlFor="weight">Current weight (lb)
                <input id="weight" name="weight" inputMode="decimal" required value={formData.weight} onChange={handleChange} />
              </label>
              <label className="assessment-field" htmlFor="weight_goal">Weight goal (lb)
                <input id="weight_goal" name="weight_goal" inputMode="decimal" value={formData.weight_goal} onChange={handleChange} />
              </label>
              <label className="assessment-field assessment-wide" htmlFor="training_environment">Training environment
                <select id="training_environment" name="training_environment" value={formData.training_environment} onChange={handleChange}><option value="">Select environment</option><option value="gym">Gym</option><option value="home">Home</option></select>
              </label>
            </div>
          </fieldset>
          {(['upper', 'lower'] as const).map(group => <fieldset disabled={disabled} className="assessment-section" key={group}>
            <legend>{group === 'upper' ? 'Upper body' : 'Lower body'}</legend>
            {strengthMovements.filter(([, , category]) => category === group).map(([key, label]) => <div className="assessment-exercise" key={key}>
              <h3>{label}</h3><div className="assessment-fields">
                {(['weight', 'reps'] as const).map(kind => {
                  const name = `${key}_${kind}`, unit = kind === 'weight' ? 'lb' : 'reps'
                  return <label key={name} className="assessment-field" htmlFor={name}>{kind === 'weight' ? 'Weight (lb)' : 'Reps'}
                    <input id={name} name={name} inputMode={kind === 'weight' ? 'decimal' : 'numeric'} value={formData[name]} onChange={handleChange} aria-describedby={`${name}-last`} />
                    <small id={`${name}-last`}>{previous(name, unit)}</small>
                  </label>
                })}
              </div>
            </div>)}
          </fieldset>)}
          <fieldset disabled={disabled} className="assessment-section"><legend>Core</legend>
            <label className="assessment-field" htmlFor="plank_time">Plank hold (seconds)
              <input id="plank_time" name="plank_time" inputMode="decimal" value={formData.plank_time} onChange={handleChange} aria-describedby="plank-last" />
              <small id="plank-last">{previous('plank_time', 'seconds')}</small>
            </label>
          </fieldset>
          <p className="assessment-notice">Record only the movements you tested. Leave untested weight and reps blank.</p>
          {!completed ? <button type="submit" disabled={disabled || state.conflict || !state.canComplete} className="assessment-action">{state.submitting ? 'Submitting…' : state.submitError ? 'Retry Submission' : 'Submit Assessment'}</button> : <div><Link href="/dashboard" className="assessment-action">Return to Dashboard</Link> <Link href="/dashboard/progress" className="assessment-action">View Progress</Link></div>}
          {completed && submittedHere && state.planStatus === 'safety_paused' ? <p role="status">Your assessment is saved. Your training plan needs a safety review before you continue.</p> : null}
          {completed && submittedHere && state.planStatus === 'retry' ? <p role="status">Your assessment is saved. <Link href="/dashboard/onboarding/plan">Retry creating your training plan from your saved assessments.</Link></p> : null}
        </form>
        {state.history.length ? <section className="assessment-notice" aria-labelledby="strength-history-title"><h2 id="strength-history-title">Assessment history</h2><p>Every completed assessment keeps its original date and saved measurements.</p><ul>{state.history.map((record, index) => <li key={record.assessmentId}><Link href={`/dashboard/assessment/start2?period=${encodeURIComponent(record.period)}&assessmentId=${encodeURIComponent(record.assessmentId)}`} aria-current={state.assessmentId === record.assessmentId ? 'page' : undefined}>View saved assessment {index + 1} · {displayDate(record.assessmentDate, timeZone)}</Link></li>)}</ul></section> : null}
      </main>
    </PhoneAppFrame>
  )
}
