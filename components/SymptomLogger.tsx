'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { AOSButton } from '@/components/aos-ui/AOSButton'
import { AOSCard } from '@/components/aos-ui/AOSCard'
import { AOSChip } from '@/components/aos-ui/AOSChip'
import { AOSModal } from '@/components/aos-ui/AOSModal'
import { AOSSectionHeader } from '@/components/aos-ui/AOSSectionHeader'
import { AOSSlider } from '@/components/aos-ui/AOSSlider'

type SymptomType = { id: string; name: string; category: string | null }
type BodyRegion = { id: string; name: string }
type Area = 'head' | 'chest' | 'abdomen' | 'pelvis' | 'arms' | 'legs'

const areas: Array<{ key: string; id: Area; label: string; style: React.CSSProperties }> = [
  { key: 'head', id: 'head', label: 'Head', style: { left: '39%', top: '9%', width: '22%', height: '17%' } },
  { key: 'chest', id: 'chest', label: 'Chest', style: { left: '31%', top: '25%', width: '38%', height: '13%' } },
  { key: 'abdomen', id: 'abdomen', label: 'Abdomen', style: { left: '34%', top: '38%', width: '32%', height: '15%' } },
  { key: 'pelvis', id: 'pelvis', label: 'Pelvis', style: { left: '33%', top: '52%', width: '34%', height: '10%' } },
  { key: 'left-arm', id: 'arms', label: 'Left arm', style: { left: '20%', top: '27%', width: '14%', height: '34%' } },
  { key: 'right-arm', id: 'arms', label: 'Right arm', style: { right: '20%', top: '27%', width: '14%', height: '34%' } },
  { key: 'left-leg', id: 'legs', label: 'Left leg', style: { left: '29%', top: '62%', width: '20%', height: '31%' } },
  { key: 'right-leg', id: 'legs', label: 'Right leg', style: { right: '29%', top: '62%', width: '20%', height: '31%' } },
]

const symptomKeywords: Record<Area, string[]> = {
  head: ['head', 'headache', 'migraine', 'dizz', 'brain fog', 'vision', 'sinus', 'jaw'],
  chest: ['chest', 'breast', 'heart', 'breath', 'palpitation'],
  abdomen: ['stomach', 'nausea', 'bloat', 'digest', 'reflux', 'abdom', 'constipation', 'diarrhea'],
  pelvis: ['pelvic', 'period', 'menstrual', 'uter', 'ovary', 'vaginal'],
  arms: ['arm', 'shoulder', 'elbow', 'wrist', 'hand'],
  legs: ['leg', 'hip', 'knee', 'ankle', 'foot', 'feet'],
}

export default function SymptomLogger({ clientId }: { clientId: string }) {
  const [symptoms, setSymptoms] = useState<SymptomType[]>([])
  const [regions, setRegions] = useState<BodyRegion[]>([])
  const [area, setArea] = useState<Area | null>(null)
  const [selectedSymptom, setSelectedSymptom] = useState<SymptomType | null>(null)
  const [severity, setSeverity] = useState(5)
  const [durationMinutes, setDurationMinutes] = useState(30)
  const [minutesAfterMeal, setMinutesAfterMeal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetch('/api/symptoms/options').then((res) => res.json()).then((data) => {
      setSymptoms(data.symptomTypes || [])
      setRegions(data.bodyRegions || [])
    })
  }, [])

  const filteredSymptoms = useMemo(() => {
    if (!area) return []
    const keywords = symptomKeywords[area]
    const matches = symptoms.filter((symptom) => {
      const text = `${symptom.name} ${symptom.category || ''}`.toLowerCase()
      return keywords.some((keyword) => text.includes(keyword)) || /cramp|pain|soreness|ache/.test(text)
    })
    return matches.length ? matches : symptoms
  }, [area, symptoms])

  const bodyRegionId = useMemo(() => {
    if (!area) return null
    const aliases = symptomKeywords[area]
    return regions.find((region) => {
      const name = region.name.toLowerCase()
      return name.includes(area) || aliases.some((alias) => name.includes(alias))
    })?.id || null
  }, [area, regions])

  function closePopup() {
    setArea(null)
    setSelectedSymptom(null)
    setMessage('')
  }

  async function logSymptom() {
    if (!selectedSymptom) return
    setLoading(true)
    setMessage('')
    const res = await fetch('/api/symptoms/log', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId, symptomTypeId: selectedSymptom.id, bodyRegionId,
        severity, durationMinutes, startedMinutesAfterMeal: minutesAfterMeal,
      }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) return setMessage(data.error || 'Unable to log symptom.')
    setMessage('Logged. The system can use this signal now.')
    setTimeout(closePopup, 900)
  }

  return (
    <AOSCard className="aos-body-map-card">
      <p className="aos-body-map-instruction">Tap where you feel it.</p>
      <div className="aos-body-map">
        <Image src="/woman-silhouette.png" alt="Woman body map with selectable regions" width={862} height={1825} sizes="(max-width: 800px) 88vw, 430px" className="aos-body-map__image" priority />
        {areas.map((item) => (
          <button key={item.key} type="button" aria-label={`Log a symptom in the ${item.label}`}
            onClick={() => { setArea(item.id); setSelectedSymptom(null) }}
            className={`aos-body-hotspot ${area === item.id ? 'is-selected' : ''}`}
            style={item.style}>
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      <AOSModal open={Boolean(area)} title={`Log ${area || ''} symptom`} onClose={closePopup}>
        {area ? (
          !selectedSymptom ? (
              <>
                <AOSSectionHeader eyebrow={area} title="What are you feeling?" copy="Choose the signal that best matches what you notice." />
                <div className="aos-chip-list">
                  {filteredSymptoms.map((symptom) => (
                    <AOSChip key={symptom.id} onClick={() => setSelectedSymptom(symptom)}>
                      {symptom.name}
                    </AOSChip>
                  ))}
                </div>
              </>
            ) : (
              <>
                <AOSSectionHeader eyebrow={selectedSymptom.name} title="How much is your body noticing?" copy="Set the intensity and timing. No notes required." />
                <div className="aos-modal-sliders">
                  <AOSSlider label="Severity" value={severity} min={1} max={10} suffix="/10" onChange={setSeverity} />
                  <AOSSlider label="Duration" value={durationMinutes} min={0} max={240} step={5} suffix=" minutes" onChange={setDurationMinutes} />
                  <AOSSlider label="Started after eating" value={minutesAfterMeal} min={0} max={240} step={5} suffix=" minutes" onChange={setMinutesAfterMeal} />
                </div>
                <div className="aos-button-row">
                  <AOSButton type="button" variant="secondary" onClick={() => setSelectedSymptom(null)}>Back</AOSButton>
                  <AOSButton type="button" disabled={loading} onClick={logSymptom}>{loading ? 'Saving…' : 'Log Signal'}</AOSButton>
                </div>
                {message ? <p className="aos-status" role="status">{message}</p> : null}
              </>
          )
        ) : null}
      </AOSModal>
    </AOSCard>
  )
}
