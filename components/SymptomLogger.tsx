'use client'

import { useEffect, useMemo, useState } from 'react'
import * as styles from '@/app/styles/globalstyles'

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
    <section style={bodyMapShellStyle}>
      <p style={{ ...styles.bodyStyle, textAlign: 'center' }}>Tap where you feel it.</p>
      <div style={bodyMapStyle}>
        <img src="/woman-silhouette.png" alt="Body map" style={bodyImageStyle} />
        {areas.map((item) => (
          <button key={item.key} type="button" aria-label={`Log a symptom in the ${item.label}`}
            onClick={() => { setArea(item.id); setSelectedSymptom(null) }}
            style={{ ...hitAreaStyle, ...item.style }}>
            <span style={hitLabelStyle}>{item.label}</span>
          </button>
        ))}
      </div>

      {area ? (
        <div role="dialog" aria-modal="true" aria-label={`Log ${area} symptom`} style={overlayStyle} onClick={closePopup}>
          <div style={modalStyle} onClick={(event) => event.stopPropagation()}>
            <button type="button" onClick={closePopup} aria-label="Close" style={closeStyle}>×</button>
            {!selectedSymptom ? (
              <>
                <p style={styles.eyebrowStyle}>{area}</p>
                <h2 style={styles.sectionTitleStyle}>What are you feeling?</h2>
                <div style={symptomListStyle}>
                  {filteredSymptoms.map((symptom) => (
                    <button key={symptom.id} type="button" style={styles.secondaryButtonStyle} onClick={() => setSelectedSymptom(symptom)}>
                      {symptom.name}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p style={styles.eyebrowStyle}>{selectedSymptom.name}</p>
                <h2 style={styles.sectionTitleStyle}>How much is your body noticing?</h2>
                <Slider label="Severity" value={severity} min={1} max={10} suffix="/10" onChange={setSeverity} />
                <Slider label="Duration" value={durationMinutes} min={0} max={240} step={5} suffix=" minutes" onChange={setDurationMinutes} />
                <Slider label="Started after eating" value={minutesAfterMeal} min={0} max={240} step={5} suffix=" minutes" onChange={setMinutesAfterMeal} />
                <div style={styles.buttonRowStyle}>
                  <button type="button" style={styles.secondaryButtonStyle} onClick={() => setSelectedSymptom(null)}>Back</button>
                  <button type="button" style={styles.primaryButtonStyle} disabled={loading} onClick={logSymptom}>{loading ? 'Saving…' : 'Log Signal'}</button>
                </div>
                {message ? <p style={styles.bodyStyle}>{message}</p> : null}
              </>
            )}
          </div>
        </div>
      ) : null}
    </section>
  )
}

function Slider({ label, value, min, max, step = 1, suffix, onChange }: { label: string; value: number; min: number; max: number; step?: number; suffix: string; onChange: (value: number) => void }) {
  return <label style={sliderWrapStyle}><span style={styles.labelStyle}>{label}: <strong>{value}{suffix}</strong></span><input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ width: '100%' }} /></label>
}

const bodyMapShellStyle = { ...styles.cartBoxStyle, padding: '20px', overflow: 'hidden' } as const
const bodyMapStyle = { position: 'relative', width: 'min(100%, 430px)', margin: '0 auto' } as const
const bodyImageStyle = { display: 'block', width: '100%', height: 'auto' } as const
const hitAreaStyle = { position: 'absolute', border: '1px solid rgba(181,110,67,.22)', background: 'rgba(181,110,67,.035)', cursor: 'pointer', borderRadius: '40%', zIndex: 2 } as const
const hitLabelStyle = { position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', color: 'rgba(245,240,232,.66)', fontSize: '9px', letterSpacing: '.08em', textTransform: 'uppercase', whiteSpace: 'nowrap' } as const
const overlayStyle = { position: 'fixed', inset: 0, zIndex: 1200, display: 'grid', placeItems: 'center', padding: '20px', background: 'rgba(0,0,0,.72)', backdropFilter: 'blur(12px)' } as const
const modalStyle = { position: 'relative', width: 'min(100%, 560px)', maxHeight: '86vh', overflowY: 'auto', padding: '34px', borderRadius: '32px', background: 'linear-gradient(145deg, rgba(20,18,16,.98), rgba(8,8,8,.98))', boxShadow: '0 30px 100px rgba(0,0,0,.55)' } as const
const closeStyle = { position: 'absolute', right: '20px', top: '16px', border: 0, background: 'transparent', color: '#f5f0e8', fontSize: '2rem', cursor: 'pointer' } as const
const symptomListStyle = { display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '22px' } as const
const sliderWrapStyle = { display: 'grid', gap: '12px', margin: '24px 0' } as const
