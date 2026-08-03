'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import CycleProgressOrb from '@/components/CycleProgressOrb'
import WaterCup from '@/components/WaterCup'
import { getFlameVisualState } from '@/lib/dashboard/getFlameVisualState'

type Props = {
  client: any
  cycleStatus: any
  dailyPlan: any
  assessmentDueCount?: number
  monthlyCheckInDue?: boolean
}

function getWorkoutHref(program?: string | null): string {
  const supportedPrograms = ['ember', 'ignite', 'phoenix']

  const requestedProgram = String(
    program || 'ember',
  ).toLowerCase()

  const programTier = supportedPrograms.includes(
    requestedProgram,
  )
    ? requestedProgram
    : 'ember'

  return `/dashboard/program/${programTier}/workout`
}

export default function DashboardStatusDock(
  props: Props,
) {
  const {
    client,
    cycleStatus,
    dailyPlan,
  } = props

  const [cycleOpen, setCycleOpen] = useState(false)
  const [waterOpen, setWaterOpen] = useState(false)

  const dockRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function handleClickOutside(
      event: MouseEvent | TouchEvent,
    ) {
      if (
        dockRef.current &&
        !dockRef.current.contains(
          event.target as Node,
        )
      ) {
        setCycleOpen(false)
        setWaterOpen(false)
      }
    }

    document.addEventListener(
      'mousedown',
      handleClickOutside,
    )

    document.addEventListener(
      'touchstart',
      handleClickOutside,
    )

    return () => {
      document.removeEventListener(
        'mousedown',
        handleClickOutside,
      )

      document.removeEventListener(
        'touchstart',
        handleClickOutside,
      )
    }
  }, [])

  const dailyRemaining =
    dailyPlan?.dailyRemaining || {}

  const dailyTargets =
    dailyPlan?.dailyTargets || {}

  const flameScore = Number(
    client?.flame_score || 10,
  )

  const visualState =
    getFlameVisualState(flameScore)

  const proteinRemaining =
    dailyRemaining.protein || 0

  const carbsRemaining =
    dailyRemaining.carbs || 0

  const fatsRemaining =
    dailyRemaining.fats || 0

  const waterRemaining =
    dailyRemaining.water || 0

  const waterTarget =
    dailyTargets.water || 1

  const [
    localWaterRemaining,
    setLocalWaterRemaining,
  ] = useState<number>(
    waterRemaining,
  )

  const waterPercent = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        ((waterTarget -
          localWaterRemaining) /
          waterTarget) *
          100,
      ),
    ),
  )

  const workoutHref =
    getWorkoutHref(client?.program)

  return (
    <div
      ref={dockRef}
      className="dashboard-status-dock"
    >
      <div className="dashboard-status-dock-inner">
        <div
          style={flameStyle}
          data-flame-visual-state={
            visualState
          }
          title={`Flame state: ${visualState}`}
        >
          <span aria-hidden="true">
            🔥
          </span>

          <strong>
            {Math.round(flameScore)}%
          </strong>

          <small>
            {visualState.replaceAll(
              '_',
              ' ',
            )}
          </small>
        </div>

        <button
          type="button"
          aria-label="View cycle status"
          title="View cycle status"
          onClick={() => {
            setCycleOpen(
              (current) => !current,
            )

            setWaterOpen(false)
          }}
          style={orbButtonStyle}
        >
          <CycleProgressOrb
            cycleDay={
              cycleStatus?.cycleDay
            }
            typicalCycleLength={
              cycleStatus
                ?.typicalCycleLength ||
              30
            }
            phase={
              cycleStatus?.phase
            }
          />
        </button>

        <div style={miniTextStyle}>
          <strong>
            {proteinRemaining}g
          </strong>

          <span>protein</span>
        </div>

        <div style={miniTextStyle}>
          <strong>
            {carbsRemaining}g
          </strong>

          <span>carbs</span>
        </div>

        <div style={miniTextStyle}>
          <strong>
            {fatsRemaining}g
          </strong>

          <span>fats</span>
        </div>

        <button
          type="button"
          aria-label="Quick add water"
          title="Quick add water"
          onClick={() => {
            setWaterOpen(
              (current) => !current,
            )

            setCycleOpen(false)
          }}
          style={orbButtonStyle}
        >
          <WaterCup
            percentFull={waterPercent}
            ouncesRemaining={
              localWaterRemaining
            }
          />
        </button>

        <Link
          href="/dashboard/check-in"
          aria-label="Open Daily Check-In"
          title="Daily Check-In"
          style={actionCircleStyle}
        >
          <span aria-hidden="true">
            ✓
          </span>
        </Link>

        <Link
          href="/dashboard/nutrition"
          aria-label="Open Food Log"
          title="Food Log"
          style={actionCircleStyle}
        >
          <span aria-hidden="true">
            +
          </span>
        </Link>

        <Link
          href={workoutHref}
          aria-label="Open Today’s Workout"
          title="Today’s Workout"
          style={actionCircleStyle}
        >
          <span
            aria-hidden="true"
            style={{
              fontSize: '0.78rem',
              fontWeight: 600,
              letterSpacing:
                '0.04em',
            }}
          >
            W
          </span>
        </Link>
      </div>

      {cycleOpen ? (
        <div style={cyclePopupStyle}>
          <p style={bodyStyle}>
            Cycle Day:{' '}
            {cycleStatus?.cycleDay ||
              '—'}{' '}
            · Phase:{' '}
            {cycleStatus?.phase ||
              'unknown'}
          </p>

          {cycleStatus?.cycleDay >=
          (cycleStatus
            ?.typicalCycleLength ||
            30) *
            3 ? (
            <p
              style={{
                ...bodyStyle,
                color: '#d89b9b',
                marginTop: '10px',
              }}
            >
              Your cycle appears
              significantly delayed.
              Consider whether pregnancy
              testing or professional
              guidance may be appropriate.
            </p>
          ) : null}

          <div style={popupButtonRowStyle}>
            <Link
              href="/dashboard/cycle"
              style={buttonStyle}
            >
              Open Cycle
            </Link>
          </div>
        </div>
      ) : null}

      {waterOpen ? (
        <div
          data-water-popup="true"
          style={waterPopupStyle}
        >
          <p style={bodyStyle}>
            Quick Add Water
          </p>

          <div style={waterGridStyle}>
            {[8, 12, 16, 24].map(
              (ounces) => (
                <button
                  key={ounces}
                  type="button"
                  style={buttonStyle}
                  onClick={async () => {
                    const response =
                      await fetch(
                        '/api/nutrition/add-water',
                        {
                          method:
                            'POST',

                          headers: {
                            'Content-Type':
                              'application/json',
                          },

                          body:
                            JSON.stringify(
                              {
                                clientId:
                                  client?.client_id,

                                ounces,
                              },
                            ),
                        },
                      )

                    if (
                      !response.ok
                    ) {
                      console.error(
                        'Water add failed:',
                        await response.json(),
                      )

                      return
                    }

                    setLocalWaterRemaining(
                      (
                        previous,
                      ) =>
                        Math.max(
                          0,
                          previous -
                            ounces,
                        ),
                    )

                    setWaterOpen(false)
                  }}
                >
                  +{ounces} oz
                </button>
              ),
            )}
          </div>

          <div style={popupButtonRowStyle}>
            <Link
              href="/dashboard/nutrition"
              style={buttonStyle}
            >
              Open Nutrition
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  )
}

const actionCircleStyle = {
  width: '38px',
  height: '38px',
  flex: '0 0 38px',
  borderRadius: '999px',

  border:
    '1px solid rgba(181,110,67,0.32)',

  background:
    'rgba(181,110,67,0.08)',

  color: '#f5f0e8',

  display: 'grid',
  placeItems: 'center',

  textDecoration: 'none',

  fontSize: '1.05rem',
  fontFamily: 'inherit',

  cursor: 'pointer',

  transition:
    'transform 0.16s ease, background 0.16s ease, border-color 0.16s ease',
} as const

const orbButtonStyle = {
  display: 'block',
  padding: 0,
  margin: 0,
  border: 'none',
  background: 'transparent',
  color: 'inherit',
  font: 'inherit',
  cursor: 'pointer',
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

const flameStyle = {
  ...miniTextStyle,
  minHeight: '66px',
  fontSize: '0.72rem',
  textTransform: 'capitalize',
} as const

const bodyStyle = {
  color: '#d7c7b6',
  lineHeight: 1.7,
  fontSize: '0.95rem',
  margin: 0,
} as const

const buttonStyle = {
  border:
    '1px solid rgba(181,110,67,0.28)',

  color: '#f5f0e8',

  padding: '10px 14px',

  textDecoration: 'none',
  borderRadius: '999px',
  fontWeight: 500,

  background:
    'rgba(181,110,67,0.055)',

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
  WebkitBackdropFilter:
    'blur(24px)',

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

const popupButtonRowStyle = {
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap',
  marginTop: '18px',
} as const

const waterGridStyle = {
  display: 'grid',
  gridTemplateColumns:
    '1fr 1fr',
  gap: '10px',
  marginTop: '12px',
} as const
