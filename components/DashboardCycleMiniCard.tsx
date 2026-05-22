'use client'

import { useState } from 'react'
import Link from 'next/link'
import * as styles from '@/app/styles/globalstyles'

type SymptomPrediction = {
  key: string
  label: string
  mostCommonIntensity: 'mild' | 'moderate' | 'heavy'
  count: number
}

type CycleStatus = {
  enabled: boolean
  cycleDay: number | null
  phase: string | null
  label: string
  recoveryCaution: boolean
  recoveryNote?: string | null
}

type Props = {
  clientId: string
  cycleStatus: CycleStatus
  symptomPredictions: SymptomPrediction[]
  todayCycleLog?: any
}

const intensityOptions = ['mild', 'moderate', 'heavy'] as const

export default function DashboardCycleMiniCard({
  clientId,
  cycleStatus,
  symptomPredictions,
  todayCycleLog,
}: Props) {
  const existingSymptoms = todayCycleLog?.symptoms || {}

  const [selectedSymptoms, setSelectedSymptoms] = useState<
    Record<string, boolean>
  >(() => {
    const initial: Record<string, boolean> = {}

    symptomPredictions.forEach((symptom) => {
      initial[symptom.key] = !!existingSymptoms[symptom.key]
    })

    return initial
  })

  const [intensities, setIntensities] = useState<
    Record<string, 'mild' | 'moderate' | 'heavy'>
  >(() => {
    const initial: Record<string, 'mild' | 'moderate' | 'heavy'> = {}

    symptomPredictions.forEach((symptom) => {
      initial[symptom.key] =
        existingSymptoms[symptom.key] || symptom.mostCommonIntensity || 'moderate'
    })

    return initial
  })

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  function toggleSymptom(key: string, checked: boolean) {
    setSelectedSymptoms((prev) => ({
      ...prev,
      [key]: checked,
    }))

    setSaved(false)
  }

  function updateIntensity(
    key: string,
    intensity: 'mild' | 'moderate' | 'heavy'
  ) {
    setIntensities((prev) => ({
      ...prev,
      [key]: intensity,
    }))

    setSelectedSymptoms((prev) => ({
      ...prev,
      [key]: true,
    }))

    setSaved(false)
  }

  async function saveQuickCycleNote() {
    try {
      setSaving(true)
      setSaved(false)
      setError('')

      const symptoms: Record<string, string> = {}

      Object.entries(selectedSymptoms).forEach(([key, selected]) => {
        if (selected) {
          symptoms[key] = intensities[key] || 'moderate'
        }
      })

      const prominentSymptom =
        Object.keys(symptoms)[0] || todayCycleLog?.prominent_symptom || null

      const symptomIntensity =
        prominentSymptom && symptoms[prominentSymptom]
          ? symptoms[prominentSymptom]
          : null

      const response = await fetch('/api/cycle/quick-symptoms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          symptoms,
          prominent_symptom: prominentSymptom,
          symptom_intensity: symptomIntensity,
        }),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(data?.error || 'Cycle symptoms could not be saved')
      }

      setSaved(true)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Cycle symptoms could not be saved'
      )
    } finally {
      setSaving(false)
    }
  }

  const phaseLabel =
    cycleStatus.phase === 'extended_cycle'
      ? 'Extended cycle'
      : cycleStatus.phase
      ? `${cycleStatus.phase.charAt(0).toUpperCase()}${cycleStatus.phase.slice(1)} estimate`
      : 'Awareness only'

  return (
    <section
      style={{
        background: cycleStatus.recoveryCaution
          ? 'rgba(181,110,67,0.08)'
          : 'rgba(255,255,255,0.035)',
        borderRadius: '24px',
        padding: '20px',
        minHeight: '128px',
        boxShadow:
          '0 18px 54px rgba(0,0,0,0.16), inset 0 0 26px rgba(255,255,255,0.012)',
        backdropFilter: 'blur(16px)',
      }}
    >
      <p
        style={{
          ...styles.eyebrowStyle,
          marginBottom: '12px',
          letterSpacing: '3px',
          fontSize: '10px',
        }}
      >
        Cycle Note
      </p>

      <h3
        style={{
          margin: '0 0 8px',
          fontSize: '1.3rem',
          fontWeight: 500,
          letterSpacing: '-0.02em',
          color: '#f5f0e8',
        }}
      >
        {cycleStatus.enabled && cycleStatus.cycleDay
          ? `Day ${cycleStatus.cycleDay}`
          : 'Not active'}
      </h3>

      <p
        style={{
          margin: '0 0 16px',
          color: 'rgba(215,199,182,0.76)',
          fontSize: '0.92rem',
          lineHeight: 1.6,
        }}
      >
        {cycleStatus.enabled
          ? `${phaseLabel} · quick check-in`
          : 'Tap to add cycle awareness.'}
      </p>

      {cycleStatus.enabled ? (
        <div
          style={{
            display: 'grid',
            gap: '12px',
            marginTop: '14px',
          }}
        >
          {symptomPredictions.slice(0, 3).map((symptom) => (
            <div
              key={symptom.key}
              style={{
                display: 'grid',
                gap: '8px',
                padding: '12px',
                borderRadius: '16px',
                background: 'rgba(255,255,255,0.03)',
              }}
            >
              <label
                style={{
                  display: 'flex',
                  gap: '10px',
                  alignItems: 'center',
                  color: 'rgba(215,199,182,0.9)',
                  fontSize: '0.92rem',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={!!selectedSymptoms[symptom.key]}
                  onChange={(e) =>
                    toggleSymptom(symptom.key, e.target.checked)
                  }
                  style={{ accentColor: '#b56e43' }}
                />

                <span>
                  {symptom.label}{' '}
                  <span style={{ opacity: 0.62 }}>
                    · usually {symptom.mostCommonIntensity}
                  </span>
                </span>
              </label>

              {selectedSymptoms[symptom.key] ? (
                <select
                  value={intensities[symptom.key]}
                  onChange={(e) =>
                    updateIntensity(
                      symptom.key,
                      e.target.value as 'mild' | 'moderate' | 'heavy'
                    )
                  }
                  style={{
                    width: '100%',
                    borderRadius: '14px',
                    padding: '10px 12px',
                    background: 'rgba(8,8,8,0.78)',
                    color: '#f5f0e8',
                    border: '1px solid rgba(181,110,67,0.22)',
                  }}
                >
                  {intensityOptions.map((option) => (
                    <option key={option} value={option}>
                      {option.charAt(0).toUpperCase() + option.slice(1)}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
          ))}

          <button
            type="button"
            onClick={saveQuickCycleNote}
            disabled={saving}
            style={{
              ...styles.primaryButtonStyle,
              padding: '11px 16px',
              fontSize: '0.9rem',
              marginTop: '4px',
              opacity: saving ? 0.65 : 1,
            }}
          >
            {saving ? 'Saving...' : saved ? 'Cycle Saved' : 'Save Cycle Note'}
          </button>

          {error ? (
            <p
              style={{
                margin: '4px 0 0',
                color: '#ffb4b4',
                fontSize: '0.86rem',
                lineHeight: 1.5,
              }}
            >
              {error}
            </p>
          ) : null}

          <Link
            href="/dashboard/cycle"
            style={{
              color: 'rgba(197,139,87,0.92)',
              fontSize: '0.86rem',
              marginTop: '2px',
            }}
          >
            Open full cycle tracker →
          </Link>
        </div>
      ) : (
        <Link
          href="/dashboard/cycle"
          style={{
            color: 'rgba(197,139,87,0.92)',
            fontSize: '0.86rem',
          }}
        >
          Open cycle tracker →
        </Link>
      )}
    </section>
  )
}
