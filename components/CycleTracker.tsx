'use client'

import { useMemo, useState } from 'react'

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

type CycleSaveResponse = {
  success?: boolean
  error?: string
  last_period_start?: string | null
  average_cycle_length?: number | null
  estimated_next_period_start?: string | null
  days_until_expected_period?: number | null
  cycle_history_confidence?: 'low' | 'moderate' | 'higher' | null
  valid_cycle_intervals?: number[]
  has_enough_history?: boolean
  prediction_note?: string | null
}

const HISTORY_ENTRY_COUNT = 6

function createEmptyCycleHistory(): CycleHistoryItem[] {
  return Array.from(
    { length: HISTORY_ENTRY_COUNT },
    () => ({
      period_start_date: '',
      bleeding_length: '',
    }),
  )
}

function normalizeDateValue(value?: string | null): string {
  if (!value) {
    return ''
  }

  return value.split('T')[0]
}

function getLatestDate(
  values: string[],
): string | null {
  const validDates = values
    .filter(Boolean)
    .sort(
      (first, second) =>
        new Date(`${first}T00:00:00`).getTime() -
        new Date(`${second}T00:00:00`).getTime(),
    )

  return validDates[validDates.length - 1] ?? null
}

export default function CycleTracker({
  clientId,
  cycleStatus,
  lastPeriodStart,
  averageCycleLength,
  cycleTrackingEnabled,
  todayLog,
}: Props) {
  const [enabled, setEnabled] = useState(
    Boolean(cycleTrackingEnabled),
  )

  const [periodStart, setPeriodStart] = useState(
    normalizeDateValue(lastPeriodStart),
  )

  const [cycleLength, setCycleLength] = useState(
    averageCycleLength || 28,
  )

  const [knowsCycleHistory, setKnowsCycleHistory] =
    useState(false)

  const [cycleHistory, setCycleHistory] = useState<
    CycleHistoryItem[]
  >(createEmptyCycleHistory)

  const [bleeding, setBleeding] = useState(
    Boolean(todayLog?.bleeding),
  )

  const [cramps, setCramps] = useState(
    Boolean(todayLog?.cramps),
  )

  const [headache, setHeadache] = useState(
    Boolean(todayLog?.headache),
  )

  const [fatigue, setFatigue] = useState(
    Boolean(todayLog?.fatigue),
  )

  const [moodSensitivity, setMoodSensitivity] =
    useState(
      Boolean(todayLog?.mood_sensitivity),
    )

  const [notes, setNotes] = useState(
    todayLog?.notes || '',
  )

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const [predictionNote, setPredictionNote] =
    useState<string | null>(null)

  const [predictionConfidence, setPredictionConfidence] =
    useState<
      'low' | 'moderate' | 'higher' | null
    >(null)

  const [validCycleIntervals, setValidCycleIntervals] =
    useState<number[]>([])

  const [estimatedNextPeriodStart, setEstimatedNextPeriodStart] =
    useState<string | null>(null)

  const completedHistoryCount = useMemo(
    () =>
      cycleHistory.filter(
        (cycle) => cycle.period_start_date,
      ).length,
    [cycleHistory],
  )

  function updateCycleHistory(
    index: number,
    field: keyof CycleHistoryItem,
    value: string,
  ) {
    setCycleHistory((previous) => {
      const updated = previous.map((cycle, currentIndex) =>
        currentIndex === index
          ? {
              ...cycle,
              [field]: value,
            }
          : cycle,
      )

      if (field === 'period_start_date') {
        const latestHistoryDate = getLatestDate(
          updated.map(
            (cycle) => cycle.period_start_date,
          ),
        )

        if (latestHistoryDate) {
          setPeriodStart(latestHistoryDate)
        }
      }

      return updated
    })

    setSaved(false)
  }

  async function saveCycleData() {
    try {
      setSaving(true)
      setSaved(false)
      setError('')

      const cleanedCycleHistory = knowsCycleHistory
        ? cycleHistory
            .filter(
              (cycle) =>
                cycle.period_start_date,
            )
            .map((cycle) => ({
              period_start_date:
                cycle.period_start_date,

              bleeding_length:
                cycle.bleeding_length
                  ? Number(
                      cycle.bleeding_length,
                    )
                  : null,
            }))
        : []

      const response = await fetch('/api/cycle', {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          cycle_tracking_enabled:
            enabled,

          last_period_start:
            periodStart || null,

          /*
           * This is only a fallback until enough real
           * period-start history exists.
           */
          average_cycle_length:
            Number(cycleLength || 28),

          knows_cycle_history:
            knowsCycleHistory,

          cycle_history:
            cleanedCycleHistory,

          bleeding,
          cramps,
          headache,
          fatigue,
          mood_sensitivity:
            moodSensitivity,
          notes,
        }),
      })

      const data =
        (await response
          .json()
          .catch(
            () => null,
          )) as CycleSaveResponse | null

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'Cycle update failed',
        )
      }

      if (
        typeof data?.average_cycle_length ===
        'number'
      ) {
        setCycleLength(
          data.average_cycle_length,
        )
      }

      if (data?.last_period_start) {
        setPeriodStart(
          normalizeDateValue(
            data.last_period_start,
          ),
        )
      }

      setPredictionNote(
        data?.prediction_note ?? null,
      )

      setPredictionConfidence(
        data?.cycle_history_confidence ??
          null,
      )

      setValidCycleIntervals(
        data?.valid_cycle_intervals ??
          [],
      )

      setEstimatedNextPeriodStart(
        data?.estimated_next_period_start ??
          null,
      )

      setSaved(true)
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Cycle update failed',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        display: 'grid',
        gap: '28px',
      }}
    >
      <section style={styles.cartBoxStyle}>
        <h2 style={styles.sectionTitleStyle}>
          Cycle Setup
        </h2>

        <p style={styles.bodyStyle}>
          Cycle awareness helps Anastasis interpret
          your current signals, estimate phase timing,
          and adjust recovery and training support.
          Logged period-start dates are used to refine
          your personal cycle average over time.
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
            onChange={(event) => {
              setEnabled(
                event.target.checked,
              )
              setSaved(false)
            }}
            style={{
              accentColor: '#b56e43',
            }}
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
                Most recent period start date
              </label>

              <input
                type="date"
                value={periodStart}
                onChange={(event) => {
                  setPeriodStart(
                    event.target.value,
                  )
                  setSaved(false)
                }}
                style={{
                  ...styles.inputStyle,
                  WebkitAppearance: 'none',
                  appearance: 'none',
                }}
              />

              <p
                style={{
                  ...styles.bodyStyle,
                  marginTop: '8px',
                  fontSize: '0.9rem',
                }}
              >
                This should be the first day of
                your most recent period.
              </p>
            </div>

            <div style={styles.fieldWrap}>
              <label style={styles.labelStyle}>
                Typical cycle length, if known
              </label>

              <input
                type="number"
                min={18}
                max={60}
                value={cycleLength}
                onChange={(event) => {
                  setCycleLength(
                    Number(
                      event.target.value,
                    ),
                  )
                  setSaved(false)
                }}
                style={styles.inputStyle}
              />

              <p
                style={{
                  ...styles.bodyStyle,
                  marginTop: '8px',
                  fontSize: '0.9rem',
                }}
              >
                This is used only as a fallback until
                enough period starts have been logged
                to calculate your personal average.
              </p>
            </div>

            <div
              style={{
                borderTop:
                  '1px solid rgba(181,110,67,0.14)',
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
                Add any previous period-start dates you
                know. Anastasis calculates the number
                of days between each valid start date
                automatically and uses all valid logged
                intervals to build your average.
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
                  onChange={(event) => {
                    setKnowsCycleHistory(
                      event.target.checked,
                    )
                    setSaved(false)
                  }}
                  style={{
                    marginTop: '7px',
                    accentColor: '#b56e43',
                  }}
                />

                <span>
                  I know previous period-start dates.
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
                  {cycleHistory.map(
                    (cycle, index) => (
                      <div
                        key={index}
                        style={{
                          borderRadius: '22px',
                          padding: '18px',
                          background:
                            'rgba(255,255,255,0.018)',
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
                          Period {index + 1}
                        </p>

                        <div style={styles.gridTwoCol}>
                          <div style={styles.fieldWrap}>
                            <label
                              style={
                                styles.labelStyle
                              }
                            >
                              Period start date
                            </label>

                            <input
                              type="date"
                              value={
                                cycle.period_start_date
                              }
                              onChange={(
                                event,
                              ) =>
                                updateCycleHistory(
                                  index,
                                  'period_start_date',
                                  event.target.value,
                                )
                              }
                              style={{
                                ...styles.inputStyle,
                                WebkitAppearance:
                                  'none',
                                appearance: 'none',
                              }}
                            />
                          </div>

                          <div style={styles.fieldWrap}>
                            <label
                              style={
                                styles.labelStyle
                              }
                            >
                              Bleeding lasted how many
                              days?
                            </label>

                            <input
                              type="number"
                              min={1}
                              max={14}
                              value={
                                cycle.bleeding_length
                              }
                              onChange={(
                                event,
                              ) =>
                                updateCycleHistory(
                                  index,
                                  'bleeding_length',
                                  event.target.value,
                                )
                              }
                              style={
                                styles.inputStyle
                              }
                              placeholder="Optional"
                            />
                          </div>
                        </div>
                      </div>
                    ),
                  )}

                  <p style={styles.bodyStyle}>
                    {completedHistoryCount === 0
                      ? 'No historical period starts entered yet.'
                      : `${completedHistoryCount} historical period start${
                          completedHistoryCount === 1
                            ? ''
                            : 's'
                        } ready to save.`}
                  </p>
                </div>
              ) : null}
            </div>

            <div
              style={{
                borderTop:
                  '1px solid rgba(181,110,67,0.14)',
                paddingTop: '22px',
                marginTop: '4px',
              }}
            >
              <p style={styles.eyebrowStyle}>
                Current calculated average
              </p>

              <h3
                style={{
                  margin: '8px 0 10px',
                  fontSize: '1.6rem',
                  fontWeight: 500,
                  color: '#f5f0e8',
                }}
              >
                {cycleLength} days
              </h3>

              {predictionConfidence ? (
                <p style={styles.bodyStyle}>
                  Confidence:{' '}
                  <strong>
                    {predictionConfidence}
                  </strong>
                </p>
              ) : null}

              {validCycleIntervals.length > 0 ? (
                <p style={styles.bodyStyle}>
                  Valid logged intervals:{' '}
                  {validCycleIntervals.join(', ')} days
                </p>
              ) : null}

              {predictionNote ? (
                <p style={styles.bodyStyle}>
                  {predictionNote}
                </p>
              ) : null}

              {estimatedNextPeriodStart ? (
                <p style={styles.bodyStyle}>
                  Estimated next period start:{' '}
                  <strong>
                    {new Date(
                      `${estimatedNextPeriodStart}T12:00:00`,
                    ).toLocaleDateString(
                      'en-US',
                      {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      },
                    )}
                  </strong>
                </p>
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
          These inputs help the system prioritize
          your actual signals over an estimated
          phase.
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
            onChange={
              setMoodSensitivity
            }
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
            onChange={(event) => {
              setNotes(event.target.value)
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
          {saving
            ? 'Saving...'
            : saved
              ? 'Cycle Saved'
              : 'Save Cycle Note'}
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
        onChange={(event) =>
          onChange(
            event.target.checked,
          )
        }
        style={{
          accentColor: '#b56e43',
        }}
      />

      {label}
    </label>
  )
}
