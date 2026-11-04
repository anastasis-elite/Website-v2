'use client'

import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { MUSCLE_GROUP_OPTIONS, WEEKDAYS, type WeekdayMuscleChoice, type WeekdayMuscleDays, type WeekdayFocusPlanView, type WeekdayFocusPlans } from '@/lib/program/weekdayMuscleTypes'
import type { SavedWeekdayMuscleChoice, WeekdayMusclePreferencesView } from '@/lib/program/weekdayMusclePreferences'
import styles from './WeekdayMusclePreferencesForm.module.css'

export type WeekdayPreferenceSourceStatus = {
  status: 'available' | 'unavailable' | 'unsupported'; message?: string; issues?: string[]
  retainedEntries?: Array<{ day: string; exercise: string; reason: string; requiresOwnerDecision: boolean }>
}
export type WeekdayMusclePreferencesFormProps = {
  clientId: string
  userId: string
  initialView: WeekdayMusclePreferencesView
  initialFocusPlans?: WeekdayFocusPlans
  sourceStatus: WeekdayPreferenceSourceStatus
}

const emptyDays = (): WeekdayMuscleDays => ({ Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [], Sunday: [] })
const copyChoice = (choice: WeekdayMuscleChoice): WeekdayMuscleChoice => choice.mode === 'program_default' ? { mode: 'program_default' }
  : { mode: 'custom', days: Object.fromEntries(WEEKDAYS.map(day => [day, [...choice.days[day]]])) as WeekdayMuscleDays }
const initialChoice = (view: WeekdayMusclePreferencesView) => copyChoice(view.pending?.choice ?? view.current?.choice ?? { mode: 'program_default' })
const validDate = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
const dateLabel = (date: string) => `${new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))} (${date})`
const groupLabel = (id: string) => MUSCLE_GROUP_OPTIONS.find(option => option.id === id)?.label ?? id
const unavailablePlan = (): WeekdayFocusPlanView => ({ status: 'unavailable', message: 'The prescribed workday summary is unavailable. Your saved preferences are unchanged.' })
const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))
const stringList = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === 'string' && item.trim().length > 0)
const weekdayList = (value: unknown): value is string[] => stringList(value) && value.length <= 7 && value.every(day => WEEKDAYS.some(weekday => weekday === day))

// A missing summary must not turn a confirmed preference save into a failure,
// or supply a guessed set of workdays. All distribution decisions stay on the server.
function readFocusPlan(value: unknown, entry: SavedWeekdayMuscleChoice | null): WeekdayFocusPlanView {
  if (!object(value) || !['available', 'unsupported', 'unavailable'].includes(String(value.status))) return unavailablePlan()
  if (value.status !== 'available') return { status: value.status as 'unsupported' | 'unavailable',
    message: typeof value.message === 'string' ? value.message : undefined, issues: stringList(value.issues) ? value.issues : undefined }
  if (value.mode !== (entry?.choice.mode ?? 'program_default') || value.effectiveDate !== entry?.effectiveDate
    || !Array.isArray(value.preferredDays) || !value.preferredDays.every(item => object(item) && WEEKDAYS.some(day => day === item.day) && stringList(item.groups))
    || !weekdayList(value.workDays) || !weekdayList(value.unspecifiedDays)
    || !Array.isArray(value.fixedExtraDays) || !value.fixedExtraDays.every(item => object(item) && WEEKDAYS.some(day => day === item.day) && stringList(item.exercises))) return unavailablePlan()
  return value as WeekdayFocusPlanView
}

function readFocusPlans(value: unknown, view: WeekdayMusclePreferencesView): WeekdayFocusPlans {
  const data = object(value) ? value : {}
  return { current: readFocusPlan(data.current, view.current), pending: view.pending ? readFocusPlan(data.pending, view.pending) : null }
}

function FocusPlanSummary({ plan }: { plan: WeekdayFocusPlanView }) {
  if (plan.status !== 'available') return <div className={styles.focusPlan} role="status">
    <p>{plan.message ?? 'The prescribed workday summary is unavailable. Your saved preferences are unchanged.'}</p>
    {!!plan.issues?.length && <ul>{plan.issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul>}
  </div>
  return <div className={styles.focusPlan}>
    {plan.mode === 'program_default' && <p>Original program arrangement.</p>}
    {plan.mode === 'custom' && !!plan.preferredDays?.length && <><h4>Preferred focus days</h4><ul>
      {plan.preferredDays.map(item => <li key={item.day}><strong>{item.day}:</strong> {item.groups.join(', ')}</li>)}
    </ul></>}
    <p><strong>Prescribed workdays:</strong> {plan.workDays?.length ? plan.workDays.join(', ') : 'No workdays are listed in this saved source.'}</p>
    {!!plan.fixedExtraDays?.length && <><h4>Additional prescribed workdays</h4><ul>
      {plan.fixedExtraDays.map(item => <li key={item.day}><strong>{item.day}:</strong> {item.exercises.join(', ')}</li>)}
    </ul><p>These keep prescribed work beyond your preferred focus days. Your selection is not an exclusive workday schedule.</p></>}
    {!!plan.unspecifiedDays?.length && <p><strong>Unspecified in saved source:</strong> {plan.unspecifiedDays.join(', ')}. No activity is inferred for these days.</p>}
  </div>
}

function ChoiceSummary({ entry }: { entry: SavedWeekdayMuscleChoice }) {
  return <>
    {entry.choice.mode === 'program_default' ? <p>Program default, explicitly saved.</p> : <><p>Preferred focus areas</p><dl className={styles.summaryDays}>
      {WEEKDAYS.filter(day => entry.choice.mode === 'custom' && entry.choice.days[day].length > 0).map(day => <div key={day}>
        <dt>{day}</dt><dd>{entry.choice.mode === 'custom' ? entry.choice.days[day].map(groupLabel).join(', ') : ''}</dd>
      </div>)}
    </dl></>}
    <p>Effective <time dateTime={entry.effectiveDate}>{dateLabel(entry.effectiveDate)}</time>.</p>
  </>
}

type SaveAttempt = { operationId: string; choice: WeekdayMuscleChoice; expectedRevision: number; expectedDate: string }

export default function WeekdayMusclePreferencesForm({ clientId, userId, initialView, initialFocusPlans, sourceStatus }: WeekdayMusclePreferencesFormProps) {
  const router = useRouter(), id = useId()
  const [view, setView] = useState(initialView)
  const [focusPlans, setFocusPlans] = useState(() => readFocusPlans(initialFocusPlans, initialView))
  const [choice, setChoice] = useState<WeekdayMuscleChoice>(() => initialChoice(initialView))
  const [saving, setSaving] = useState(false)
  const [retryPending, setRetryPending] = useState(false)
  const [reloadRequired, setReloadRequired] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [issues, setIssues] = useState<string[]>([])
  const [accountReady, setAccountReady] = useState(false)
  const [accountChanged, setAccountChanged] = useState(false)
  const [accountError, setAccountError] = useState(false)
  const [authRetry, setAuthRetry] = useState(0)
  const mounted = useRef(false), generation = useRef(0), lock = useRef(false)
  const accountVerified = useRef(false)
  const request = useRef<AbortController | null>(null), attempt = useRef<SaveAttempt | null>(null)
  const identity = JSON.stringify([clientId, userId, initialView.today])
  const currentIdentity = useRef(identity)
  currentIdentity.current = identity

  useEffect(() => {
    // Capture the stable ref object; cleanup deliberately invalidates any late request.
    const lifecycleGeneration = generation
    mounted.current = true
    lifecycleGeneration.current++
    request.current?.abort(); request.current = null; attempt.current = null; lock.current = false
    setView(initialView); setFocusPlans(readFocusPlans(initialFocusPlans, initialView)); setChoice(initialChoice(initialView)); setSaving(false); setRetryPending(false); setReloadRequired(false)
    setMessage(''); setError(''); setIssues([])
    return () => { mounted.current = false; lifecycleGeneration.current++; request.current?.abort(); lock.current = false }
  }, [clientId, userId, initialView, initialFocusPlans])

  useEffect(() => {
    let active = true, authRevision = 0, verified = false
    accountVerified.current = false; setAccountReady(false); setAccountChanged(false); setAccountError(false)
    const invalidate = () => {
      accountVerified.current = false; generation.current++; request.current?.abort(); request.current = null
      attempt.current = null; lock.current = false; setSaving(false); setRetryPending(false)
      setAccountReady(false); setAccountChanged(true); setMessage(''); setError(''); setIssues([])
    }
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return
      if (session?.user.id !== userId) { authRevision++; verified = false; invalidate() }
      else if (verified) { accountVerified.current = true; setAccountReady(true); setAccountError(false) }
    })
    const checkingRevision = authRevision
    void supabase.auth.getUser().then(({ data, error: authError }) => {
      if (!active || authRevision !== checkingRevision) return
      if (authError) { setAccountError(true); return }
      if (data.user?.id !== userId) invalidate()
      else { verified = true; accountVerified.current = true; setAccountReady(true) }
    }).catch(() => { if (active && authRevision === checkingRevision) setAccountError(true) })
    return () => { active = false; accountVerified.current = false; subscription.unsubscribe() }
  }, [clientId, userId, authRetry])

  function edit(next: WeekdayMuscleChoice) {
    if (!accountVerified.current || currentIdentity.current !== identity || lock.current || retryPending || reloadRequired || view.status === 'invalid') return
    generation.current++
    request.current?.abort(); request.current = null; attempt.current = null
    setChoice(next); setMessage(''); setError(''); setIssues([])
  }

  const incomplete = choice.mode === 'custom' && !WEEKDAYS.some(day => choice.days[day].length > 0)
  const unsupportedCustom = choice.mode === 'custom' && sourceStatus.status !== 'available'
  const editorDisabled = !accountReady || saving || retryPending || reloadRequired || view.status === 'invalid'

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!accountVerified.current || lock.current || reloadRequired || view.status === 'invalid' || incomplete || unsupportedCustom || currentIdentity.current !== identity || view.revision === null) return
    lock.current = true
    const selected = copyChoice(choice)
    if (!attempt.current) {
      if (typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function') {
        lock.current = false; setError('This browser could not create a save request. Reload or use a supported browser.'); return
      }
      attempt.current = { operationId: crypto.randomUUID(), choice: selected, expectedRevision: view.revision, expectedDate: view.today }
    }
    const activeAttempt = attempt.current, activeGeneration = ++generation.current
    const controller = new AbortController(); request.current = controller
    const isCurrent = () => mounted.current && accountVerified.current && currentIdentity.current === identity && generation.current === activeGeneration && !controller.signal.aborted
    setSaving(true); setMessage(''); setError(''); setIssues([])
    try {
      const response = await fetch('/api/workout/weekday-preferences', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedClientId: clientId, expectedUserId: userId, expectedDate: activeAttempt.expectedDate,
          expectedRevision: activeAttempt.expectedRevision, operationId: activeAttempt.operationId, choice: activeAttempt.choice }),
      })
      const result = await response.json()
      if (!isCurrent()) return
      if (!response.ok) {
        const failure = typeof result?.error === 'string' ? result.error : 'Your preferences could not be saved.'
        setError(failure)
        setIssues(Array.isArray(result?.issues) ? result.issues.filter((item: unknown): item is string => typeof item === 'string') : [])
        if (response.status >= 500) setRetryPending(true)
        else {
          attempt.current = null; setRetryPending(false)
          if ([401, 403, 409].includes(response.status)) setReloadRequired(true)
        }
        return
      }
      const savedView = result?.view as WeekdayMusclePreferencesView | undefined
      const savedEntry = savedView?.pending?.operationId === activeAttempt.operationId ? savedView.pending
        : savedView?.current?.operationId === activeAttempt.operationId ? savedView.current : null
      if (result?.success !== true || !savedView || !['saved', 'pending'].includes(savedView.status)
        || savedView.revision !== activeAttempt.expectedRevision + 1 || !validDate(savedView.today) || !validDate(savedView.nextEffectiveDate)
        || savedView.today !== activeAttempt.expectedDate && result.replayed !== true
        || savedView.lastOperationId !== activeAttempt.operationId || savedView.timezone !== view.timezone || !savedEntry || !validDate(savedEntry.effectiveDate)
        || JSON.stringify(savedEntry.choice) !== JSON.stringify(activeAttempt.choice)) {
        throw new Error('Your save could not be confirmed. Retry the same save or reload your saved preferences.')
      }
      setView(savedView); setFocusPlans(readFocusPlans(result.focusPlans, savedView)); setChoice(initialChoice(savedView)); setRetryPending(false); attempt.current = null
      setMessage(savedView.pending?.operationId === activeAttempt.operationId
        ? `Saved. ${savedEntry.choice.mode === 'program_default' ? 'Program default resumes' : 'Your weekday preferences start'} ${dateLabel(savedEntry.effectiveDate)}. Your current week is unchanged.`
        : `Saved request confirmed. These preferences took effect ${dateLabel(savedEntry.effectiveDate)}.`)
    } catch (failure) {
      if (!isCurrent()) return
      setRetryPending(true)
      setError(failure instanceof Error ? failure.message : 'Your save could not be confirmed. Retry the same save or reload your saved preferences.')
    } finally {
      if (isCurrent()) { lock.current = false; request.current = null; setSaving(false) }
    }
  }

  if (accountChanged) return <section className={styles.preferences} aria-labelledby={`${id}-title`}>
    <h2 id={`${id}-title`}>Weekday muscle preferences</h2>
    <p role="status">Your account changed. Reload to view the current account’s saved preferences.</p>
    <div className={styles.actions}><button type="button" className={styles.secondary} onClick={() => router.refresh()}>Reload saved preferences</button></div>
  </section>

  return <section className={styles.preferences} aria-labelledby={`${id}-title`}>
    <header><h2 id={`${id}-title`}>Weekday muscle preferences</h2>
      <p>Choose preferred focus areas for clearly identified exercises in your existing prescribed plan. Mixed, unclear, and unselected work stays on its existing day. Your prescribed work is not increased to fill a day.</p></header>
    <div className={styles.savedChoices}>
      <section className={styles.panel} aria-labelledby={`${id}-current`}><h3 id={`${id}-current`}>Current preferences</h3>
        {view.status === 'invalid' ? <p>Your saved preferences could not be read. Reload before making changes.</p>
          : view.current ? <ChoiceSummary entry={view.current} /> : <p>Program default. No custom weekday preference is currently in effect.</p>}
        {view.status === 'unset' && <p>No weekday preference has been saved.</p>}
        {view.status !== 'invalid' && <FocusPlanSummary plan={focusPlans.current} />}
      </section>
      <section className={styles.panel} aria-labelledby={`${id}-pending`}><h3 id={`${id}-pending`}>Upcoming preferences</h3>
        {view.status === 'invalid' ? <p>Upcoming preferences are unavailable.</p>
          : view.pending ? <ChoiceSummary entry={view.pending} /> : <p>No upcoming change is saved.</p>}
        {view.status !== 'invalid' && view.pending && <FocusPlanSummary plan={focusPlans.pending ?? unavailablePlan()} />}
      </section>
    </div>
    {sourceStatus.status !== 'available' && <div className={styles.notice} role="status">
      <p>{sourceStatus.message ?? 'Your prescribed plan is not available for a custom weekday distribution right now.'}</p>
      {!!sourceStatus.issues?.length && <ul>{sourceStatus.issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul>}
      <p>You can still schedule a return to program default. Your saved preferences are shown above.</p>
    </div>}
    {!!sourceStatus.retainedEntries?.length && <section className={styles.notice} aria-labelledby={`${id}-retained`}>
      <h3 id={`${id}-retained`}>Prescribed items staying in place</h3>
      <p>These entries are kept unchanged on their existing weekday, with their existing dose. Mixed or unclear work does not need to be defined to keep it in place.</p>
      <ul>{sourceStatus.retainedEntries.map((entry, index) => <li key={`${entry.day}:${entry.exercise}:${index}`}><strong>{entry.day}: {entry.exercise}.</strong> {entry.reason}</li>)}</ul>
    </section>}
    {!accountReady && <p role="status">{accountError ? 'Your account could not be verified. No preferences can be saved.' : 'Checking your account before enabling changes…'}</p>}
    {accountError && <div className={styles.actions}><button type="button" className={styles.secondary} onClick={() => setAuthRetry(value => value + 1)}>Retry account check</button></div>}
    <form className={styles.form} onSubmit={save} aria-busy={saving} aria-describedby={`${id}-timing`}>
      <fieldset className={styles.mode} disabled={editorDisabled}><legend>Choose your upcoming preference</legend>
        <label><input type="radio" name={`${id}-mode`} value="program_default" checked={choice.mode === 'program_default'} onChange={() => edit({ mode: 'program_default' })} />Program default</label>
        <p>Explicitly save a return to your program’s usual arrangement, starting next week.</p>
        <label><input type="radio" name={`${id}-mode`} value="custom" checked={choice.mode === 'custom'} onChange={() => edit({ mode: 'custom', days: emptyDays() })} />Preferred weekday focus</label>
        <p>These are preferred focus areas, not an exclusive list of workdays. Unchecked days and muscle groups can still contain prescribed work.</p>
      </fieldset>
      {choice.mode === 'custom' && <div className={styles.days}>
        {WEEKDAYS.map(day => <fieldset className={styles.day} key={day} disabled={editorDisabled}><legend>{day}</legend>
          <div className={styles.groups}>{MUSCLE_GROUP_OPTIONS.map(option => <label key={option.id}>
            <input type="checkbox" aria-label={`${day}: ${option.label}`} checked={choice.days[day].includes(option.id)} onChange={event => {
              const groups = new Set(choice.days[day]); if (event.target.checked) groups.add(option.id); else groups.delete(option.id)
              edit({ mode: 'custom', days: { ...choice.days, [day]: MUSCLE_GROUP_OPTIONS.filter(item => groups.has(item.id)).map(item => item.id) } })
            }} />{option.label}
          </label>)}</div>
        </fieldset>)}
      </div>}
      <p id={`${id}-timing`} className={styles.notice}>Changes saved today start <time dateTime={view.nextEffectiveDate}>{dateLabel(view.nextEffectiveDate)}</time>. Your current week will not be rewritten. Timing uses your saved timezone: {view.timezone}.</p>
      {incomplete && <p role="status">Choose at least one preferred focus area before saving. This selection has not been saved.</p>}
      {unsupportedCustom && <p role="status">This custom selection cannot be saved until the prescribed plan supports it. No exercise or dose will be invented.</p>}
      <div className={styles.actions}>
        <button type="submit" className={styles.primary} disabled={!accountReady || saving || reloadRequired || view.status === 'invalid' || incomplete || unsupportedCustom}>
          {saving ? 'Saving…' : retryPending ? 'Retry same save' : choice.mode === 'program_default' ? 'Save program default for next week' : 'Save weekday preferences for next week'}
        </button>
        <button type="button" className={styles.secondary} disabled={saving} onClick={() => { setMessage('Reloading saved preferences…'); router.refresh() }}>Reload saved preferences</button>
      </div>
      {retryPending && <p className={styles.notice} role="status">The save is not yet confirmed. Retry sends the same request, so it will not duplicate a successful save. Reload before choosing something different.</p>}
      {reloadRequired && <p className={styles.notice} role="status">Reload your saved preferences before trying again. Your selection has not been applied by this response.</p>}
      {error && <div className={styles.error} role="alert"><p>{error}</p>{issues.length > 0 && <ul>{issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul>}</div>}
      <p role="status" aria-live="polite">{message}</p>
    </form>
  </section>
}
