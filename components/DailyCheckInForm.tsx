'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import SymptomLogger from '@/components/SymptomLogger'
import CycleFlowLogger from '@/components/CycleFlowLogger'
import type { PeriodState } from '@/lib/cycle/periodState'
import { AOSButton } from '@/components/aos-ui/AOSButton'
import { AOSCard } from '@/components/aos-ui/AOSCard'
import { AOSInput } from '@/components/aos-ui/AOSInput'
import { AOSModal } from '@/components/aos-ui/AOSModal'
import { AOSSectionHeader } from '@/components/aos-ui/AOSSectionHeader'
import { AOSSlider } from '@/components/aos-ui/AOSSlider'
import { AOSToggle } from '@/components/aos-ui/AOSToggle'
import { trackEvent } from '@/lib/analytics'
import { normalizeProgramTier } from '@/lib/entitlements'
import { localDateKey } from '@/lib/timezone'
import './guided-check-in.css'
import {
  isSorenessRegionKey,
  SORENESS_REGIONS,
  type SorenessRegionKey,
} from '@/lib/recovery/sorenessRegions'

type Values = { sleepHours:number; sleepQuality:number; stress:number; soreness:number; energy:number; mood:number; hunger:number; notes:string; periodStarted:boolean; periodAction:'end'|'resume'|null; sorenessRegions:SorenessRegionKey[] }
type SliderKey = 'sleepHours' | 'sleepQuality' | 'stress' | 'soreness' | 'energy' | 'mood' | 'hunger'
const sliderKeys: SliderKey[] = ['sleepHours', 'sleepQuality', 'stress', 'soreness', 'energy', 'mood', 'hunger']
const draftPrefix = 'anastasis:check-in-draft:v1:'

function restoredAnswers(raw: unknown): Partial<Values> {
  if (!raw || typeof raw !== 'object') return {}
  const source = raw as Record<string, unknown>
  const answers: Partial<Values> = {}
  for (const key of sliderKeys) {
    const value = source[key]
    if (typeof value === 'number' && Number.isFinite(value) && value >= (key === 'sleepHours' ? 0 : 1) && value <= (key === 'sleepHours' ? 12 : 10)) answers[key] = value
  }
  if (typeof source.notes === 'string') answers.notes = source.notes
  return answers
}

export default function DailyCheckInForm({ clientId, program, initial, cycleTrackingEnabled, recentPeriodStart = false, periodState = { status: 'unknown', recordedDate: null }, stayOnSave = false, completed = false, localDate, timeZone }: { clientId:string; program:string; initial:Partial<Values>; cycleTrackingEnabled:boolean; recentPeriodStart?: boolean; periodState?: PeriodState; stayOnSave?: boolean; completed?: boolean; localDate?: string; timeZone?: string }) {
  const router = useRouter()
  const initialSoreness = initial.soreness ?? 5
  const initialSorenessRegions = initialSoreness > 5
    ? (initial.sorenessRegions || []).filter(isSorenessRegionKey)
    : []
  const [values,setValues] = useState<Values>({sleepHours:initial.sleepHours ?? 7,sleepQuality:initial.sleepQuality ?? 5,stress:initial.stress ?? 5,soreness:initialSoreness,energy:initial.energy ?? 5,mood:initial.mood ?? 5,hunger:initial.hunger ?? 5,notes:initial.notes ?? '',periodStarted:false,periodAction:null,sorenessRegions:initialSorenessRegions})
  const lock = useRef(false)
  const [answered, setAnswered] = useState<Set<string>>(() => new Set(Object.keys(initial).filter(key => initial[key as keyof Values] !== undefined && initial[key as keyof Values] !== null)))
  const [saving,setSaving] = useState(false)
  const [message,setMessage] = useState('')
  const [saved,setSaved] = useState(completed)
  const [changed,setChanged] = useState(false)
  const edited = useRef(false)
  const started = useRef(false)
  const startedIdentity = useRef('')
  const completionTracked = useRef(completed)
  const previousDraftKey = useRef<string | null>(null)
  const [restoredKey,setRestoredKey] = useState<string | null>(null)
  const tier = normalizeProgramTier(program)
  const initialKey = JSON.stringify(initial)
  const periodStateKey = `${periodState.status}:${periodState.recordedDate || ''}`
  const [storedPeriodState,setStoredPeriodState] = useState(periodState)
  const previousPeriodStateKey = useRef(periodStateKey)
  useEffect(() => {
    setStoredPeriodState({ status: periodState.status, recordedDate: periodState.recordedDate, ...(periodState.loadError ? { loadError: true } : {}) })
  }, [periodState.status, periodState.recordedDate, periodState.loadError])
  useEffect(() => {
    if (previousPeriodStateKey.current !== periodStateKey || !cycleTrackingEnabled) {
      previousPeriodStateKey.current = periodStateKey
      setValues(current => ({ ...current, periodStarted: false, periodAction: null }))
    }
  }, [periodStateKey, cycleTrackingEnabled])
  // Unsaved answers stay in this tab only, scoped to the authenticated member's local day.
  const draftKey = clientId && localDate && /^\d{4}-\d{2}-\d{2}$/.test(localDate)
    ? `${draftPrefix}${encodeURIComponent(clientId)}:${tier}:${localDate}` : null

  useEffect(() => {
    const identity = `${clientId}:${tier}:${localDate || ''}`
    if (startedIdentity.current !== identity) {
      started.current = false
      startedIdentity.current = identity
      edited.current = false
      setMessage('')
    }
    if (previousDraftKey.current === draftKey && edited.current) return
    previousDraftKey.current = draftKey
    edited.current = false
    setChanged(false)
    const baseline = JSON.parse(initialKey) as Partial<Values>
    const soreness = baseline.soreness ?? 5
    setValues({ sleepHours: baseline.sleepHours ?? 7, sleepQuality: baseline.sleepQuality ?? 5, stress: baseline.stress ?? 5, soreness, energy: baseline.energy ?? 5, mood: baseline.mood ?? 5, hunger: baseline.hunger ?? 5, notes: baseline.notes ?? '', periodStarted: false, periodAction: null, sorenessRegions: soreness > 5 ? (baseline.sorenessRegions || []).filter(isSorenessRegionKey) : [] })
    setAnswered(new Set(Object.keys(baseline).filter(key => baseline[key as keyof Values] != null)))
    setSaved(completed)
    completionTracked.current = completed
    if (draftKey) {
      try {
        const stored = window.sessionStorage.getItem(draftKey)
        const draft = stored ? JSON.parse(stored) : null
        if (draft?.version === 1 && draft.initialKey === initialKey) {
          const answers = restoredAnswers(draft.answers)
          const regions = Array.isArray(draft.sorenessRegions) ? draft.sorenessRegions.filter(isSorenessRegionKey) : []
          const periodAction = cycleTrackingEnabled && ['end', 'resume'].includes(draft.periodAction) ? draft.periodAction as 'end'|'resume' : null
          const samePeriodState = draft.periodStateKey === periodStateKey || (draft.periodStateKey === undefined && periodState.status === 'unknown')
          if (Object.keys(answers).length || (cycleTrackingEnabled && (draft.periodStarted === true || periodAction))) {
            setValues(current => ({ ...current, ...answers, periodStarted: cycleTrackingEnabled && samePeriodState && draft.periodStarted === true, periodAction: samePeriodState ? periodAction : null, sorenessRegions: (answers.soreness ?? soreness) > 5 ? regions : [] }))
            setAnswered(current => new Set([...current, ...Object.keys(answers)]))
            edited.current = true
            started.current = true
            setChanged(true)
            setMessage('Your unfinished answers are ready to continue. Save when you’re ready.')
            trackEvent('activity_resumed', { activity: 'check_in', source: 'session_draft', program: tier })
          }
        } else if (stored) window.sessionStorage.removeItem(draftKey)
      } catch {
        // Restricted storage or an invalid draft never blocks a new check-in.
      }
    }
    setRestoredKey(draftKey)
  }, [draftKey, initialKey, cycleTrackingEnabled, tier, completed, clientId, localDate, periodStateKey, periodState.status])

  useEffect(() => {
    if (!draftKey || restoredKey !== draftKey || !edited.current || saving) return
    try {
      window.sessionStorage.setItem(draftKey, JSON.stringify({ version: 1, initialKey, answers: Object.fromEntries(Object.entries(values).filter(([key]) => answered.has(key))), periodStarted: values.periodStarted, periodAction: values.periodAction, periodStateKey, sorenessRegions: values.sorenessRegions }))
    } catch {
      // Saving the submitted check-in still works when browser storage is unavailable.
    }
  }, [draftKey, restoredKey, initialKey, values, answered, saving, periodStateKey])

  const markEdited = () => {
    edited.current = true
    setChanged(true)
    setMessage('')
    if (!started.current) {
      started.current = true
      trackEvent('daily_check_in_started', { program: tier, source: stayOnSave ? 'recovery' : 'daily_check_in' })
    }
  }
  const [flowOpen,setFlowOpen] = useState(false)
  const [flowSaving,setFlowSaving] = useState(false)
  const flowLock = useRef(false)
  const flowEntry = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!cycleTrackingEnabled || storedPeriodState.status !== 'active') setFlowOpen(false)
  }, [cycleTrackingEnabled, storedPeriodState.status])
  const closeFlow = useCallback(() => {
    if (flowLock.current) return
    setFlowOpen(false)
    flowEntry.current?.focus({ preventScroll: true })
  }, [])
  const flowSavingChanged = useCallback((pending: boolean) => { flowLock.current = pending; setFlowSaving(pending) }, [])
  const flowSaved = useCallback(() => {
    setMessage('Flow saved separately. Continue your Daily Check-In, then save it when you’re ready.')
  }, [])
  const selectPeriodAction = (action: 'start'|'end'|'resume', selected: boolean) => {
    markEdited()
    setValues(current => ({ ...current, periodStarted: action === 'start' && selected, periodAction: selected && action !== 'start' ? action : null }))
  }
  const [sorenessDialogOpen,setSorenessDialogOpen] = useState(false)
  const [symptomsOpen,setSymptomsOpen] = useState(false)
  const [symptomConfirmation,setSymptomConfirmation] = useState('')
  const symptomEntry = useRef<HTMLButtonElement>(null)
  const checkInResume = useRef<HTMLDivElement>(null)
  const symptomSaved = useRef(false)
  const closeSymptoms = useCallback(() => setSymptomsOpen(false), [])
  const afterSymptomsClose = useCallback(() => {
    if (symptomSaved.current) {
      symptomSaved.current = false
      checkInResume.current?.focus({ preventScroll: true })
      checkInResume.current?.scrollIntoView({ block: 'start' })
    } else symptomEntry.current?.focus({ preventScroll: true })
  }, [])
  const onSymptomSaved = useCallback(() => {
    symptomSaved.current = true
    setSymptomConfirmation('Symptom saved. Continue your Daily Check-In below, then save it when you’re ready.')
    setSymptomsOpen(false)
  }, [])
  const closeSorenessDialog = useCallback(() => setSorenessDialogOpen(false), [])
  const updateSlider = (key: SliderKey, value: number) => {
    markEdited()
    setAnswered(current => new Set(current).add(key))
    setValues((current) => {
      if (key !== 'soreness') return { ...current, [key]: value }
      if (value <= 5) {
        setSorenessDialogOpen(false)
        return { ...current, soreness: value, sorenessRegions: [] }
      }
      if (current.soreness <= 5) setSorenessDialogOpen(true)
      return { ...current, soreness: value }
    })
  }
  const toggleSorenessRegion = (region: SorenessRegionKey) => {
    markEdited()
    setValues((current) => ({
      ...current,
      sorenessRegions: current.sorenessRegions.includes(region)
        ? current.sorenessRegions.filter((selected) => selected !== region)
        : [...current.sorenessRegions, region],
    }))
    setMessage('')
  }
  const slider = (key:SliderKey,label:string) => <AOSSlider key={key} label={`${label}${key === 'energy' ? '' : ' (optional)'}${answered.has(key) ? '' : ' — not answered'}`} value={Number(values[key])} min={key==='sleepHours'?0:1} max={key==='sleepHours'?12:10} step={key==='sleepHours'?0.5:1} suffix={key==='sleepHours'?' hours':'/10'} onChange={(value)=>updateSlider(key,value)}/>

  async function save(event:React.FormEvent) {
    event.preventDefault(); setMessage('')
    if (lock.current || flowLock.current || (saved && !changed)) return
    if (localDate && timeZone && localDateKey(new Date(), timeZone) !== localDate) {
      setMessage('A new day has started. Open Today to begin a fresh check-in.')
      return
    }
    if (!answered.has('energy')) { setMessage('Choose your energy level first. The other questions are optional.'); return }
    if (answered.has('soreness') && values.soreness > 5 && values.sorenessRegions.length === 0) {
      setMessage('Select where you are experiencing soreness.')
      setSorenessDialogOpen(true)
      return
    }
    lock.current = true
    setSaving(true)
    try {
      const response = await fetch('/api/daily-check-in',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientId,date:localDate,...Object.fromEntries(Object.entries(values).filter(([key]) => answered.has(key))), sorenessRegions: values.sorenessRegions, periodStarted: cycleTrackingEnabled && values.periodStarted, ...(cycleTrackingEnabled && values.periodAction ? { periodAction: values.periodAction } : {})})})
      const payload = await response.json()
      if(!response.ok){
        if (payload.partialSave && payload.periodState) {
          setStoredPeriodState(payload.periodState)
          if (!payload.retryPeriodAction) setValues(current => ({ ...current, periodStarted: false, periodAction: null }))
        }
        setMessage(payload.error||'Check-in could not be saved.');return
      }
      edited.current = false
      setChanged(false)
      setSaved(true)
      if (payload.periodState) setStoredPeriodState(payload.periodState)
      setValues(current => ({ ...current, periodStarted: false, periodAction: null }))
      setSymptomConfirmation('')
      if (draftKey) { try { window.sessionStorage.removeItem(draftKey) } catch { /* Submitted answers are already saved. */ } }
      if (!completionTracked.current) {
        completionTracked.current = true
        trackEvent('daily_check_in_completed', { program: tier, source: stayOnSave ? 'recovery' : 'daily_check_in' })
      }
      setMessage('Your check-in is saved. Review your next step on Today.')
      if (!stayOnSave) router.push(`/dashboard/program/${tier}`)
      router.refresh()
    } catch {
      setMessage('Check-in could not be saved. Check your connection and try again.')
    } finally {
      lock.current = false
      setSaving(false)
    }
  }

  return <div className="daily-check-in-layout">
    <div ref={checkInResume} tabIndex={-1} aria-label="Daily check-in" className="guided-check-in-resume">
    <AOSCard as="form" className="aos-check-in-form" onSubmit={save}>
      <fieldset className="guided-check-in-fields" disabled={saving || flowSaving}>
      <AOSSectionHeader eyebrow="Daily check-in" title="How’s your energy today?" copy="One answer is enough to check in. Add more context when it helps." />
      {symptomConfirmation ? <p className="aos-status" role="status">{symptomConfirmation}</p> : null}
      <div className="guided-check-in-energy">{slider('energy','Energy')}<p><span>Running on empty</span><span>Feeling strong</span></p>{!answered.has('energy') ? <AOSButton type="button" variant="secondary" onClick={() => updateSlider('energy', values.energy)}>Use this energy level</AOSButton> : null}</div>
      {saved && !changed ? <p className="aos-status" role="status">Your check-in is already saved. You can update any answer below.</p> : null}
      <section className="guided-check-in-symptom-entry" aria-label="Symptoms and period">
        <button ref={symptomEntry} type="button" className="aos-button aos-button--secondary" aria-haspopup="dialog" aria-expanded={symptomsOpen} onClick={() => setSymptomsOpen(true)}>Log symptoms (optional)</button>
        <p className="guided-check-in-copy">Choose a body area or period-related symptoms. Symptoms are saved separately.</p>
        {cycleTrackingEnabled ? <div className="guided-check-in-period">
          {storedPeriodState.loadError ? <p role="status">Your period status could not be loaded. Reopen this check-in before changing it.</p> : <>
            {storedPeriodState.status === 'unknown' ? <p className="guided-check-in-copy">Your current period status is unconfirmed. A previous start date does not tell us whether your period is still active.</p> : null}
            {storedPeriodState.status === 'active' ? <>
              <button ref={flowEntry} type="button" className="aos-button aos-button--secondary" aria-haspopup="dialog" aria-expanded={flowOpen} onClick={() => setFlowOpen(true)}>Track today’s flow</button>
              <p className="guided-check-in-copy">Flow entries save separately. You’ll return to these unfinished check-in answers.</p>
              <AOSToggle label="My period ended" description="Recorded when you save your final Daily Check-In. This keeps your cycle and flow history." checked={values.periodAction === 'end'} onChange={selected => selectPeriodAction('end', selected)}/>
            </> : <AOSToggle label="My period started today" description="Recorded when you save your final Daily Check-In. Logging symptoms does not record a period start." checked={values.periodStarted} onChange={selected => selectPeriodAction('start', selected)}/>}
            <details className="guided-check-in-details">
              <summary>Correct period status</summary>
              {storedPeriodState.status !== 'active' ? <AOSToggle label={storedPeriodState.status === 'ended' ? 'My period is still active' : 'My period is already active'} description="Confirms an active period without adding or changing a start date. Recorded with your final Daily Check-In." checked={values.periodAction === 'resume'} onChange={selected => selectPeriodAction('resume', selected)}/> : null}
              {storedPeriodState.status === 'unknown' ? <AOSToggle label="My period ended" description="Confirms it has ended without inventing an earlier start date. Recorded with your final Daily Check-In." checked={values.periodAction === 'end'} onChange={selected => selectPeriodAction('end', selected)}/> : null}
              <Link href="/dashboard/cycle" className="tier-secondary-action">Review or correct cycle dates</Link>
            </details>
          </>}
        </div> : null}
        {cycleTrackingEnabled && (values.periodStarted || values.periodAction === 'resume' || storedPeriodState.status === 'active' || recentPeriodStart) ? <p className="guided-check-in-copy">Period-related choices are available in the symptom popup and matching body areas.</p> : null}
      </section>
      <details className="guided-check-in-details" open>
      <summary>Add more context (optional)<span>Sleep, stress, soreness, and more</span></summary>
      <p className="guided-check-in-copy">Untouched markers stay unanswered. Your existing inputs and detailed body signals remain available here.</p>
      <div className="aos-slider-grid">{slider('stress','Stress')}{slider('soreness','Soreness')}{slider('sleepQuality','Sleep quality')}{slider('sleepHours','Hours slept')}{slider('mood','Mood')}{slider('hunger','Hunger')}</div>
      {values.soreness > 5 && values.sorenessRegions.length ? <div className="aos-chip-list" aria-label="Selected soreness regions">{values.sorenessRegions.map((region) => {
        const label = SORENESS_REGIONS.find((item) => item.key === region)?.label || region
        return <button type="button" key={region} className="aos-chip is-selected" aria-pressed="true" onClick={() => toggleSorenessRegion(region)}>{label}</button>
      })}</div> : null}
      <AOSInput multiline label="Optional notes" placeholder="Anything else your body is telling you?" rows={3} value={values.notes} onChange={(event)=>{markEdited();setAnswered(current => new Set(current).add('notes')); setValues((current)=>({...current,notes:event.target.value})) }}/>
      </details>
      <AOSButton type="submit" disabled={saving || (saved && !changed)}>{saving?'Saving…':saved?'Save changes':'Save Daily Check-In'}</AOSButton>
      {message?<p className="aos-status" role="status">{message}</p>:null}<Link href={`/dashboard/program/${tier}`} className="tier-secondary-action">{saved && !changed ? 'Done — what’s next?' : 'Return to Today'}</Link>
      </fieldset>
    </AOSCard>
    </div>
    <SymptomLogger clientId={clientId} open={symptomsOpen} onClose={closeSymptoms} onAfterClose={afterSymptomsClose} onSaved={onSymptomSaved} periodContext={cycleTrackingEnabled && (values.periodStarted || values.periodAction === 'resume' || storedPeriodState.status === 'active' || recentPeriodStart)}/>
    <AOSModal open={flowOpen && cycleTrackingEnabled && storedPeriodState.status === 'active'} title="Track today’s flow" onClose={closeFlow}>
      <CycleFlowLogger clientId={clientId} localDate={localDate} timeZone={timeZone} onSaved={flowSaved} onSavingChange={flowSavingChanged}/>
      <AOSButton type="button" variant="secondary" disabled={flowSaving} onClick={closeFlow}>Return to check-in</AOSButton>
    </AOSModal>
    <AOSModal open={sorenessDialogOpen} title="Soreness regions" onClose={closeSorenessDialog}>
      <AOSSectionHeader eyebrow="Soreness" title="Where are you sore?" copy="Select the areas where you feel soreness." />
      <div className="aos-chip-list" role="group" aria-label="Soreness regions">
        {SORENESS_REGIONS.map((region) => {
          const selected = values.sorenessRegions.includes(region.key)
          return <button type="button" key={region.key} className={`aos-chip${selected?' is-selected':''}`} aria-pressed={selected} onClick={() => toggleSorenessRegion(region.key)}>{region.label}</button>
        })}
      </div>
      {message === 'Select where you are experiencing soreness.' ? <p className="aos-status" role="alert">{message}</p> : null}
      <div className="aos-button-row">
        <AOSButton type="button" onClick={closeSorenessDialog}>Done</AOSButton>
        <AOSButton type="button" variant="ghost" onClick={() => {markEdited();setValues((current) => ({ ...current, sorenessRegions: [] }))}}>Clear regions</AOSButton>
      </div>
    </AOSModal>
  </div>
}
