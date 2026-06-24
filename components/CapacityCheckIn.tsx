// components/CapacityCheckIn.tsx
'use client'

import { useState } from 'react'

type CapacityLevel = 'energized' | 'steady' | 'tired' | 'depleted'

type CapacityCheckInProps = {
  program?: 'ember' | 'ignite' | 'phoenix'
}

const capacityOptions: {
  value: CapacityLevel
  label: string
  description: string
}[] = [
  {
    value: 'energized',
    label: 'Energized',
    description: 'I feel ready and capable today.',
  },
  {
    value: 'steady',
    label: 'Steady',
    description: 'I can follow the plan as written.',
  },
  {
    value: 'tired',
    label: 'Tired',
    description: 'I need a lighter version today.',
  },
  {
    value: 'depleted',
    label: 'Depleted',
    description: 'I need recovery and support today.',
  },
]

export default function CapacityCheckIn({
  program = 'ember',
}: CapacityCheckInProps) {
  const [selected, setSelected] = useState<CapacityLevel | null>(null)

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
        Capacity Check-In
      </p>

      <h2
        style={{
          margin: '0 0 10px',
          fontSize: '1.45rem',
          lineHeight: 1.2,
        }}
      >
        How much do you have available today?
      </h2>

      <p
        style={{
          margin: '0 0 20px',
          opacity: 0.72,
          lineHeight: 1.5,
        }}
      >
        This helps Anastasis adjust the level of support you receive today.
      </p>

      <div
        style={{
          display: 'grid',
          gap: '12px',
        }}
      >
        {capacityOptions.map((option) => {
          const isSelected = selected === option.value

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setSelected(option.value)}
              style={{
                width: '100%',
                textAlign: 'left',
                borderRadius: '18px',
                padding: '16px',
                border: isSelected
                  ? '1px solid rgba(255,255,255,0.55)'
                  : '1px solid rgba(255,255,255,0.12)',
                background: isSelected
                  ? 'rgba(255,255,255,0.14)'
                  : 'rgba(255,255,255,0.05)',
                color: 'inherit',
                cursor: 'pointer',
              }}
            >
              <strong
                style={{
                  display: 'block',
                  marginBottom: '4px',
                  fontSize: '1rem',
                }}
              >
                {option.label}
              </strong>

              <span
                style={{
                  display: 'block',
                  opacity: 0.68,
                  fontSize: '0.92rem',
                  lineHeight: 1.4,
                }}
              >
                {option.description}
              </span>
            </button>
          )
        })}
      </div>

      {selected && (
        <div
          style={{
            marginTop: '18px',
            padding: '14px 16px',
            borderRadius: '16px',
            background: 'rgba(255,255,255,0.06)',
            fontSize: '0.95rem',
            lineHeight: 1.5,
            opacity: 0.85,
          }}
        >
          {program === 'ember' &&
            'Ember will keep today simple and focused on your core habits.'}

          {program === 'ignite' &&
            'Ignite will use this to guide today’s training, nutrition, and recovery focus.'}

          {program === 'phoenix' &&
            'Phoenix will use this as part of your deeper daily adaptation.'}
        </div>
      )}
    </section>
  )
}
