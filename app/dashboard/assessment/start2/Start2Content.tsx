'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { StrengthDraftSession } from '@/lib/assessments/strengthDraftSession'
import { useStrengthDraftAutosave, useUnsavedAssessmentGuard } from '@/lib/assessments/useStrengthDraft'
import * as styles from '../../../styles/globalstyles'

type ClientData = { client_id: string; full_name?: string; email?: string; birthdate?: string; program?: string }

const measurements = [
  { title: 'Upper Body', lifts: [
    ['shoulder_press', 'Shoulder Press'], ['bench_press', 'Bench Press'],
    ['close_grip_press', 'Close Grip Press'], ['seated_row', 'Seated Row'],
    ['bicep_curl', 'Bicep Curl'], ['lateral_raise', 'Lateral Raise'],
  ] },
  { title: 'Lower Body', lifts: [['squat', 'Squat'], ['romanian_deadlift', 'Romanian Deadlift']] },
] as const

function initialValues(client: ClientData) {
  return {
    birthdate: client.birthdate || '', height_in: '', weight: '', weight_goal: '', training_environment: '',
    ...Object.fromEntries(measurements.flatMap(section => section.lifts.flatMap(([key]) => [[`${key}_weight`, ''], [`${key}_reps`, '']]))),
    plank_time: '',
  }
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

export default function Start2Content({ client, period, assessmentId, timeZone = 'America/Chicago' }: { client: ClientData; period?: string; assessmentId?: string; timeZone?: string }) {
  const router = useRouter()
  const [session] = useState(() => new StrengthDraftSession(initialValues(client), undefined, client.client_id))
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot)
  const [offline, setOffline] = useState(false)
  const [submittedHere, setSubmittedHere] = useState(false)
  const refreshedWrites = useRef(0)
  const completed = state.status === 'completed'
  const disabled = !state.loaded || state.loading || state.submitting || completed

  useUnsavedAssessmentGuard(session)
  useStrengthDraftAutosave(session, state, offline)

  useEffect(() => {
    if (state.confirmedWrites <= refreshedWrites.current) return
    refreshedWrites.current = state.confirmedWrites
    window.dispatchEvent(new Event('anastasis:daily-plan-updated'))
    router.refresh()
  }, [router, state.confirmedWrites])

  useEffect(() => { void session.load(period, assessmentId) }, [session, period, assessmentId])
  useEffect(() => {
    const disconnected = () => setOffline(true)
    const connected = () => { setOffline(false); if (session.getSnapshot().unsaved) void session.save() }
    setOffline(!navigator.onLine)
    window.addEventListener('offline', disconnected)
    window.addEventListener('online', connected)
    return () => { window.removeEventListener('offline', disconnected); window.removeEventListener('online', connected) }
  }, [session])
  function handleChange(event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    session.change(event.target.name, event.target.value)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (await session.submit()) {
      setSubmittedHere(true)
    }
  }

  function reviewSaved() {
    if (state.unsaved && !window.confirm('Replace the values on this page with the assessment saved to your account? Unsaved changes on this page will be discarded.')) return
    void session.reviewSaved()
  }

  return (
    <main className="aos-flow-page">
      <div className="aos-flow-shell">
        <header className="aos-flow-hero">
          <p className="aos-eyebrow">Strength Assessment{state.period ? ` · ${displayPeriod(state.period)}` : ''}</p>
          <h1>{completed ? 'Your strength assessment is complete.' : state.status === 'draft' ? 'Resume your strength assessment.' : 'Let’s measure your current capacity.'}</h1>
          {completed ? <p style={styles.bodyStyle}>Completed · Original assessment date: <time dateTime={state.assessmentDate || state.completedAt || undefined}>{displayDate(state.assessmentDate || state.completedAt, timeZone, false)}</time></p> : null}
          {state.period && state.currentPeriod && state.period !== state.currentPeriod ? <div><p style={styles.bodyStyle}>{state.monthChanged ? 'A new month started before your first save. Your entered measurements are still on this page.' : `You are continuing your ${displayPeriod(state.period)} assessment. Completing it preserves that month’s history.`}</p>{state.monthChanged ? <button type="button" style={styles.secondaryButtonStyle} disabled={state.loading || state.saving || state.submitting} onClick={() => { void session.continueInCurrentPeriod() }}>Save entered values for the new month</button> : <button type="button" style={styles.secondaryButtonStyle} disabled={state.unsaved || state.saving || state.submitting} onClick={() => { void session.load(state.currentPeriod || undefined) }}>View {displayPeriod(state.currentPeriod)} Assessment</button>}</div> : null}
        </header>

        {state.loading ? <p role="status" style={styles.bodyStyle}>Loading your saved assessment…</p> : null}
        {state.loadError ? <div role="alert" style={styles.cartBoxStyle}><p style={styles.bodyStyle}>{state.loadError}</p><button type="button" style={styles.secondaryButtonStyle} disabled={state.loading} onClick={() => { if (state.unsaved) reviewSaved(); else void session.load(state.period || period, state.assessmentId || assessmentId) }}>Retry loading</button></div> : null}
        {state.previousDraft?.period && state.previousDraft.period !== state.period ? <div style={{ ...styles.cartBoxStyle, marginBottom: 24 }}>
          <p style={styles.bodyStyle}>You also have an unfinished assessment for {displayPeriod(state.previousDraft.period)}. Last cloud save: {displayDate(state.previousDraft.savedAt, timeZone)}.</p>
          <button type="button" style={styles.secondaryButtonStyle} disabled={state.unsaved || state.saving || state.submitting} onClick={() => { void session.load(state.previousDraft?.period) }}>Resume {displayPeriod(state.previousDraft.period)} Assessment</button>
        </div> : null}

        {!completed ? <div style={{ ...styles.cartBoxStyle, marginBottom: '28px' }}>
          <p style={styles.eyebrowStyle}>Best Timing</p>
          <h2 style={styles.sectionTitleStyle}>Strength testing is best during your ovulatory window when possible.</h2>
          <p style={styles.bodyStyle}>For the cleanest workout and recovery calculations, we recommend completing this assessment during your ovulatory window or best-estimate ovulatory week.</p>
          <p style={styles.bodyStyle}>If you do not know your ovulatory window yet, complete what you can. Your draft saves to your account, so you can return and continue later.</p>
        </div> : null}

        <form onSubmit={handleSubmit} style={styles.cartBoxStyle} aria-busy={state.loading || state.submitting}>
          <p style={styles.bodyStyle}>{client.full_name}</p>
          {completed ? <h2 style={styles.sectionTitleStyle}>Saved results</h2> : <p style={styles.bodyStyle}>Enter weight in pounds. Height and current weight are required to complete. Leave untested movements blank. Drafts can be incomplete.</p>}

          <div style={{ position: completed ? 'static' : 'sticky', top: 8, zIndex: 5, background: '#100c0a', border: '1px solid rgba(217,91,48,.2)', borderRadius: 14, padding: 14, margin: '18px 0' }}>
            <div role="status" aria-live="polite" aria-atomic="true">
              {completed ? <p style={styles.bodyStyle}>Your assessment is complete. Your results are saved to your account.</p>
                : state.submitting ? <p style={styles.bodyStyle}>Submitting your assessment… Keep this page open until completion is confirmed.</p>
                  : state.saving ? <p style={styles.bodyStyle}>Saving draft to your account…</p>
                    : offline && state.unsaved ? <p style={styles.bodyStyle}>You’re offline. Changes are only held on this page and haven’t been saved to your account. Keep this page open, then retry saving when connected.</p>
                      : state.unsaved ? <p style={styles.bodyStyle}>Changes haven’t been saved yet.</p>
                        : state.status === 'draft' ? <p style={styles.bodyStyle}>In Progress · Your assessment was saved as a draft.</p>
                          : state.loaded ? <p style={styles.bodyStyle}>Drafts save automatically after you make changes. You can also choose Save Draft.</p> : null}
              {state.savedAt ? <p style={styles.bodyStyle}>Last successful cloud save: <time dateTime={state.savedAt}>{displayDate(state.savedAt, timeZone)}</time> ({timeZone})</p> : null}
            </div>
            {state.saveError ? <p role="alert" style={styles.bodyStyle}>{state.saveError}</p> : null}
            {state.submitError ? <p role="alert" style={styles.bodyStyle}>{state.submitError}</p> : null}
            {state.conflict ? <button type="button" style={styles.secondaryButtonStyle} disabled={state.loading} onClick={reviewSaved}>Review saved assessment</button> : null}
            {!completed ? <button type="button" disabled={disabled || state.saving || state.conflict} style={styles.secondaryButtonStyle} onClick={() => { void session.save() }}>{state.saving ? 'Saving Draft…' : state.saveError ? 'Retry Saving Draft' : 'Save Draft'}</button> : null}
          </div>

          <fieldset disabled={disabled} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
            <legend className="sr-only">Strength assessment measurements</legend>
            <div style={styles.fieldWrap}>
              <label style={styles.labelStyle} htmlFor="birthdate">Birthdate (optional)</label>
              <input id="birthdate" name="birthdate" type="date" value={state.values.birthdate} onChange={handleChange} style={styles.inputStyle} />
              <label style={styles.labelStyle} htmlFor="height_in">Height (inches)</label>
              <input id="height_in" name="height_in" inputMode="decimal" required value={state.values.height_in} onChange={handleChange} style={styles.inputStyle} />
              <label style={styles.labelStyle} htmlFor="weight">Current weight (pounds)</label>
              <input id="weight" name="weight" inputMode="decimal" required value={state.values.weight} onChange={handleChange} style={styles.inputStyle} />
              <label style={styles.labelStyle} htmlFor="weight_goal">Weight goal (optional)</label>
              <input id="weight_goal" name="weight_goal" value={state.values.weight_goal} onChange={handleChange} style={styles.inputStyle} />
              <label style={styles.labelStyle} htmlFor="training_environment">Training environment (optional)</label>
              <select id="training_environment" name="training_environment" value={state.values.training_environment} onChange={handleChange} style={styles.inputStyle}>
                <option value="">Choose environment</option><option value="gym">Gym</option><option value="home">Home</option>
              </select>

              {measurements.map(section => <div key={section.title} style={styles.fieldWrap}>
                <h3 style={styles.sectionTitleStyle}>{section.title}</h3>
                {section.lifts.map(([key, label]) => <div key={key} style={styles.fieldWrap}>
                  <label style={styles.labelStyle} htmlFor={`${key}_weight`}>{label} weight (pounds)</label>
                  <input id={`${key}_weight`} name={`${key}_weight`} inputMode="decimal" value={state.values[`${key}_weight`]} onChange={handleChange} style={styles.inputStyle} />
                  <label style={styles.labelStyle} htmlFor={`${key}_reps`}>{label} repetitions</label>
                  <input id={`${key}_reps`} name={`${key}_reps`} inputMode="numeric" value={state.values[`${key}_reps`]} onChange={handleChange} style={styles.inputStyle} />
                </div>)}
              </div>)}
              <h3 style={styles.sectionTitleStyle}>Core</h3>
              <label style={styles.labelStyle} htmlFor="plank_time">Plank time (seconds, optional)</label>
              <input id="plank_time" name="plank_time" inputMode="decimal" value={state.values.plank_time} onChange={handleChange} style={styles.inputStyle} />
            </div>
          </fieldset>

          {!completed ? <div style={styles.buttonRowStyle}>
            <button type="submit" disabled={disabled || state.conflict} style={styles.primaryButtonStyle}>{state.submitting ? 'Submitting…' : state.submitError ? 'Retry Submission' : 'Submit Assessment'}</button>
          </div> : <div style={styles.buttonRowStyle}>
            <Link href="/dashboard" style={styles.primaryButtonStyle}>Return to Dashboard</Link>
            <Link href="/dashboard/progress" style={styles.secondaryButtonStyle}>View Progress</Link>
          </div>}
          {completed && submittedHere && state.planStatus === 'safety_paused' ? <p role="status" style={styles.bodyStyle}>Your assessment is saved. Your training plan needs a safety review before you continue.</p> : null}
          {completed && submittedHere && state.planStatus === 'retry' ? <p role="status" style={styles.bodyStyle}>Your assessment is saved. <Link href="/dashboard/onboarding/plan">Retry creating your training plan from your saved assessments.</Link></p> : null}
        </form>
        {state.history.length ? <section style={styles.cartBoxStyle} aria-labelledby="strength-history-title">
          <h2 id="strength-history-title" style={styles.sectionTitleStyle}>Assessment history</h2>
          <p style={styles.bodyStyle}>Every completed assessment keeps its original date and saved measurements.</p>
          <ul>{state.history.map((record, index) => <li key={record.assessmentId} style={{ marginBottom: 14 }}>
            <Link href={`/dashboard/assessment/start2?period=${encodeURIComponent(record.period)}&assessmentId=${encodeURIComponent(record.assessmentId)}`} aria-current={state.assessmentId === record.assessmentId ? 'page' : undefined} style={styles.quietLinkStyle}>View saved assessment {index + 1} · {displayDate(record.assessmentDate, timeZone)}</Link>
          </li>)}</ul>
        </section> : null}
      </div>
    </main>
  )
}
