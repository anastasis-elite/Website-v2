'use client'

import { useEffect, useState } from 'react'
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

export default function SymptomLogger({ clientId }: Props) {
  const [symptoms, setSymptoms] = useState<SymptomType[]>([])
  const [regions, setRegions] = useState<BodyRegion[]>([])
  const [selectedSymptomId, setSelectedSymptomId] = useState('')
  const [selectedRegionId, setSelectedRegionId] = useState('')
  const [severity, setSeverity] = useState('5')
  const [durationMinutes, setDurationMinutes] = useState('')
  const [startedMinutesAfterMeal, setStartedMinutesAfterMeal] = useState('')
  const [notes, setNotes] = useState('')
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
        durationMinutes: durationMinutes ? Number(durationMinutes) : null,
        startedMinutesAfterMeal: startedMinutesAfterMeal
          ? Number(startedMinutesAfterMeal)
          : null,
        notes,
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
    setDurationMinutes('')
    setStartedMinutesAfterMeal('')
    setNotes('')
    setLoading(false)
  }

  return (
    <>
      <section style={styles.cartBoxStyle}>
        <h2 style={styles.sectionTitleStyle}>Body Area</h2>

        <div style={styles.compactCardGridStyle}>
          {regions.map((region) => {
            const selected = selectedRegionId === region.id

            return (
              <button
                key={region.id}
                type="button"
                onClick={() => setSelectedRegionId(region.id)}
                style={{
                  ...styles.compactCardStyle,
                  opacity: selected ? 1 : 0.65,
                }}
              >
                <h3 style={styles.compactCardTitleStyle}>
                  {region.name}
                </h3>
              </button>
            )
          })}
        </div>
      </section>

      <section style={styles.cartBoxStyle}>
        <h2 style={styles.sectionTitleStyle}>Symptom</h2>

        <div style={styles.compactCardGridStyle}>
          {symptoms.map((symptom) => {
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

                {symptom.category && (
                  <p style={styles.compactCardTextStyle}>
                    {symptom.category}
                  </p>
                )}
              </button>
            )
          })}
        </div>
      </section>

      <section style={styles.cartBoxStyle}>
        <h2 style={styles.sectionTitleStyle}>Details</h2>

        <div style={styles.gridTwoCol}>
          <div style={styles.fieldWrap}>
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

          <div style={styles.fieldWrap}>
            <label style={styles.labelStyle}>Duration minutes</label>
            <input
              style={styles.inputStyle}
              type="number"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              placeholder="Optional"
            />
          </div>

          <div style={styles.fieldWrap}>
            <label style={styles.labelStyle}>Minutes after meal</label>
            <input
              style={styles.inputStyle}
              type="number"
              value={startedMinutesAfterMeal}
              onChange={(e) => setStartedMinutesAfterMeal(e.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>

        <div style={{ ...styles.fieldWrap, marginTop: '18px' }}>
          <label style={styles.labelStyle}>Notes</label>
          <textarea
            style={styles.textareaStyle}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What were you doing, eating, feeling, or noticing?"
          />
        </div>

        <button
          type="button"
          style={{ ...styles.primaryButtonStyle, marginTop: '22px' }}
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
      </section>
    </>
  )
}
