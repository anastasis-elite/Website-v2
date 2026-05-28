'use client'

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
  const day = Number(cycleDay || 0)
  const length = Number(typicalCycleLength || 30)

  const rawPercent = length ? day / length : 0
  const percent = Math.min(rawPercent, 1)
  const degrees = Math.round(percent * 360)

  const isOverdue = day > length
  const isVeryLate = day >= length * 3

  const fillColor = isVeryLate
    ? 'rgba(95,42,42,0.92)'
    : isOverdue
      ? 'rgba(120,72,44,0.9)'
      : 'rgba(181,110,67,0.82)'

  const background = `conic-gradient(${fillColor} ${degrees}deg, rgba(255,255,255,0.055) ${degrees}deg)`

  return (
    <button
      type="button"
      title={
        isVeryLate
          ? 'Cycle significantly delayed'
          : `Cycle day ${day || '—'}`
      }
      style={{
        width: '46px',
        height: '46px',
        borderRadius: '999px',
        border: '1px solid rgba(181,110,67,0.38)',
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
  )
}
