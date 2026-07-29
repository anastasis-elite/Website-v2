'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import SymptomLogger from '@/components/SymptomLogger'
import { AOSButton } from '@/components/aos-ui/AOSButton'
import { AOSCard } from '@/components/aos-ui/AOSCard'
import { AOSInput } from '@/components/aos-ui/AOSInput'
import { AOSModal } from '@/components/aos-ui/AOSModal'
import { AOSSectionHeader } from '@/components/aos-ui/AOSSectionHeader'
import { AOSSlider } from '@/components/aos-ui/AOSSlider'
import { AOSToggle } from '@/components/aos-ui/AOSToggle'
import {
  isSorenessRegionKey,
  SORENESS_REGIONS,
  type SorenessRegionKey,
} from '@/lib/recovery/sorenessRegions'

type Values = { sleepHours:number; sleepQuality:number; stress:number; soreness:number; energy:number; mood:number; hunger:number; notes:string; periodStarted:boolean; sorenessRegions:SorenessRegionKey[] }
type SliderKey = 'sleepHours' | 'sleepQuality' | 'stress' | 'soreness' | 'energy' | 'mood' | 'hunger'

export default function DailyCheckInForm({ clientId, program, initial, cycleTrackingEnabled }: { clientId:string; program:string; initial:Partial<Values>; cycleTrackingEnabled:boolean }) {
  const router = useRouter()
  const initialSoreness = initial.soreness ?? 5
  const initialSorenessRegions = initialSoreness > 5
    ? (initial.sorenessRegions || []).filter(isSorenessRegionKey)
    : []
  const [values,setValues] = useState<Values>({sleepHours:initial.sleepHours ?? 7,sleepQuality:initial.sleepQuality ?? 5,stress:initial.stress ?? 5,soreness:initialSoreness,energy:initial.energy ?? 5,mood:initial.mood ?? 5,hunger:initial.hunger ?? 5,notes:initial.notes ?? '',periodStarted:false,sorenessRegions:initialSorenessRegions})
  const [saving,setSaving] = useState(false)
  const [message,setMessage] = useState('')
  const [sorenessDialogOpen,setSorenessDialogOpen] = useState(false)
  const closeSorenessDialog = useCallback(() => setSorenessDialogOpen(false), [])
  const updateSlider = (key: SliderKey, value: number) => {
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
    setValues((current) => ({
      ...current,
      sorenessRegions: current.sorenessRegions.includes(region)
        ? current.sorenessRegions.filter((selected) => selected !== region)
        : [...current.sorenessRegions, region],
    }))
    setMessage('')
  }
  const slider = (key:SliderKey,label:string) => <AOSSlider key={key} label={label} value={Number(values[key])} min={key==='sleepHours'?0:1} max={key==='sleepHours'?12:10} step={key==='sleepHours'?0.5:1} suffix={key==='sleepHours'?' hours':'/10'} onChange={(value)=>updateSlider(key,value)}/>

  async function save(event:React.FormEvent) {
    event.preventDefault(); setMessage('')
    if (values.soreness > 5 && values.sorenessRegions.length === 0) {
      setMessage('Select where you are experiencing soreness.')
      setSorenessDialogOpen(true)
      return
    }
    setSaving(true)
    try {
      const response = await fetch('/api/daily-check-in',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientId,...values})})
      const payload = await response.json()
      if(!response.ok){setMessage(payload.error||'Check-in could not be saved.');return}
      setMessage('Saved. Today’s recommendations are updating.')
      router.push(`/dashboard/program/${program}`); router.refresh()
    } catch {
      setMessage('Check-in could not be saved. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  return <div className="daily-check-in-layout">
    <AOSCard as="form" className="aos-check-in-form" onSubmit={save}>
      <AOSSectionHeader eyebrow="Today's signals" title="How are you, actually?" copy="Move each marker to match how your body feels right now." />
      <div className="aos-slider-grid">{slider('sleepHours','Sleep duration')}{slider('sleepQuality','Sleep quality')}{slider('energy','Energy')}{slider('stress','Stress')}{slider('soreness','Soreness')}{slider('mood','Mood')}{slider('hunger','Hunger')}</div>
      {values.soreness > 5 && values.sorenessRegions.length ? <div className="aos-chip-list" aria-label="Selected soreness regions">{values.sorenessRegions.map((region) => {
        const label = SORENESS_REGIONS.find((item) => item.key === region)?.label || region
        return <button type="button" key={region} className="aos-chip is-selected" aria-pressed="true" onClick={() => toggleSorenessRegion(region)}>{label}</button>
      })}</div> : null}
      {cycleTrackingEnabled ? <div className="aos-period-panel"><span className="aos-period-panel__icon" aria-hidden="true">◒</span><AOSToggle label="My period started today" description="This updates your cycle day and today's recommendations." checked={values.periodStarted} onChange={(periodStarted)=>setValues((current)=>({...current,periodStarted}))}/></div> : null}
      <AOSInput multiline label="Optional notes" placeholder="Anything else your body is telling you?" rows={4} value={values.notes} onChange={(event)=>setValues((current)=>({...current,notes:event.target.value}))}/>
      <AOSButton type="submit" disabled={saving}>{saving?'Saving…':'Save Daily Check-In'}</AOSButton>
      {message?<p className="aos-status" role="status">{message}</p>:null}
    </AOSCard>
    <div className="aos-symptom-column"><AOSSectionHeader eyebrow="Symptoms" title="Add any body signal." copy="Optional. Tap the area where you feel something."/><SymptomLogger clientId={clientId}/></div>
    <AOSModal open={sorenessDialogOpen} title="Soreness regions" onClose={closeSorenessDialog}>
      <AOSSectionHeader eyebrow="Soreness" title="Where are you sore?" copy="Choose every area that should be protected from today's training." />
      <div className="aos-chip-list" role="group" aria-label="Soreness regions">
        {SORENESS_REGIONS.map((region) => {
          const selected = values.sorenessRegions.includes(region.key)
          return <button type="button" key={region.key} className={`aos-chip${selected?' is-selected':''}`} aria-pressed={selected} onClick={() => toggleSorenessRegion(region.key)}>{region.label}</button>
        })}
      </div>
      {message === 'Select where you are experiencing soreness.' ? <p className="aos-status" role="alert">{message}</p> : null}
      <div className="aos-button-row">
        <AOSButton type="button" onClick={closeSorenessDialog}>Done</AOSButton>
        <AOSButton type="button" variant="ghost" onClick={() => setValues((current) => ({ ...current, sorenessRegions: [] }))}>Clear regions</AOSButton>
      </div>
    </AOSModal>
  </div>
}
