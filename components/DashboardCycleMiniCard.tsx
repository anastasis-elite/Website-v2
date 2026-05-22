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

  const [intensities] = useState<
    Record<string, 'mild' | 'moderate' | 'heavy'>
  >(() => {
    const initial: Record<string, 'mild' | 'moderate' | 'heavy'> = {}

    symptomPredictions.forEach((symptom) => {
      initial[symptom.key] =
        existingSymptoms[symptom.key] ||
        symptom.mostCommonIntensity ||
        'moderate'
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
      ? 'Extended'
      : cycleStatus.phase
      ? `${cycleStatus.phase.charAt(0).toUpperCase()}${cycleStatus.phase.slice(1)}`
      : 'Awareness'

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
          margin: '0 0 10px',
          letterSpacing: '3px',
          fontSize: '10px',
        }}
      >
        Cycle Note
      </p>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '12px',
          alignItems: 'flex-start',
          marginBottom: cycleStatus.enabled ? '10px' : '0',
        }}
      >
        <div>
          <h3
            style={{
              margin: '0 0 4px',
              fontSize: '1.12rem',
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
              margin: 0,
              color: 'rgba(215,199,182,0.68)',
              fontSize: '0.82rem',
              lineHeight: 1.4,
            }}
          >
            {cycleStatus.enabled
              ? `${phaseLabel} estimate`
              : 'Add cycle awareness.'}
          </p>
        </div>

        <Link
          href="/dashboard/cycle"
          style={{
            color: 'rgba(197,139,87,0.92)',
            fontSize: '0.78rem',
            whiteSpace: 'nowrap',
            marginTop: '2px',
          }}
        >
          Open →
        </Link>
      </div>

      {cycleStatus.enabled ? (
        <div
          style={{
            display: 'grid',
            gap: '8px',
          }}
        >
          <div
            style={{
              display: 'grid',
              gap: '5px',
            }}
          >
            {symptomPredictions.slice(0, 3).map((symptom) => (
              <label
                key={symptom.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '7px',
                  color: 'rgba(215,199,182,0.82)',
                  fontSize: '0.78rem',
                  lineHeight: 1.25,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={!!selectedSymptoms[symptom.key]}
                  onChange={(e) =>
                    toggleSymptom(symptom.key, e.target.checked)
                  }
                  style={{
                    accentColor: '#b56e43',
                    width: '11px',
                    height: '11px',
                    minWidth: '11px',
                    minHeight: '11px',
                    padding: 0,
                    margin: 0,
                    boxShadow: 'none',
                    borderRadius: '2px',
                    flexShrink: 0,
                  }}
                />

                <span>
                  {symptom.label}
                  <span style={{ opacity: 0.48 }}>
                    {' '}
                    · {intensities[symptom.key] || symptom.mostCommonIntensity}
                  </span>
                </span>
              </label>
            ))}
          </div>

          <button
            type="button"
            onClick={saveQuickCycleNote}
            disabled={saving}
            style={{
              ...styles.primaryButtonStyle,
              padding: '7px 12px',
              fontSize: '0.78rem',
              marginTop: '2px',
              opacity: saving ? 0.65 : 1,
              width: 'fit-content',
              minWidth: 'unset',
            }}
          >
            {saving ? 'Saving...' : saved ? 'Saved' : 'Save'}
          </button>

          {error ? (
            <p
              style={{
                margin: '2px 0 0',
                color: '#ffb4b4',
                fontSize: '0.76rem',
                lineHeight: 1.35,
              }}
            >
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
