'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { AOSButton } from '@/components/aos-ui/AOSButton'
import { AOSChip } from '@/components/aos-ui/AOSChip'
import { AOSSlider } from '@/components/aos-ui/AOSSlider'
import {
  filterAreaSymptoms, periodRelatedSymptoms, resolveSymptomBodyRegion,
  type BodyRegion, type SymptomArea, type SymptomRoute, type SymptomType,
} from '@/lib/symptoms/symptomCatalog'
import './symptom-logger.css'

const areas: Array<{ key: string; id: SymptomArea; label: string; style: React.CSSProperties }> = [
  { key: 'head', id: 'head', label: 'Head', style: { left: '39%', top: '9%', width: '22%', height: '17%' } },
  { key: 'chest', id: 'chest', label: 'Chest', style: { left: '31%', top: '25%', width: '38%', height: '13%' } },
  { key: 'abdomen', id: 'abdomen', label: 'Abdomen', style: { left: '34%', top: '38%', width: '32%', height: '15%' } },
  { key: 'pelvis', id: 'pelvis', label: 'Pelvis', style: { left: '33%', top: '52%', width: '34%', height: '10%' } },
  { key: 'left-arm', id: 'arms', label: 'Left arm', style: { left: '20%', top: '27%', width: '14%', height: '34%' } },
  { key: 'right-arm', id: 'arms', label: 'Right arm', style: { right: '20%', top: '27%', width: '14%', height: '34%' } },
  { key: 'left-leg', id: 'legs', label: 'Left leg', style: { left: '29%', top: '62%', width: '20%', height: '31%' } },
  { key: 'right-leg', id: 'legs', label: 'Right leg', style: { right: '29%', top: '62%', width: '20%', height: '31%' } },
]
const routeLabels: Record<SymptomRoute, string> = {
  head: 'Head', chest: 'Chest', abdomen: 'Abdomen', pelvis: 'Pelvis', arms: 'Arms', legs: 'Legs', back: 'Back',
  period: 'Period-related symptoms', all: 'All symptoms',
}

type Props = {
  clientId: string; open: boolean; onClose: () => void; onAfterClose: () => void
  onSaved: (name: string) => void; periodContext?: boolean
}

export default function SymptomLogger({ clientId, open, onClose, onAfterClose, onSaved, periodContext = false }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const stepHeading = useRef<HTMLHeadingElement>(null)
  const titleId = useId()
  const submitLock = useRef(false)
  const submissionId = useRef<string | null>(null)
  const lastSubmission = useRef('')
  const [symptoms, setSymptoms] = useState<SymptomType[]>([])
  const [regions, setRegions] = useState<BodyRegion[]>([])
  const [optionsLoaded, setOptionsLoaded] = useState(false)
  const [optionsError, setOptionsError] = useState('')
  const [optionsAttempt, setOptionsAttempt] = useState(0)
  const [route, setRoute] = useState<SymptomRoute | null>(null)
  const [selectedSymptom, setSelectedSymptom] = useState<SymptomType | null>(null)
  const [severity, setSeverity] = useState(5)
  const [durationMinutes, setDurationMinutes] = useState(30)
  const [minutesAfterMeal, setMinutesAfterMeal] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (!open) {
      if (element.open) element.close()
      return
    }
    if (!element.open) element.showModal()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [open])

  useEffect(() => {
    if (open) {
      stepHeading.current?.focus({ preventScroll: true })
      if (dialog.current) dialog.current.scrollTop = 0
    }
  }, [open, route, selectedSymptom])

  useEffect(() => {
    if (!open || optionsLoaded) return
    let active = true
    setOptionsError('')
    fetch('/api/symptoms/options').then(async res => {
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Unable to load symptoms. Please try again.')
      if (!Array.isArray(data.symptomTypes) || !Array.isArray(data.bodyRegions)) throw new Error('Unable to load symptoms. Please try again.')
      if (active) { setSymptoms(data.symptomTypes); setRegions(data.bodyRegions); setOptionsLoaded(true) }
    }).catch(error => { if (active) setOptionsError(error instanceof Error ? error.message : 'Unable to load symptoms. Please try again.') })
    return () => { active = false }
  }, [open, optionsLoaded, optionsAttempt])

  const filteredSymptoms = useMemo(() => {
    if (route === 'period') return periodRelatedSymptoms(symptoms)
    if (route === 'all') return symptoms
    return route ? filterAreaSymptoms(symptoms, route, periodContext) : []
  }, [route, symptoms, periodContext])
  const bodyRegionId = resolveSymptomBodyRegion(regions, route, selectedSymptom)

  function chooseRoute(next: SymptomRoute | null) {
    if (submitLock.current) return
    setRoute(next); setSelectedSymptom(null); setError('')
  }

  async function logSymptom() {
    if (!selectedSymptom || submitLock.current) return
    const fingerprint = JSON.stringify([clientId, selectedSymptom.id, bodyRegionId, severity, durationMinutes, minutesAfterMeal])
    if (lastSubmission.current !== fingerprint) submissionId.current = null
    lastSubmission.current = fingerprint
    submitLock.current = true
    submissionId.current ||= crypto.randomUUID()
    setSaving(true); setError('')
    let savedName: string | null = null
    try {
      const res = await fetch('/api/symptoms/log', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, requestId: submissionId.current, symptomTypeId: selectedSymptom.id, bodyRegionId, severity, durationMinutes, startedMinutesAfterMeal: minutesAfterMeal }),
      })
      const data = await res.json()
      if (!res.ok || data.success !== true) throw new Error(data.error || 'Unable to save your symptom. Try again.')
      savedName = selectedSymptom.name
      submissionId.current = null; lastSubmission.current = ''
      setRoute(null); setSelectedSymptom(null); setSeverity(5); setDurationMinutes(30); setMinutesAfterMeal(0)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Your symptom could not be saved. Try again.')
    } finally {
      submitLock.current = false; setSaving(false)
    }
    if (savedName) onSaved(savedName)
  }

  return <dialog ref={dialog} className="symptom-dialog" aria-labelledby={titleId} aria-describedby={`${titleId}-description`}
    onCancel={event => { event.preventDefault(); if (!submitLock.current) onClose() }}
    onClose={onAfterClose}>
    <div className="symptom-dialog__header">
      <div><p className="aos-eyebrow">Symptoms · Daily check-in</p>
        <h2 ref={stepHeading} tabIndex={-1} id={titleId}>{selectedSymptom?.name || (route ? routeLabels[route] : 'Log a symptom')}</h2>
      </div>
      <AOSButton type="button" variant="ghost" disabled={saving} onClick={onClose} aria-label="Close symptom popup">×</AOSButton>
    </div>
    <p id={`${titleId}-description`} className="symptom-dialog__copy">Symptoms save separately. Return here to finish your Daily Check-In afterward.</p>
    <fieldset disabled={saving} className="symptom-dialog__fields">
      {!route ? <>
        <div className="symptom-dialog__routes">
          <AOSButton type="button" variant="secondary" onClick={() => chooseRoute('period')}>Period-related symptoms</AOSButton>
          <AOSButton type="button" variant="secondary" onClick={() => chooseRoute('all')}>Browse all symptoms</AOSButton>
        </div>
        {periodContext ? <p className="symptom-dialog__copy">Period-related choices are highlighted for your check-in. You can also choose a body area below.</p> : null}
        <p className="aos-body-map-instruction">Choose where you feel it, or browse symptoms above.</p>
        <div className="symptom-dialog__map-layout">
          <div className="aos-body-map">
            <Image src="/woman-silhouette.png" alt="Body silhouette" width={862} height={1825} sizes="(max-width: 600px) 78vw, 280px" className="aos-body-map__image" />
            {areas.map(item => <button key={item.key} type="button" aria-label={`Log a symptom in the ${item.label}`}
              onClick={() => chooseRoute(item.id)} className="aos-body-hotspot" style={item.style}><span>{item.label}</span></button>)}
          </div>
          <div className="symptom-dialog__area-list" role="group" aria-label="Choose a body area">
            {(['head', 'chest', 'abdomen', 'pelvis', 'arms', 'legs', 'back'] as SymptomArea[]).map(area =>
              <AOSButton key={area} type="button" variant="secondary" onClick={() => chooseRoute(area)}>{routeLabels[area]}</AOSButton>)}
          </div>
        </div>
      </> : !selectedSymptom ? <>
        <AOSButton type="button" variant="ghost" onClick={() => chooseRoute(null)}>Back to body areas</AOSButton>
        {route === 'period' ? <p className="symptom-dialog__copy">Choose what you notice. Logging a symptom does not record that your period started.</p> : null}
        {optionsError ? <div role="alert"><p>{optionsError}</p><AOSButton type="button" variant="secondary" onClick={() => setOptionsAttempt(current => current + 1)}>Try loading again</AOSButton></div>
          : !optionsLoaded ? <p role="status">Loading symptoms…</p>
          : <><div className="aos-chip-list" role="group" aria-label="Symptoms">
            {filteredSymptoms.map(symptom => <AOSChip key={symptom.id} onClick={() => { setSelectedSymptom(symptom); setError('') }}>{symptom.name}</AOSChip>)}
          </div>{filteredSymptoms.length === 0 ? <p>No matching symptoms are available yet. Browse all symptoms for other choices.</p> : null}</>}
        {route !== 'all' ? <div className="symptom-dialog__routes">
          {route !== 'period' ? <AOSButton type="button" variant="secondary" onClick={() => chooseRoute('period')}>Period-related symptoms</AOSButton> : null}
          <AOSButton type="button" variant="secondary" onClick={() => chooseRoute('all')}>Browse all symptoms</AOSButton>
        </div> : null}
      </> : <>
        <p className="symptom-dialog__copy">Set the intensity and timing. No notes required.</p>
        <div className="aos-modal-sliders">
          <AOSSlider label="Severity" value={severity} min={1} max={10} suffix="/10" onChange={setSeverity} />
          <AOSSlider label="Duration" value={durationMinutes} min={0} max={240} step={5} suffix=" minutes" onChange={setDurationMinutes} />
          <AOSSlider label="Started after eating" value={minutesAfterMeal} min={0} max={240} step={5} suffix=" minutes" onChange={setMinutesAfterMeal} />
        </div>
        {error ? <p className="aos-status" role="alert">{error}</p> : null}
        <div className="symptom-dialog__actions">
          <AOSButton type="button" variant="secondary" onClick={() => { setSelectedSymptom(null); setError('') }}>Back</AOSButton>
          <AOSButton type="button" disabled={saving} onClick={logSymptom}>{saving ? 'Saving…' : 'Save symptom'}</AOSButton>
        </div>
      </>}
      <AOSButton type="button" variant="ghost" onClick={onClose}>Cancel</AOSButton>
    </fieldset>
  </dialog>
}
