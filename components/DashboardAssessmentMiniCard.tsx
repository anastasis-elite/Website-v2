'use client'

import { useEffect, useState } from 'react'
import Button from './Button'
import * as styles from '@/app/styles/globalstyles'

export default function DashboardAssessmentMiniCard({
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

  const monthlyStatus = monthlyAssessmentComplete ? 'Complete' : 'Due'

  const structureStatus = !dailyStructureSet
    ? 'Not set'
    : structureReviewed
    ? `${dailyStructureLabel} · reviewed`
    : `${dailyStructureLabel} · review due`

  return (
    <section
      style={{
        background: 'rgba(255,255,255,0.035)',
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
        Assessments
      </p>

      <div style={{ display: 'grid', gap: '16px' }}>
        <div>
          <h3
            style={{
              margin: '0 0 6px',
              fontSize: '1.12rem',
              fontWeight: 500,
              letterSpacing: '-0.02em',
              color: '#f5f0e8',
            }}
          >
            Monthly: {monthlyStatus}
          </h3>

          {!monthlyAssessmentComplete ? (
            <Button href={`/dashboard/assessment/start?program=${program}`}>
              Start
            </Button>
          ) : (
            <p
              style={{
                margin: 0,
                color: 'rgba(215,199,182,0.72)',
                fontSize: '0.9rem',
                lineHeight: 1.5,
              }}
            >
              Complete for this month.
            </p>
          )}
        </div>

        <div>
          <h3
            style={{
              margin: '0 0 6px',
              fontSize: '1.12rem',
              fontWeight: 500,
              letterSpacing: '-0.02em',
              color: '#f5f0e8',
            }}
          >
            Structure: {structureStatus}
          </h3>

          {!dailyStructureSet ? (
            <Button href="/dashboard/assessment/daily-structure">
              Set Rhythm
            </Button>
          ) : structureReviewed ? (
            undoVisible ? (
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
            ) : (
              <p
                style={{
                  margin: 0,
                  color: 'rgba(215,199,182,0.72)',
                  fontSize: '0.9rem',
                  lineHeight: 1.5,
                }}
              >
                Rhythm confirmed.
              </p>
            )
          ) : (
            <div
              style={{
                display: 'grid',
                gap: '10px',
              }}
            >
              <Button href="/dashboard/assessment/daily-structure">
                Review
              </Button>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  color: 'rgba(215,199,182,0.82)',
                  fontSize: '0.9rem',
                  lineHeight: 1.5,
                  cursor: 'pointer',
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
