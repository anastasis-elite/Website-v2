'use client'

import { useEffect, useState } from 'react'
import Button from './Button'
import * as styles from '@/app/styles/globalstyles'

export default function DashboardAssessmentCard({
  clientId,
  program,
  monthlyAssessmentComplete,
  dailyStructureSet,
  dailyStructureReviewedThisMonth,
  dailyStructureLabel,
  previousReviewedAt,
}: {
  clientId: string
  program: string
  monthlyAssessmentComplete: boolean
  dailyStructureSet: boolean
  dailyStructureReviewedThisMonth: boolean
  dailyStructureLabel: string
  previousReviewedAt?: string | null
}) {
  const [structureReviewed, setStructureReviewed] = useState(
    dailyStructureReviewedThisMonth
  )
  const [undoVisible, setUndoVisible] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!undoVisible) return

    const timer = setTimeout(() => {
      setUndoVisible(false)
    }, 3 * 60 * 1000)

    return () => clearTimeout(timer)
  }, [undoVisible])

  async function markNoChange() {
    try {
      setSaving(true)

      const res = await fetch('/api/daily-structure/no-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          action: 'confirm',
          previous_reviewed_at: previousReviewedAt || null,
        }),
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(data?.error || 'Could not update daily structure')
      }

      setStructureReviewed(true)
      setUndoVisible(true)
    } finally {
      setSaving(false)
    }
  }

  async function undoNoChange() {
    try {
      setSaving(true)

      const res = await fetch('/api/daily-structure/no-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          action: 'undo',
          previous_reviewed_at: previousReviewedAt || null,
        }),
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(data?.error || 'Could not undo daily structure update')
      }

      setStructureReviewed(false)
      setUndoVisible(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section
      style={{
        ...styles.cartBoxStyle,
        marginBottom: '36px',
      }}
    >
      <p style={styles.eyebrowStyle}>Assessments</p>

      <h2 style={styles.sectionTitleStyle}>
        Keep your system aligned.
      </h2>

      <div
        style={{
          display: 'grid',
          gap: '22px',
          marginTop: '22px',
        }}
      >
        <div>
          <p style={styles.bodyStyle}>
            <strong>Monthly Assessment:</strong>{' '}
            {monthlyAssessmentComplete ? 'Complete' : 'Due'}
          </p>

          {monthlyAssessmentComplete ? (
            <p style={{ ...styles.bodyStyle, opacity: 0.72 }}>
              Your monthly assessment is complete.
            </p>
          ) : (
            <Button href={`/dashboard/assessment/start?program=${program}`}>
              Start Monthly Assessment
            </Button>
          )}
        </div>

        <div>
          <p style={styles.bodyStyle}>
            <strong>Daily Structure:</strong>{' '}
            {dailyStructureSet
              ? structureReviewed
                ? `${dailyStructureLabel} · reviewed`
                : `${dailyStructureLabel} · review due`
              : 'Not set'}
          </p>

          {!dailyStructureSet ? (
            <>
              <p style={{ ...styles.bodyStyle, opacity: 0.72 }}>
                Set how your day should flow so the system can support your
                real life.
              </p>

              <Button href="/dashboard/assessment/daily-structure">
                Set Daily Structure
              </Button>
            </>
          ) : structureReviewed ? (
            <>
              <p style={{ ...styles.bodyStyle, opacity: 0.72 }}>
                Your daily rhythm is confirmed for this month.
              </p>

              {undoVisible ? (
                <button
                  type="button"
                  onClick={undoNoChange}
                  disabled={saving}
                  style={{
                    ...styles.secondaryButtonStyle,
                    cursor: 'pointer',
                  }}
                >
                  Undo
                </button>
              ) : null}
            </>
          ) : (
            <div
              style={{
                display: 'flex',
                gap: '16px',
                flexWrap: 'wrap',
                alignItems: 'center',
              }}
            >
              <Button href="/dashboard/assessment/daily-structure">
                Review Daily Structure
              </Button>

              <label
                style={{
                  ...styles.bodyStyle,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  cursor: 'pointer',
                  margin: 0,
                }}
              >
                <input
                  type="checkbox"
                  disabled={saving}
                  onChange={(e) => {
                    if (e.target.checked) markNoChange()
                  }}
                  style={{ accentColor: '#b56e43' }}
                />
                Nothing changed
              </label>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
