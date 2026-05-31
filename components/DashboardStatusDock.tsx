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
  cycleStatus,
  dailyPlan,
  assessmentDueCount = 0,
}: Props) {
  const [open, setOpen] = useState(false)
  const [assessmentOpen, setAssessmentOpen] = useState(false)

  const dailyRemaining = dailyPlan?.dailyRemaining || {}

const proteinRemaining = dailyRemaining.protein || 0
const carbsRemaining = dailyRemaining.carbs || 0
const fatsRemaining = dailyRemaining.fats || 0
const waterRemaining = dailyRemaining.water || 0

  return (
    <div
      style={{
        position: 'fixed',
        left: '18px',
        top: '34vh',
        zIndex: 80,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '10px',
          padding: '10px 12px',
          borderRadius: '999px',
          background:
            'linear-gradient(145deg, rgba(12,12,12,0.72), rgba(5,5,5,0.48))',
          backdropFilter: 'blur(22px)',
          WebkitBackdropFilter: 'blur(22px)',
          boxShadow:
            '0 22px 70px rgba(0,0,0,0.32), inset 0 0 28px rgba(255,255,255,0.025)',
        }}
      >
       <div onClick={() => setOpen(!open)}>
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
        
        <WaterCup
  percentFull={Math.round(
    ((dailyPlan.dailyTargets.water - waterRemaining) /
      dailyPlan.dailyTargets.water) *
      100
  )}
  ouncesRemaining={waterRemaining}
/>

        <Link href="/dashboard/nutrition" style={actionCircleStyle}>
          +
        </Link>

        <button
          type="button"
          onClick={() => setAssessmentOpen(!assessmentOpen)}
          style={actionCircleStyle}
        >
          *
        </button>
      </div>

      {open && (
        <div
          style={{
            position: 'absolute',
            left: '58px',
            top: '0',
            width: 'min(92vw, 420px)',
            padding: '24px',
            borderRadius: '28px',
            background:
              'linear-gradient(145deg, rgba(12,12,12,0.88), rgba(5,5,5,0.72))',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            boxShadow:
              '0 28px 90px rgba(0,0,0,0.42), inset 0 0 34px rgba(255,255,255,0.02)',
          }}
        >
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
    Your cycle appears significantly delayed. Consider whether pregnancy
    testing or professional guidance may be appropriate.
  </p>
)}

          <p style={bodyStyle}>
            Remaining: {proteinRemaining}g protein ·{' '}
            {carbsRemaining}g carbs · {fatsRemaining}g fats ·{' '}
            {waterRemaining}oz water
          </p>

          <div
            style={{
              display: 'flex',
              gap: '10px',
              flexWrap: 'wrap',
              marginTop: '18px',
            }}
          >
            <Link href="/dashboard/nutrition" style={buttonStyle}>
              Add Meal
            </Link>

            <Link href="/dashboard/cycle" style={buttonStyle}>
              Cycle
            </Link>
          </div>
        </div>
      )}

      {assessmentOpen && (
        <div
          style={{
            position: 'absolute',
            left: '74px',
            top: '120px',
            width: 'min(92vw, 420px)',
            zIndex: 90,
          }}
        >
          <DashboardAssessmentMiniCard
            dueCount={assessmentDueCount}
          />
        </div>
      )}
    </div>
  )
}

const circleStyle = {
  width: '42px',
  height: '42px',
  borderRadius: '999px',
  border: '1px solid rgba(181,110,67,0.32)',
  background: 'rgba(181,110,67,0.12)',
  color: '#f5f0e8',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: '0.9rem',
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
}

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
}
