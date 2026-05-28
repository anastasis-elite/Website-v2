'use client'

import { useState } from 'react'

type Props = {
  cycleDay?: number | null
  typicalCycleLength?: number | null
  phase?: string | null
}

export default function CycleProgressOrb({
  cycleDay,
  typicalCycleLength,
  phase,
}: Props) {
  const [hovered, setHovered] = useState(false)

  const day = Math.max(0, Number(cycleDay || 0))
  const length = Math.max(1, Number(typicalCycleLength || 30))

  const completedLoops = Math.floor(day / length)
  const dayInCurrentLoop = day % length || length
  const loopPercent = day / length >= 1 ? dayInCurrentLoop / length : day / length
  const degrees = Math.round(loopPercent * 360)

  const isOverExpected = day > length
  const isThreeLoopsLate = completedLoops >= 3

  const fillColor =
    completedLoops >= 3
      ? 'rgba(70,28,34,0.95)'
      : completedLoops === 2
        ? 'rgba(95,42,42,0.92)'
        : completedLoops === 1
          ? 'rgba(120,72,44,0.9)'
          : 'rgba(181,110,67,0.82)'

  const background = `conic-gradient(${fillColor} ${degrees}deg, rgba(255,255,255,0.055) ${degrees}deg)`

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        title={`Cycle day ${day || '—'}${phase ? ` · ${phase}` : ''}`}
        style={{
          width: '46px',
          height: '46px',
          borderRadius: '999px',
          border: isOverExpected
            ? '1px solid rgba(190,90,80,0.5)'
            : '1px solid rgba(181,110,67,0.38)',
          background,
          padding: '3px',
          cursor: 'pointer',
          boxShadow:
            '0 0 24px rgba(181,110,67,0.12), inset 0 0 18px rgba(255,255,255,0.035)',
        }}
      >
        <span
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '999px',
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(5,5,5,0.72)',
            color: '#f5f0e8',
            fontSize: '0.72rem',
            lineHeight: 1,
            textAlign: 'center',
          }}
        >
          {day || '—'}
        </span>
      </button>

      {hovered && isThreeLoopsLate && (
        <div
          style={{
            position: 'absolute',
            left: '56px',
            top: '-8px',
            width: '240px',
            padding: '14px 16px',
            borderRadius: '18px',
            background: 'rgba(12,12,12,0.92)',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
            color: '#f5f0e8',
            boxShadow: '0 18px 60px rgba(0,0,0,0.42)',
            zIndex: 120,
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: '0.84rem',
              lineHeight: 1.55,
              color: '#d7c7b6',
            }}
          >
            Your cycle appears significantly delayed. Consider taking a
            pregnancy test or checking in with a qualified health professional.
          </p>
        </div>
      )}
    </div>
  )
}
