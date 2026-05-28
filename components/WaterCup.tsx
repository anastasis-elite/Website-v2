'use client'

type Props = {
  percentFull: number
  ouncesRemaining?: number
}

export default function WaterCup({ percentFull, ouncesRemaining }: Props) {
  const fill = Math.max(0, Math.min(100, percentFull))

  return (
    <div
      title={`${fill}% water complete`}
      style={{
        width: '42px',
        display: 'grid',
        justifyItems: 'center',
        gap: '4px',
        color: '#f5f0e8',
        fontSize: '0.68rem',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '28px',
          height: '42px',
          border: '1px solid rgba(181,110,67,0.42)',
          borderRadius: '6px 6px 12px 12px',
          overflow: 'hidden',
          background: 'rgba(255,255,255,0.035)',
          boxShadow: 'inset 0 0 18px rgba(255,255,255,0.04)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            bottom: 0,
            width: '100%',
            height: `${fill}%`,
            background:
              'linear-gradient(180deg, rgba(133,190,255,0.8), rgba(69,126,190,0.85))',
            transition: 'height 600ms ease',
          }}
        />
      </div>

      <span>{ouncesRemaining ?? 0}oz</span>
    </div>
  )
}
