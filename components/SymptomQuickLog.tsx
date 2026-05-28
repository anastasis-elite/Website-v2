'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import * as styles from '@/app/styles/globalstyles'

type SymptomType = {
  id: string
  name: string
  category: string | null
}

type BodyRegion = {
  id: string
  name: string
}

type Props = {
  clientId: string
}

const quickSymptoms = [
  'Bloating',
  'Fatigue',
  'Brain Fog',
  'Headache',
  'Anxiety',
  'Water Retention',
  'Reflux',
  'Rapid Heart Rate',
]

export default function SymptomQuickLog({ clientId }: Props) {
  const [symptoms, setSymptoms] = useState<SymptomType[]>([])
  const [regions, setRegions] = useState<BodyRegion[]>([])
  const [selectedSymptomId, setSelectedSymptomId] = useState('')
  const [selectedRegionId, setSelectedRegionId] = useState('')
  const [severity, setSeverity] = useState('5')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function loadOptions() {
      const res = await fetch('/api/symptoms/options')
      const data = await res.json()

      if (res.ok) {
        setSymptoms(data.symptomTypes || [])
        setRegions(data.bodyRegions || [])
      }
    }

    loadOptions()
  }, [])

  const visibleSymptoms = symptoms.filter((symptom) =>
    quickSymptoms.includes(symptom.name)
  )

  async function logSymptom() {
    if (!selectedSymptomId) {
      setMessage('Select a symptom first.')
      return
    }

    setLoading(true)
    setMessage('')

    const res = await fetch('/api/symptoms/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId,
        symptomTypeId: selectedSymptomId,
        bodyRegionId: selectedRegionId || null,
        severity: Number(severity),
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      setMessage(data.error || 'Unable to log symptom.')
      setLoading(false)
      return
    }

    setMessage('Symptom logged.')
    setSelectedSymptomId('')
    setSelectedRegionId('')
    setSeverity('5')
    setLoading(false)
  }

  return (
    <section style={styles.cartBoxStyle}>
      <h2 style={styles.sectionTitleStyle}>Quick Symptom Log</h2>

      <p style={styles.bodyStyle}>
        Capture what your body is telling you in the moment.
      </p>

      <div style={styles.compactCardGridStyle}>
        {visibleSymptoms.map((symptom) => {
          const selected = selectedSymptomId === symptom.id

          return (
            <button
              key={symptom.id}
              type="button"
              onClick={() => setSelectedSymptomId(symptom.id)}
              style={{
                ...styles.compactCardStyle,
                opacity: selected ? 1 : 0.65,
              }}
            >
              <h3 style={styles.compactCardTitleStyle}>
                {symptom.name}
              </h3>
            </button>
          )
        })}
      </div>

      <div style={{ ...styles.fieldWrap, marginTop: '18px' }}>
        <label style={styles.labelStyle}>Body Area</label>

        <select
          style={styles.inputStyle}
          value={selectedRegionId}
          onChange={(e) => setSelectedRegionId(e.target.value)}
        >
          <option value="">Optional</option>
          {regions.map((region) => (
            <option key={region.id} value={region.id}>
              {region.name}
            </option>
          ))}
        </select>
      </div>

      <div style={{ ...styles.fieldWrap, marginTop: '18px' }}>
        <label style={styles.labelStyle}>Severity: {severity}/10</label>

        <input
          style={styles.inputStyle}
          type="range"
          min="1"
          max="10"
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
        />
      </div>

      <button
        type="button"
        style={{ ...styles.primaryButtonStyle, marginTop: '18px' }}
        onClick={logSymptom}
        disabled={loading}
      >
        {loading ? 'Logging...' : 'Log Symptom'}
      </button>

      {message && (
        <p style={{ ...styles.bodyStyle, marginTop: '18px' }}>
          {message}
        </p>
      )}

      <div style={{ marginTop: '22px' }}>
        <Link href="/dashboard/symptoms" style={styles.secondaryButtonStyle}>
          Log More Symptoms
        </Link>
      </div>
    </section>
  )
}
