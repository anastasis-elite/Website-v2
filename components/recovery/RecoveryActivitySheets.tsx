'use client'

import { useId, useRef, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import ActionArrow from '@/components/ActionArrow'
import { calculateWalkPace, validateDetailedRecovery } from '@/lib/recovery/activityDetails'
import { formatRecoveryDetails } from '@/lib/recovery/activityDisplay'

type Practice = 'slow_walk' | 'warm_soak'
type Addition = 'epsom_salts' | 'herbs' | 'tea' | 'oats' | 'other' | 'none'
type Draft = {
  minutes: string; distance: string; distanceUnit: 'mi' | 'km'; heartRate: string
  temperature: string; temperatureUnit: 'F' | 'C'; additions: Addition[]
  herbs: string; tea: string; other: string
}
type Submission = {
  clientId: string; activityType: string; minutes: number; requestId: string
  details: Record<string, unknown>
}
const emptyDraft = (): Draft => ({ minutes: '', distance: '', distanceUnit: 'mi', heartRate: '', temperature: '', temperatureUnit: 'F', additions: [], herbs: '', tea: '', other: '' })
const additions: Array<[Addition, string]> = [['epsom_salts', 'Epsom salts'], ['herbs', 'Herbs'], ['tea', 'Teas'], ['oats', 'Oats'], ['other', 'Other'], ['none', 'None']]

export default function RecoveryActivitySheets({ clientId }: { clientId: string }) {
  const router = useRouter()
  const id = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement | null>(null)
  const durationInput = useRef<HTMLInputElement>(null)
  const lock = useRef(false)
  const submission = useRef<Submission | null>(null)
  const requestId = useRef('')
  const [practice, setPractice] = useState<Practice>('slow_walk')
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [saving, setSaving] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const title = practice === 'slow_walk' ? 'Slow walk' : 'Warm soak'

  function open(next: Practice, button: HTMLButtonElement) {
    if (lock.current) return
    trigger.current = button
    setPractice(next); setDraft(emptyDraft()); setSaved(false); setAttempted(false); setError('')
    submission.current = null
    requestId.current = crypto.randomUUID()
    dialog.current?.showModal()
    durationInput.current?.focus()
  }
  function close() { if (!lock.current) dialog.current?.close() }
  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft(current => ({ ...current, [key]: value })); setError('')
  }
  function toggleAddition(value: Addition) {
    setDraft(current => ({ ...current, additions: current.additions.includes(value)
      ? current.additions.filter(item => item !== value)
      : value === 'none' ? ['none'] : [...current.additions.filter(item => item !== 'none'), value] }))
    setError('')
  }
  function buildSubmission(): Submission {
    const details: Record<string, unknown> = { kind: practice, source: 'manual' }
    if (practice === 'slow_walk') {
      if (draft.distance.trim()) { details.distance = Number(draft.distance); details.distanceUnit = draft.distanceUnit }
      if (draft.heartRate.trim()) details.heartRateBpm = Number(draft.heartRate)
    } else {
      if (draft.temperature.trim()) { details.temperature = Number(draft.temperature); details.temperatureUnit = draft.temperatureUnit }
      details.additions = draft.additions
      for (const key of ['herbs', 'tea', 'other'] as const) {
        if (draft.additions.includes(key)) details[key] = draft[key].trim()
      }
    }
    return { clientId, activityType: practice === 'slow_walk' ? 'Gentle walk' : 'Warm soak', minutes: Number(draft.minutes), requestId: requestId.current, details }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (lock.current || saved) return
    setError('')
    let body: Submission
    try {
      body = submission.current || buildSubmission()
      validateDetailedRecovery(body)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Check your entries and try again.')
      return
    }
    submission.current = body
    lock.current = true; setSaving(true); setAttempted(true)
    try {
      const response = await fetch('/api/recovery/activity', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const payload = await response.json().catch(() => null)
      if (!response.ok || payload?.success !== true) throw new Error(payload?.error || 'The save could not be confirmed. Please retry.')
      setSaved(true); router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The save could not be confirmed. Please retry.')
    } finally {
      lock.current = false; setSaving(false)
    }
  }
  const pace = calculateWalkPace(Number(draft.minutes), Number(draft.distance))

  return <>
    {([
      ['slow_walk', 'Slow walk', 'Fresh air, a calmer mind.', 'training'],
      ['warm_soak', 'Warm soak', 'A little warmth goes a long way.', 'water'],
    ] as const).map(([kind, label, copy, illustration]) => <article className="phone-app-card" key={kind}>
      <img src={`/illustrations/today-${illustration}.svg`} alt="" width="360" height="180" />
      <div><h3>{label}</h3><p>{copy}</p><button className="recovery-practice-trigger" type="button" aria-haspopup="dialog" aria-controls={id} onClick={event => open(kind, event.currentTarget)}>Log {label.toLowerCase()}<ActionArrow className="phone-app-action-arrow" /></button></div>
    </article>)}
    <dialog ref={dialog} id={id} className="phone-app-practice-dialog recovery-activity-sheet" aria-labelledby={`${id}-title`} aria-describedby={`${id}-intro`} onCancel={event => { if (lock.current) event.preventDefault() }} onClose={() => trigger.current?.focus()}>
      <header><h2 id={`${id}-title`}>{title}</h2><button type="button" disabled={saving} onClick={close}>{saved ? 'Close' : 'Cancel'}</button></header>
      <p id={`${id}-intro`}>{practice === 'slow_walk' ? 'Record the walk you completed. All entries here are manual.' : 'Record the soak you completed. Temperature and additions are optional.'}</p>
      {practice === 'slow_walk' ? <p className="recovery-manual-note">Watch connection is unavailable in this PWA. Watch workouts and heart rate cannot be imported here; native watch support is not available yet.</p> : null}
      {saved ? <div role="status" className="recovery-save-confirmation"><p>{title} saved.</p>{formatRecoveryDetails(validateDetailedRecovery(submission.current!).details).map(line => <p key={line}>{line}</p>)}</div> : <form onSubmit={save} aria-busy={saving}>
        <fieldset disabled={saving || attempted}>
          <legend>Completed {title.toLowerCase()}</legend>
          <label>Actual duration (minutes)<input ref={durationInput} type="number" inputMode="decimal" min="0" max="1440" step="any" value={draft.minutes} onChange={event => update('minutes', event.target.value)} required /></label>
          {practice === 'slow_walk' ? <>
            <div className="recovery-entry-row">
              <label>Distance (optional)<input type="number" inputMode="decimal" min="0" max="1000" step="any" value={draft.distance} onChange={event => update('distance', event.target.value)} /></label>
              <label>Distance unit<select value={draft.distanceUnit} onChange={event => update('distanceUnit', event.target.value as Draft['distanceUnit'])}><option value="mi">Miles</option><option value="km">Kilometers</option></select></label>
            </div>
            <p role="status">{pace !== null ? `Calculated pace: ${pace.toFixed(2)} min/${draft.distanceUnit} (from your entries)` : 'Add a positive duration and distance to calculate pace.'}</p>
            <label>Heart rate (manual, optional, bpm)<input type="number" inputMode="numeric" min="1" max="300" step="1" value={draft.heartRate} onChange={event => update('heartRate', event.target.value)} /></label>
          </> : <>
            <div className="recovery-entry-row">
              <label>Approximate temperature (optional)<input type="number" inputMode="decimal" step="any" value={draft.temperature} onChange={event => update('temperature', event.target.value)} /></label>
              <label>Temperature unit<select value={draft.temperatureUnit} onChange={event => update('temperatureUnit', event.target.value as Draft['temperatureUnit'])}><option value="F">°F</option><option value="C">°C</option></select></label>
            </div>
            <fieldset className="recovery-additions"><legend>Additions (optional; choose all that apply)</legend>
              {additions.map(([value, label]) => <label key={value}><input type="checkbox" checked={draft.additions.includes(value)} onChange={() => toggleAddition(value)} />{label}</label>)}
            </fieldset>
            {(['herbs', 'tea', 'other'] as const).filter(key => draft.additions.includes(key)).map(key => <label key={key}>{key === 'herbs' ? 'Specific herbs' : key === 'tea' ? 'Specific teas' : 'Other addition'}<input type="text" maxLength={120} value={draft[key]} onChange={event => update(key, event.target.value)} required /></label>)}
          </>}
        </fieldset>
        {error ? <p role="alert">{error}</p> : null}
        {attempted && !saving ? <p className="recovery-manual-note">The save was not confirmed. Retry uses the same entry to prevent duplicates. Your entries are kept unchanged for retry.</p> : null}
        <div className="recovery-sheet-actions"><button type="submit" disabled={saving}>{saving ? 'Saving…' : attempted ? 'Retry save' : `Save ${title.toLowerCase()}`}</button><button type="button" disabled={saving} onClick={close}>Cancel</button></div>
      </form>}
    </dialog>
  </>
}
