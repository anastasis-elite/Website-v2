'use client'

import { useState } from 'react'
import * as styles from '@/app/styles/globalstyles'

type CycleStatus = {
  enabled: boolean
  cycleDay: number | null
  phase: string | null
  label: string
  recoveryCaution: boolean
  recoveryNote: string | null
}

type TodayCycleLog = {
  bleeding?: boolean
  cramps?: boolean
  headache?: boolean
  fatigue?: boolean
  mood_sensitivity?: boolean
  notes?: string
} | null

type CycleHistoryItem = {
  period_start_date: string
  cycle_length: string
  bleeding_length: string
}

type Props = {
  clientId: string
  cycleStatus: CycleStatus
  lastPeriodStart?: string | null
  averageCycleLength?: number | null
  cycleTrackingEnabled?: boolean
  todayLog?: TodayCycleLog
}

const emptyCycleHistory: CycleHistoryItem[] = [
  { period_start_date: '', cycle_length: '', bleeding_length: '' },
  { period_start_date: '', cycle_length: '', bleeding_length: '' },
  { period_start_date: '', cycle_length: '', bleeding_length: '' },
  { period_start_date: '', cycle_length: '', bleeding_length: '' },
  { period_start_date: '', cycle_length: '', bleeding_length: '' },
  { period_start_date: '', cycle_length: '', bleeding_length: '' },
]

export default function CycleTracker({
  clientId,
  cycleStatus,
  lastPeriodStart,
  averageCycleLength,
  cycleTrackingEnabled,
  todayLog,
}: Props) {
  const [enabled, setEnabled] = useState(!!cycleTrackingEnabled)
  const [periodStart, setPeriodStart] = useState(lastPeriodStart || '')
  const [cycleLength, setCycleLength] = useState(
    averageCycleLength || 28
  )

  const [knowsCycleHistory, setKnowsCycleHistory] = useState(false)
  const [cycleHistory, setCycleHistory] =
    useState<CycleHistoryItem[]>(emptyCycleHistory)

  const [bleeding, setBleeding] = useState(!!todayLog?.bleeding)
  const [cramps, setCramps] = useState(!!todayLog?.cramps)
  const [headache, setHeadache] = useState(!!todayLog?.headache)
  const [fatigue, setFatigue] = useState(!!todayLog?.fatigue)
  const [moodSensitivity, setMoodSensitivity] = useState(
    !!todayLog?.mood_sensitivity
  )
  const [notes, setNotes] = useState(todayLog?.notes || '')

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  function updateCycleHistory(
    index: number,
    field: keyof CycleHistoryItem,
    value: string
  ) {
    setCycleHistory((prev) =>
      prev.map((cycle, i) =>
        i === index
          ? {
              ...cycle,
              [field]: value,
            }
          : cycle
      )
    )

    setSaved(false)
  }

  async function saveCycleData() {
    try {
      setSaving(true)
      setSaved(false)
      setError('')

      const cleanedCycleHistory = knowsCycleHistory
        ? cycleHistory
            .filter((cycle) => cycle.period_start_date)
            .map((cycle) => ({
              period_start_date: cycle.period_start_date,
              cycle_length: cycle.cycle_length
                ? Number(cycle.cycle_length)
                : null,
              bleeding_length: cycle.bleeding_length
                ? Number(cycle.bleeding_length)
                : null,
            }))
        : []

      const response = await fetch('/api/cycle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          cycle_tracking_enabled: enabled,
          last_period_start: periodStart || null,
          average_cycle_length: Number(cycleLength || 28),

          knows_cycle_history: knowsCycleHistory,
          cycle_history: cleanedCycleHistory,

          bleeding,
          cramps,
          headache,
          fatigue,
          mood_sensitivity: moodSensitivity,
          notes,
        }),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(data?.error || 'Cycle update failed')
      }

      setSaved(true)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Cycle update failed'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: '28px' }}>
      <section style={styles.cartBoxStyle}>
        <h2 style={styles.sectionTitleStyle}>
          Cycle Setup
        </h2>

        <p style={styles.bodyStyle}>
          This is used for awareness only. It helps the system understand where
          you may be in your cycle so recovery suggestions can stay more
          supportive.
        </p>

        <label
          style={{
            ...styles.bodyStyle,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginTop: '18px',
          }}
        >
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => {
              setEnabled(e.target.checked)
              setSaved(false)
            }}
            style={{ accentColor: '#b56e43' }}
          />
          Enable cycle awareness
        </label>

        {enabled ? (
          <div
            style={{
              display: 'grid',
              gap: '18px',
              marginTop: '24px',
            }}
          >
            <div style={styles.fieldWrap}>
              <label style={styles.labelStyle}>
                Last period start date
              </label>

              <input
                type="date"
                value={periodStart}
                onChange={(e) => {
                  setPeriodStart(e.target.value)
                  setSaved(false)
                }}
                style={{
                  ...styles.inputStyle,
                  WebkitAppearance: 'none',
                  appearance: 'none',
                }}
              />
            </div>

            <div style={styles.fieldWrap}>
              <label style={styles.labelStyle}>
                Average cycle length
              </label>

              <input
                type="number"
                min={21}
                max={60}
                value={cycleLength}
                onChange={(e) => {
                  setCycleLength(Number(e.target.value))
                  setSaved(false)
                }}
                style={styles.inputStyle}
              />
            </div>

            <div
              style={{
                borderTop: '1px solid rgba(181,110,67,0.14)',
                paddingTop: '22px',
                marginTop: '4px',
              }}
            >
              <h3
                style={{
                  margin: '0 0 10px',
                  fontSize: '1.1rem',
                  fontWeight: 500,
                  color: '#f5f0e8',
                }}
              >
                Cycle History
              </h3>

              <p style={styles.bodyStyle}>
                If you know your recent cycle history, you can add it here so
                the system can estimate your cycle more accurately sooner. If
                you do not know it, leave this off and the system will learn as
                you log.
              </p>

              <label
                style={{
                  ...styles.bodyStyle,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  marginTop: '18px',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={knowsCycleHistory}
                  onChange={(e) => {
                    setKnowsCycleHistory(e.target.checked)
                    setSaved(false)
                  }}
                  style={{
                    marginTop: '7px',
                    accentColor: '#b56e43',
                  }}
                />

                <span>
                  I know my last 6 months of cycles.
                </span>
              </label>

              {knowsCycleHistory ? (
                <div
                  style={{
                    display: 'grid',
                    gap: '16px',
                    marginTop: '24px',
                  }}
                >
                  {cycleHistory.map((cycle, index) => (
                    <div
                      key={index}
                      style={{
                        borderRadius: '22px',
                        padding: '18px',
                        background: 'rgba(255,255,255,0.018)',
                        boxShadow:
                          'inset 0 0 24px rgba(255,255,255,0.01)',
                      }}
                    >
                      <p
                        style={{
                          ...styles.eyebrowStyle,
                          marginBottom: '14px',
                          letterSpacing: '3px',
                          fontSize: '10px',
                        }}
                      >
                        Cycle {index + 1}
                      </p>

                      <div style={styles.gridTwoCol}>
                        <div style={styles.fieldWrap}>
                          <label style={styles.labelStyle}>
                            Period start date
                          </label>

                          <input
                            type="date"
                            value={cycle.period_start_date}
                            onChange={(e) =>
                              updateCycleHistory(
                                index,
                                'period_start_date',
                                e.target.value
                              )
                            }
                            style={{
                              ...styles.inputStyle,
                              WebkitAppearance: 'none',
                              appearance: 'none',
                            }}
                          />
                        </div>

                        <div style={styles.fieldWrap}>
                          <label style={styles.labelStyle}>
                            Days between cycles
                          </label>

                          <input
                            type="number"
                            min={1}
                            value={cycle.cycle_length}
                            onChange={(e) =>
                              updateCycleHistory(
                                index,
                                'cycle_length',
                                e.target.value
                              )
                            }
                            style={styles.inputStyle}
                            placeholder="Example: 28"
                          />
                        </div>

                        <div style={styles.fieldWrap}>
                          <label style={styles.labelStyle}>
                            Bleeding lasted how many days?
                          </label>

                          <input
                            type="number"
                            min={1}
                            value={cycle.bleeding_length}
                            onChange={(e) =>
                              updateCycleHistory(
                                index,
                                'bleeding_length',
                                e.target.value
                              )
                            }
                            style={styles.inputStyle}
                            placeholder="Example: 5"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>

      <section style={styles.cartBoxStyle}>
        <h2 style={styles.sectionTitleStyle}>
          Today’s Cycle Note
        </h2>

        <p style={styles.bodyStyle}>
          <strong>
            {cycleStatus.enabled
              ? cycleStatus.label
              : 'Cycle tracking is not active yet.'}
          </strong>
        </p>

        {cycleStatus.recoveryNote ? (
          <p style={styles.bodyStyle}>
            {cycleStatus.recoveryNote}
          </p>
        ) : null}
      </section>

      <section style={styles.cartBoxStyle}>
        <h2 style={styles.sectionTitleStyle}>
          Today’s Symptoms
        </h2>

        <p style={styles.bodyStyle}>
          These inputs help the system prioritize your actual signals over an
          estimated phase.
        </p>

        <div
          style={{
            display: 'grid',
            gap: '14px',
            marginTop: '22px',
          }}
        >
          <CycleCheckbox
            label="Bleeding today"
            checked={bleeding}
            onChange={setBleeding}
          />

          <CycleCheckbox
            label="Cramps"
            checked={cramps}
            onChange={setCramps}
          />

          <CycleCheckbox
            label="Headache"
            checked={headache}
            onChange={setHeadache}
          />

          <CycleCheckbox
            label="Fatigue"
            checked={fatigue}
            onChange={setFatigue}
          />

          <CycleCheckbox
            label="Mood sensitivity"
            checked={moodSensitivity}
            onChange={setMoodSensitivity}
          />
        </div>

        <div
          style={{
            ...styles.fieldWrap,
            marginTop: '24px',
          }}
        >
          <label style={styles.labelStyle}>
            Notes
          </label>

          <textarea
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value)
              setSaved(false)
            }}
            style={styles.textareaStyle}
            placeholder="Anything your body is telling you today?"
          />
        </div>

        <button
          type="button"
          onClick={saveCycleData}
          disabled={saving}
          style={{
            ...styles.primaryButtonStyle,
            marginTop: '22px',
            opacity: saving ? 0.65 : 1,
          }}
        >
          {saving ? 'Saving...' : saved ? 'Cycle Saved' : 'Save Cycle Note'}
        </button>

        {error ? (
          <p
            style={{
              ...styles.bodyStyle,
              color: '#ffb4b4',
              marginTop: '14px',
            }}
          >
            {error}
          </p>
        ) : null}
      </section>
    </div>
  )
}

function CycleCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label
      style={{
        display: 'flex',
        gap: '12px',
        alignItems: 'center',
        color: 'rgba(215,199,182,0.88)',
        lineHeight: 1.6,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{
          accentColor: '#b56e43',
        }}
      />

      {label}
    </label>
  )
}
