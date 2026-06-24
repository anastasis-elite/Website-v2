// components/FlameEvidence.tsx

type Program = 'ember' | 'ignite' | 'phoenix'

type FlameEvidenceProps = {
  program?: Program
  percentage?: number
}

function getFlameState(percentage: number) {
  if (percentage >= 75) {
    return {
      label: 'Strong flame',
      message: 'Your recent consistency is becoming visible evidence.',
      symbol: '🔥',
    }
  }

  if (percentage >= 50) {
    return {
      label: 'Building flame',
      message: 'You are showing up often enough for momentum to build.',
      symbol: '🔥',
    }
  }

  if (percentage >= 25) {
    return {
      label: 'Flickering flame',
      message: 'The evidence is still forming. One next step matters.',
      symbol: '🕯️',
    }
  }

  return {
    label: 'Low flame',
    message: 'This is not failure. It is information. Start with one step today.',
    symbol: '▫️',
  }
}

export default function FlameEvidence({
  program = 'ember',
  percentage = 0,
}: FlameEvidenceProps) {
  const safePercentage = Math.max(0, Math.min(100, percentage))
  const flame = getFlameState(safePercentage)

  return (
    <section
      style={{
        width: '100%',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '24px',
        padding: '24px',
        background:
          'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))',
      }}
    >
      <p
        style={{
          margin: '0 0 8px',
          fontSize: '0.78rem',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          opacity: 0.65,
        }}
      >
        Flame Evidence
      </p>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '18px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h2
            style={{
              margin: '0 0 8px',
              fontSize: '1.45rem',
              lineHeight: 1.2,
            }}
          >
            {flame.label}
          </h2>

          <p
            style={{
              margin: 0,
              opacity: 0.72,
              lineHeight: 1.5,
            }}
          >
            {flame.message}
          </p>
        </div>

        <div
          style={{
            width: '92px',
            height: '92px',
            borderRadius: '999px',
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.12)',
            fontSize: '2.4rem',
          }}
        >
          {flame.symbol}
        </div>
      </div>

      <div
        style={{
          marginTop: '22px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '12px',
            marginBottom: '8px',
            fontSize: '0.86rem',
            opacity: 0.72,
          }}
        >
          <span>Recent completion</span>
          <span>{safePercentage}%</span>
        </div>

        <div
          style={{
            width: '100%',
            height: '10px',
            borderRadius: '999px',
            background: 'rgba(255,255,255,0.08)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${safePercentage}%`,
              height: '100%',
              borderRadius: '999px',
              background: 'rgba(255,255,255,0.65)',
            }}
          />
        </div>
      </div>

      <p
        style={{
          margin: '16px 0 0',
          fontSize: '0.9rem',
          lineHeight: 1.45,
          opacity: 0.62,
        }}
      >
        {program === 'ember' &&
          'Ember uses your flame as evidence of rhythm, not perfection.'}

        {program === 'ignite' &&
          'Ignite uses your flame to help connect consistency with training, nutrition, and recovery.'}

        {program === 'phoenix' &&
          'Phoenix uses your flame as one signal inside your deeper adaptive system.'}
      </p>
    </section>
  )
}
