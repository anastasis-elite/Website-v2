'use client'

import Link from 'next/link'
import { useState } from 'react'
import DashboardAssessmentMiniCard from '@/components/DashboardAssessmentMiniCard'
import WaterCup from '@/components/WaterCup'
import CycleProgressOrb from '@/components/CycleProgressOrb'

type Props = {
  client: any
  cycleStatus: any
  dailyPlan: any
  assessmentDueCount?: number
}

export default function DashboardStatusDock({
  client,
  cycleStatus,
  dailyPlan,
  assessmentDueCount = 0,
}: Props) {
  const [cycleOpen, setCycleOpen] = useState(false)
  const [mealOpen, setMealOpen] = useState(false)
  const [waterOpen, setWaterOpen] = useState(false)
  const [assessmentOpen, setAssessmentOpen] = useState(false)

  const [mealSuggestions, setMealSuggestions] = useState<any[]>([])
  const [mealLoading, setMealLoading] = useState(false)

  const dailyRemaining = dailyPlan?.dailyRemaining || {}
  const dailyTargets = dailyPlan?.dailyTargets || {}

  const proteinRemaining = dailyRemaining.protein || 0
  const carbsRemaining = dailyRemaining.carbs || 0
  const fatsRemaining = dailyRemaining.fats || 0
  const waterRemaining = dailyRemaining.water || 0
  const waterTarget = dailyTargets.water || 1

  const [localWaterRemaining, setLocalWaterRemaining] =
    useState<number>(waterRemaining)

  const waterPercent = Math.round(
    ((waterTarget - localWaterRemaining) / waterTarget) * 100
  )

  async function loadMealSuggestions() {
    try {
      setMealLoading(true)

      const res = await fetch('/api/nutrition/quick-add-suggestions')
      const data = await res.json()

      if (!res.ok) {
        console.error('Meal suggestions failed:', data)
        return
      }

      setMealSuggestions(data.suggestions || [])
    } catch (error) {
      console.error('Meal suggestions error:', error)
    } finally {
      setMealLoading(false)
    }
  }

  return (
    <div className="dashboard-status-dock">
      <div className="dashboard-status-dock-inner">
        <div
          onClick={() => {
            setCycleOpen(!cycleOpen)
            setMealOpen(false)
            setWaterOpen(false)
            setAssessmentOpen(false)
          }}
          style={{ cursor: 'pointer' }}
        >
          <CycleProgressOrb
            cycleDay={cycleStatus?.cycleDay}
            typicalCycleLength={cycleStatus?.typicalCycleLength || 30}
            phase={cycleStatus?.phase}
          />
        </div>

        <div style={miniTextStyle}>
          <strong>{proteinRemaining}g</strong>
          <span>protein</span>
        </div>

        <div style={miniTextStyle}>
          <strong>{carbsRemaining}g</strong>
          <span>carbs</span>
        </div>

        <div style={miniTextStyle}>
          <strong>{fatsRemaining}g</strong>
          <span>fats</span>
        </div>

        <div
          onClick={() => {
            setWaterOpen(!waterOpen)
            setCycleOpen(false)
            setMealOpen(false)
            setAssessmentOpen(false)
          }}
          style={{ cursor: 'pointer' }}
        >
          <WaterCup
            percentFull={waterPercent}
            ouncesRemaining={localWaterRemaining}
          />
        </div>

        <button
          type="button"
          onClick={async () => {
            const next = !mealOpen

            setMealOpen(next)
            setCycleOpen(false)
            setWaterOpen(false)
            setAssessmentOpen(false)

            if (next) {
              await loadMealSuggestions()
            }
          }}
          style={actionCircleStyle}
        >
          +
        </button>

        <button
          type="button"
          onClick={() => {
            setAssessmentOpen(!assessmentOpen)
            setCycleOpen(false)
            setMealOpen(false)
            setWaterOpen(false)
          }}
          style={actionCircleStyle}
        >
          *
        </button>
      </div>

      {cycleOpen && (
        <div style={cyclePopupStyle}>
          <p style={bodyStyle}>
            Cycle Day: {cycleStatus?.cycleDay || '—'} · Phase:{' '}
            {cycleStatus?.phase || 'unknown'}
          </p>

          {cycleStatus?.cycleDay >=
            (cycleStatus?.typicalCycleLength || 30) * 3 && (
            <p
              style={{
                ...bodyStyle,
                color: '#d89b9b',
                marginTop: '10px',
              }}
            >
              Your cycle appears significantly delayed. Consider whether
              pregnancy testing or professional guidance may be appropriate.
            </p>
          )}

          <div style={popupButtonRowStyle}>
            <Link href="/dashboard/cycle" style={buttonStyle}>
              Open Cycle
            </Link>
          </div>
        </div>
      )}

      {waterOpen && (
        <div data-water-popup="true" style={waterPopupStyle}>
          <p style={bodyStyle}>Quick Add Water</p>

          <div style={waterGridStyle}>
            {[8, 12, 16, 24].map((oz) => (
              <button
                key={oz}
                type="button"
                style={buttonStyle}
                onClick={async () => {
                  const res = await fetch('/api/nutrition/add-water', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      clientId: client?.client_id,
                      ounces: oz,
                    }),
                  })

                  if (!res.ok) {
                    console.error('Water add failed:', await res.json())
                    return
                  }

                  setLocalWaterRemaining((prev: number) =>
                    Math.max(0, prev - oz)
                  )
                  setWaterOpen(false)
                }}
              >
                +{oz} oz
              </button>
            ))}
          </div>
        </div>
      )}

      {mealOpen && (
        <div style={mealPopupStyle}>
          <p style={bodyStyle}>
            Remaining: {proteinRemaining}g protein · {carbsRemaining}g carbs ·{' '}
            {fatsRemaining}g fats
          </p>

          <div style={mealButtonGridStyle}>
            {mealLoading ? (
              <p style={bodyStyle}>Loading suggestions...</p>
            ) : mealSuggestions.length > 0 ? (
              mealSuggestions.map((meal, index) => (
                <button
                  key={`${meal.foodName}-${meal.servingLabel}-${index}`}
                  type="button"
                  style={buttonStyle}
                  onClick={() => {
                    console.log('Quick add meal selected:', meal)
                  }}
                >
                  {meal.foodName}
                  <br />
                  <span
                    style={{
                      opacity: 0.72,
                      fontSize: '0.78rem',
                    }}
                  >
                    {meal.servingLabel}
                  </span>
                </button>
              ))
            ) : (
              <p style={bodyStyle}>
                No repeat meals found yet.
              </p>
            )}

            <Link href="/dashboard/nutrition" style={buttonStyle}>
              Open Nutrition Log
            </Link>
          </div>
        </div>
      )}

      {assessmentOpen && (
        <div style={assessmentPopupStyle}>
          <DashboardAssessmentMiniCard dueCount={assessmentDueCount} />
        </div>
      )}
    </div>
  )
}

const actionCircleStyle = {
  width: '38px',
  height: '38px',
  borderRadius: '999px',
  border: '1px solid rgba(181,110,67,0.32)',
  background: 'rgba(181,110,67,0.08)',
  color: '#f5f0e8',
  display: 'grid',
  placeItems: 'center',
  textDecoration: 'none',
  fontSize: '1.05rem',
  cursor: 'pointer',
  fontFamily: 'inherit',
} as const

const miniTextStyle = {
  display: 'grid',
  justifyItems: 'center',
  alignItems: 'center',
  textAlign: 'center',
  gap: '1px',
  minWidth: '52px',
  color: '#f5f0e8',
  fontSize: '0.76rem',
  lineHeight: 1.15,
} as const

const bodyStyle = {
  color: '#d7c7b6',
  lineHeight: 1.7,
  fontSize: '0.95rem',
  margin: 0,
} as const

const buttonStyle = {
  border: '1px solid rgba(181,110,67,0.28)',
  color: '#f5f0e8',
  padding: '10px 14px',
  textDecoration: 'none',
  borderRadius: '999px',
  fontWeight: 500,
  background: 'rgba(181,110,67,0.055)',
  fontSize: '0.86rem',
  cursor: 'pointer',
  fontFamily: 'inherit',
  textAlign: 'center',
} as const

const popupBaseStyle = {
  position: 'absolute',
  left: '58px',
  padding: '20px',
  borderRadius: '26px',
  background:
    'linear-gradient(145deg, rgba(12,12,12,0.9), rgba(5,5,5,0.74))',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  boxShadow:
    '0 28px 90px rgba(0,0,0,0.42), inset 0 0 34px rgba(255,255,255,0.02)',
  zIndex: 95,
} as const

const cyclePopupStyle = {
  ...popupBaseStyle,
  top: '0',
  width: 'min(92vw, 420px)',
} as const

const waterPopupStyle = {
  ...popupBaseStyle,
  top: '180px',
  width: '220px',
} as const

const mealPopupStyle = {
  ...popupBaseStyle,
  top: '230px',
  width: 'min(92vw, 320px)',
} as const

const assessmentPopupStyle = {
  position: 'absolute',
  left: '74px',
  top: '120px',
  width: 'min(92vw, 420px)',
  zIndex: 90,
} as const

const popupButtonRowStyle = {
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap',
  marginTop: '18px',
} as const

const waterGridStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '10px',
  marginTop: '12px',
} as const

const mealButtonGridStyle = {
  display: 'grid',
  gap: '10px',
  marginTop: '14px',
} as const
