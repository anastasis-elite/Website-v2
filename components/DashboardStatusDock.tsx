'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import CycleProgressOrb from '@/components/CycleProgressOrb'
import WaterCup from '@/components/WaterCup'
import HydrationQuickAdd from '@/components/hydration/HydrationQuickAdd'
import { getFlameVisualState } from '@/lib/dashboard/getFlameVisualState'
import { getClientLocalDate } from '@/lib/timezone'
import { foodEntryHref } from '@/lib/nutrition/loggingRoutes'
import { getTierCapabilities } from '@/lib/entitlements'

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
  const clientId = String(client?.client_id || '')
  const logDate = dailyPlan?.date || getClientLocalDate(client)
  const canLogFood = getTierCapabilities(client?.program).nutritionMealLogging

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

  const waterScope = `${clientId}:${logDate}`
  const [confirmedWater, setConfirmedWater] = useState<{ scope: string; total: number } | null>(null)
  useEffect(() => setConfirmedWater(null), [waterRemaining, waterScope])
  const consumedWater = confirmedWater?.scope === waterScope ? confirmedWater.total : Math.max(0, waterTarget - waterRemaining)
  const localWaterRemaining = Math.max(0, waterTarget - consumedWater)

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

        <HydrationQuickAdd key={waterScope} clientId={clientId} logDate={logDate}
          consumed={consumedWater} target={waterTarget}
          onSaved={total => setConfirmedWater({ scope: waterScope, total })}
          renderTrigger={({ open, triggerRef, toggle }) => <button ref={triggerRef}
            type="button" aria-label="Quick add water" title="Log water"
            aria-haspopup="dialog" aria-expanded={open}
            onClick={() => { setCycleOpen(false); toggle() }} style={orbButtonStyle}>
            <WaterCup percentFull={waterPercent} ouncesRemaining={localWaterRemaining} />
          </button>} />

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
          href={foodEntryHref(client?.program)}
          aria-label={canLogFood ? 'Open Food Log' : 'Open Nutrition Guidance'}
          title={canLogFood ? 'Food Log' : 'Nutrition Guidance'}
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

    </div>
  )
}

const actionCircleStyle = {
  width: '44px',
  height: '44px',
  flex: '0 0 44px',
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

const popupButtonRowStyle = {
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap',
  marginTop: '18px',
} as const
