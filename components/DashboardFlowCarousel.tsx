'use client'

import { useEffect, useRef } from 'react'
import Button from './Button'
import Link from 'next/link'
import WorkoutTracker from './WorkoutTracker'
import DailyInsightCard from './DailyInsightCard'
import * as styles from '@/app/styles/globalstyles'

type FlowCard = {
  id: string
  title: string
  timing: string
  status: 'current' | 'upcoming' | 'complete' | 'late' | 'flex'
  body: string
  macroTarget?: {
    protein?: number
    carbs?: number
    fats?: number
    water?: number
  }
  items?: string[]
  buttonHref?: string
  buttonLabel?: string
}

function statusLabel(status: FlowCard['status']) {
  if (status === 'current') return 'Now'
  if (status === 'late') return 'Redirect'
  if (status === 'complete') return 'Complete'
  if (status === 'flex') return 'Flexible'
  return 'Upcoming'
}

export default function DashboardFlowCarousel({
  cards,
  currentCardId,
  program,
  client,
  insight,
  todaysWorkout,
  adjustedExercises = [],
  output,
  cycleAdjustment,
}: {
  cards: FlowCard[]
  currentCardId?: string
  program?: 'ember' | 'ignite' | 'phoenix'
  client?: any
  insight?: any
  todaysWorkout?: any
  adjustedExercises?: any[]
  output?: any
  cycleAdjustment?: { label: string; note: string }
}) {
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    if (!currentCardId) return

    const currentCard = cardRefs.current[currentCardId]

    if (currentCard) {
      currentCard.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      })
    }
  }, [currentCardId])

  if (!cards.length) return null

  return (
    <section>
      <div
        style={{
          marginBottom: '22px',
        }}
      >
        <p
          style={{
            ...styles.eyebrowStyle,
            marginBottom: '14px',
          }}
        >
          Today’s Flow
        </p>

        <h2
          style={{
            ...styles.sectionTitleStyle,
            fontSize: '1.9rem',
            marginBottom: '8px',
          }}
        >
          Your day, simplified.
        </h2>

        <p
          style={{
            ...styles.bodyStyle,
            maxWidth: '720px',
            margin: 0,
            opacity: 0.82,
          }}
        >
          The system places the current focus first so you do not have to hold the
          whole day in your head at once.
        </p>
      </div>

      <div
        style={{
          display: 'flex',
          gap: '22px',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          padding: '8px 4px 28px',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {cards.map((card) => (
          <div
            key={card.id}
            ref={(element) => {
              cardRefs.current[card.id] = element
            }}
            style={{
              flex: '0 0 min(86vw, 620px)',
              scrollSnapAlign: 'center',
              background:
                card.status === 'current'
                  ? 'rgba(18,18,18,0.68)'
                  : 'rgba(18,18,18,0.48)',
              borderRadius: '38px',
              padding: '38px',
              minHeight: '430px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow:
                card.status === 'current'
                  ? '0 26px 90px rgba(0,0,0,0.24), 0 0 44px rgba(181,110,67,0.08), inset 0 0 36px rgba(255,255,255,0.014)'
                  : '0 22px 70px rgba(0,0,0,0.18), inset 0 0 30px rgba(255,255,255,0.012)',
              backdropFilter: 'blur(18px)',
            }}
          >
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '18px',
                  alignItems: 'center',
                  marginBottom: '28px',
                }}
              >
                <p
                  style={{
                    ...styles.eyebrowStyle,
                    margin: 0,
                    letterSpacing: '3px',
                    fontSize: '10px',
                  }}
                >
                  {statusLabel(card.status)}
                </p>

                <p
                  style={{
                    margin: 0,
                    color: 'rgba(215,199,182,0.72)',
                    fontSize: '0.9rem',
                    textAlign: 'right',
                  }}
                >
                  {card.timing}
                </p>
              </div>

              <h3
                style={{
                  margin: '0 0 18px',
                  fontSize: 'clamp(2rem, 4vw, 3.1rem)',
                  lineHeight: 1.05,
                  fontWeight: 500,
                  letterSpacing: '-0.04em',
                  color: '#f5f0e8',
                }}
              >
                {card.title}
              </h3>

              <p
                style={{
                  ...styles.bodyStyle,
                  margin: 0,
                  opacity: 0.86,
                }}
              >
                {card.body}
              </p>

              {card.items?.length ? (
  <ul
    style={{
      margin: '24px 0 0',
      paddingLeft: '20px',
      color: 'rgba(215,199,182,0.82)',
      lineHeight: 1.75,
      display: 'grid',
      gap: '10px',
    }}
  >
    {card.items.map((item, index) => (
      <li key={index}>{item}</li>
    ))}
  </ul>
) : null}

              {card.macroTarget ? (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(auto-fit, minmax(100px, 1fr))',
                    gap: '12px',
                    marginTop: '30px',
                  }}
                >
                  {typeof card.macroTarget.protein === 'number' ? (
                    <MacroPill label="Protein" value={`${card.macroTarget.protein}g`} />
                  ) : null}

                  {typeof card.macroTarget.carbs === 'number' ? (
                    <MacroPill label="Carbs" value={`${card.macroTarget.carbs}g`} />
                  ) : null}

                  {typeof card.macroTarget.fats === 'number' ? (
                    <MacroPill label="Fats" value={`${card.macroTarget.fats}g`} />
                  ) : null}

                  {typeof card.macroTarget.water === 'number' ? (
                    <MacroPill label="Water" value={`${card.macroTarget.water} oz`} />
                  ) : null}
                </div>
              ) : null}

              {card.id === 'morning' && insight ? (
                <div style={{ marginTop: '28px' }}>
                  <DailyInsightCard insight={insight} />
                </div>
              ) : null}

              {card.id === 'morning' && program && client ? (
                <details id="todays-workout" style={detailsStyle}>
                  <summary style={summaryStyle}>
                    {todaysWorkout ? 'Open today’s workout' : 'View recovery day'}
                  </summary>
                  <div style={{ marginTop: '22px' }}>
                    {todaysWorkout ? (
                      <>
                        <h4 style={workoutTitleStyle}>{todaysWorkout.day_name}</h4>
                        {todaysWorkout.focus ? (
                          <p style={styles.bodyStyle}><strong>Focus:</strong> {todaysWorkout.focus}</p>
                        ) : null}
                        {cycleAdjustment ? (
                          <p style={styles.bodyStyle}><strong>{cycleAdjustment.label}:</strong> {cycleAdjustment.note}</p>
                        ) : null}
                        {adjustedExercises.length ? (
                          <WorkoutTracker
                            clientId={client.client_id}
                            authUserId={client.auth_user_id}
                            program={output?.program || program}
                            dayName={todaysWorkout.day_name}
                            exercises={adjustedExercises}
                          />
                        ) : <p style={styles.bodyStyle}>No exercises are assigned today.</p>}
                      </>
                    ) : (
                      <p style={styles.bodyStyle}>Today is a recovery day. Nourish, hydrate, move gently, and let adaptation do its work.</p>
                    )}
                  </div>
                </details>
              ) : null}

              {program ? <CardActions cardId={card.id} program={program} /> : null}
            </div>

            {card.buttonHref && card.buttonLabel ? (
              <div
                style={{
                  marginTop: '34px',
                }}
              >
                <Button href={card.buttonHref}>
                  {card.buttonLabel}
                </Button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  )
}

function CardActions({ cardId, program }: { cardId: string; program: string }) {
  const actions = cardId === 'morning'
    ? [{ href: '#todays-workout', label: 'Workout' }, { href: '/dashboard/cycle', label: 'Cycle' }]
    : cardId === 'midday'
      ? [{ href: '/dashboard/nutrition', label: 'Log Food' }, { href: '/dashboard/recovery', label: 'Movement' }]
      : [{ href: '/dashboard/recovery', label: 'Recovery' }, { href: '/dashboard/symptoms', label: 'Body Signals' }, { href: '/dashboard/assessment/start', label: 'Check-In' }]

  return (
    <div style={{ ...styles.buttonRowStyle, marginTop: '26px' }}>
      {actions.map((action) => (
        <Link key={action.label} href={action.href} style={styles.secondaryButtonStyle}>
          {action.label}
        </Link>
      ))}
    </div>
  )
}

const detailsStyle = {
  marginTop: '28px', padding: '20px', borderRadius: '24px',
  background: 'rgba(181,110,67,0.07)', border: '1px solid rgba(181,110,67,0.2)',
} as const

const summaryStyle = { color: '#f5f0e8', cursor: 'pointer', fontWeight: 600 } as const
const workoutTitleStyle = { color: '#f5f0e8', fontSize: '1.4rem', margin: '0 0 12px' } as const

function MacroPill({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.04)',
        borderRadius: '18px',
        padding: '14px 16px',
      }}
    >
      <p
        style={{
          margin: '0 0 4px',
          color: 'rgba(215,199,182,0.68)',
          fontSize: '0.78rem',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </p>

      <p
        style={{
          margin: 0,
          color: '#f5f0e8',
          fontSize: '1.08rem',
        }}
      >
        {value}
      </p>
    </div>
  )
}
