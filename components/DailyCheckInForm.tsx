'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import SymptomLogger from '@/components/SymptomLogger'
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

type Values = { sleepHours:number; sleepQuality:number; stress:number; soreness:number; energy:number; mood:number; hunger:number; notes:string; periodStarted:boolean; sorenessRegions:SorenessRegionKey[] }
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

export default function DailyCheckInForm({ clientId, program, initial, cycleTrackingEnabled, stayOnSave = false, completed = false, localDate, timeZone }: { clientId:string; program:string; initial:Partial<Values>; cycleTrackingEnabled:boolean; stayOnSave?: boolean; completed?: boolean; localDate?: string; timeZone?: string }) {
  const router = useRouter()
  const initialSoreness = initial.soreness ?? 5
  const initialSorenessRegions = initialSoreness > 5
    ? (initial.sorenessRegions || []).filter(isSorenessRegionKey)
    : []
  const [values,setValues] = useState<Values>({sleepHours:initial.sleepHours ?? 7,sleepQuality:initial.sleepQuality ?? 5,stress:initial.stress ?? 5,soreness:initialSoreness,energy:initial.energy ?? 5,mood:initial.mood ?? 5,hunger:initial.hunger ?? 5,notes:initial.notes ?? '',periodStarted:false,sorenessRegions:initialSorenessRegions})
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
    setValues({ sleepHours: baseline.sleepHours ?? 7, sleepQuality: baseline.sleepQuality ?? 5, stress: baseline.stress ?? 5, soreness, energy: baseline.energy ?? 5, mood: baseline.mood ?? 5, hunger: baseline.hunger ?? 5, notes: baseline.notes ?? '', periodStarted: false, sorenessRegions: soreness > 5 ? (baseline.sorenessRegions || []).filter(isSorenessRegionKey) : [] })
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
          if (Object.keys(answers).length || (cycleTrackingEnabled && draft.periodStarted === true)) {
            setValues(current => ({ ...current, ...answers, periodStarted: cycleTrackingEnabled && draft.periodStarted === true, sorenessRegions: (answers.soreness ?? soreness) > 5 ? regions : [] }))
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
  }, [draftKey, initialKey, cycleTrackingEnabled, tier, completed, clientId, localDate])

  useEffect(() => {
    if (!draftKey || restoredKey !== draftKey || !edited.current || saving) return
    try {
      window.sessionStorage.setItem(draftKey, JSON.stringify({ version: 1, initialKey, answers: Object.fromEntries(Object.entries(values).filter(([key]) => answered.has(key))), periodStarted: values.periodStarted, sorenessRegions: values.sorenessRegions }))
    } catch {
      // Saving the submitted check-in still works when browser storage is unavailable.
    }
  }, [draftKey, restoredKey, initialKey, values, answered, saving])

  const markEdited = () => {
    edited.current = true
    setChanged(true)
    setMessage('')
    if (!started.current) {
      started.current = true
      trackEvent('daily_check_in_started', { program: tier, source: stayOnSave ? 'recovery' : 'daily_check_in' })
    }
  }
  const [sorenessDialogOpen,setSorenessDialogOpen] = useState(false)
  const [symptomsOpen,setSymptomsOpen] = useState(false)
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
    if (lock.current) return
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
      const response = await fetch('/api/daily-check-in',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientId,date:localDate,...Object.fromEntries(Object.entries(values).filter(([key]) => answered.has(key))), sorenessRegions: values.sorenessRegions, periodStarted: values.periodStarted})})
      const payload = await response.json()
      if(!response.ok){setMessage(payload.error||'Check-in could not be saved.');return}
      edited.current = false
      setChanged(false)
      setSaved(true)
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
    <AOSCard as="form" className="aos-check-in-form" onSubmit={save}>
      <fieldset className="guided-check-in-fields" disabled={saving}>
      <AOSSectionHeader eyebrow="Daily check-in" title="How’s your energy today?" copy="One answer is enough to check in. Add more context when it helps." />
      <div className="guided-check-in-energy">{slider('energy','Energy')}<p><span>Running on empty</span><span>Feeling strong</span></p>{!answered.has('energy') ? <AOSButton type="button" variant="secondary" onClick={() => updateSlider('energy', values.energy)}>Use this energy level</AOSButton> : null}</div>
      {saved && !changed ? <p className="aos-status" role="status">Your check-in is already saved. You can update any answer below.</p> : null}
      <details className="guided-check-in-details">
      <summary>Add more context (optional)<span>Sleep, stress, soreness, and more</span></summary>
      <p className="guided-check-in-copy">Untouched markers stay unanswered. Your existing inputs and detailed body signals remain available here.</p>
      <div className="aos-slider-grid">{slider('sleepHours','Sleep duration')}{slider('sleepQuality','Sleep quality')}{slider('stress','Stress')}{slider('soreness','Soreness')}{slider('mood','Mood')}{slider('hunger','Hunger')}</div>
      {values.soreness > 5 && values.sorenessRegions.length ? <div className="aos-chip-list" aria-label="Selected soreness regions">{values.sorenessRegions.map((region) => {
        const label = SORENESS_REGIONS.find((item) => item.key === region)?.label || region
        return <button type="button" key={region} className="aos-chip is-selected" aria-pressed="true" onClick={() => toggleSorenessRegion(region)}>{label}</button>
      })}</div> : null}
      {cycleTrackingEnabled ? <div className="aos-period-panel"><span className="aos-period-panel__icon" aria-hidden="true">◒</span><AOSToggle label="My period started today" description="This records today as the start of your period." checked={values.periodStarted} onChange={(periodStarted)=>{markEdited();setValues((current)=>({...current,periodStarted}))}}/></div> : null}
      <AOSInput multiline label="Optional notes" placeholder="Anything else your body is telling you?" rows={3} value={values.notes} onChange={(event)=>{markEdited();setAnswered(current => new Set(current).add('notes')); setValues((current)=>({...current,notes:event.target.value})) }}/>
      </details>
      <AOSButton type="submit" disabled={saving || (saved && !changed)}>{saving?'Saving…':saved?'Save changes':'Save Daily Check-In'}</AOSButton>
      {message?<p className="aos-status" role="status">{message}</p>:null}<Link href={`/dashboard/program/${tier}`} className="tier-secondary-action">{saved && !changed ? 'Done — what’s next?' : 'Return to Today'}</Link>
      </fieldset>
    </AOSCard>
    <details className="aos-symptom-column guided-check-in-details guided-check-in-symptoms" onToggle={(event) => setSymptomsOpen(event.currentTarget.open)}><summary>Log symptoms (optional)<span>Open your detailed body map</span></summary>{symptomsOpen ? <><AOSSectionHeader eyebrow="Symptoms" title="Add any body signal." copy="Tap the area where you feel something. Symptoms are saved separately."/><SymptomLogger clientId={clientId}/></> : null}</details>
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
