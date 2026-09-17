'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import {
  MUSCLE_REGIONS,
  type MuscleId,
  type MuscleReadiness,
  type MuscleReadinessState,
} from '@/lib/workout/muscleReadiness'

type MuscleGeometry = {
  points: Array<[number, number]>
}

function mirror(points: MuscleGeometry['points']): MuscleGeometry['points'] {
  return points.map(([x, y]) => [100 - x, y])
}

function pointsToSvg(points: MuscleGeometry['points']) {
  return points.map(([x, y]) => `${x},${y}`).join(' ')
}

const leftGeometry = {
  upperTrap: [[41.1, 25.7], [37.8, 26.4], [35.7, 27.6], [38.8, 28.6], [43.9, 27.6]],
  anteriorDeltoid: [[35.8, 28.2], [32.6, 28.9], [30.6, 31.2], [30.7, 34.5], [33.8, 33.9], [36.7, 30.2]],
  lateralDeltoid: [[31.0, 32.7], [28.7, 35.8], [27.8, 40.2], [28.8, 44.3], [31.2, 42.3], [32.4, 36.2]],
  pectoralis: [[36.6, 31.0], [41.8, 30.4], [48.5, 31.4], [47.9, 35.0], [40.3, 35.1], [35.7, 33.5]],
  biceps: [[30.2, 36.0], [28.4, 41.0], [28.2, 48.5], [30.0, 52.4], [32.2, 47.1], [32.3, 38.4]],
  triceps: [[32.3, 36.9], [33.8, 41.7], [32.5, 48.9], [30.4, 52.2], [30.8, 44.3], [31.2, 38.2]],
  forearms: [[29.6, 50.7], [27.6, 55.8], [27.8, 61.0], [29.8, 63.3], [31.0, 60.2], [31.1, 54.8]],
  oblique: [[36.3, 35.1], [39.8, 36.9], [40.0, 45.1], [36.7, 48.1], [34.5, 42.9], [34.6, 37.7]],
  lat: [[34.8, 34.3], [37.5, 38.4], [37.3, 46.5], [35.0, 50.2], [33.4, 43.3], [33.6, 37.2]],
  gluteMax: [[37.5, 49.4], [43.1, 48.7], [48.6, 50.0], [48.2, 54.1], [42.0, 55.2], [36.2, 52.7]],
  gluteMedius: [[35.4, 47.1], [40.4, 46.6], [44.8, 48.9], [40.4, 50.2], [35.4, 49.1]],
  quadriceps: [[35.4, 53.0], [42.5, 52.7], [47.9, 57.8], [47.0, 70.5], [40.2, 69.7], [36.0, 61.1]],
  hamstrings: [[36.4, 54.0], [41.6, 55.1], [44.9, 63.2], [43.7, 71.4], [39.0, 67.8], [35.4, 58.7]],
  adductors: [[44.8, 54.5], [48.8, 55.3], [48.4, 72.0], [45.5, 69.5], [43.6, 61.2]],
  calves: [[38.2, 71.8], [43.9, 74.1], [44.4, 85.8], [41.5, 89.0], [37.4, 84.4], [36.8, 76.5]],
  tibialis: [[45.0, 71.5], [47.6, 74.8], [46.7, 87.0], [44.1, 89.2], [42.9, 81.4]],
} satisfies Record<string, MuscleGeometry['points']>

export const muscleMapGeometry: Record<MuscleId, MuscleGeometry> = {
  left_upper_traps: { points: leftGeometry.upperTrap },
  right_upper_traps: { points: mirror(leftGeometry.upperTrap) },
  left_anterior_deltoid: { points: leftGeometry.anteriorDeltoid },
  right_anterior_deltoid: { points: mirror(leftGeometry.anteriorDeltoid) },
  left_lateral_deltoid: { points: leftGeometry.lateralDeltoid },
  right_lateral_deltoid: { points: mirror(leftGeometry.lateralDeltoid) },
  left_pectoralis_major: { points: leftGeometry.pectoralis },
  right_pectoralis_major: { points: mirror(leftGeometry.pectoralis) },
  left_biceps: { points: leftGeometry.biceps },
  right_biceps: { points: mirror(leftGeometry.biceps) },
  left_triceps: { points: leftGeometry.triceps },
  right_triceps: { points: mirror(leftGeometry.triceps) },
  left_forearms: { points: leftGeometry.forearms },
  right_forearms: { points: mirror(leftGeometry.forearms) },
  rectus_abdominis: { points: [[45.4, 35.2], [54.6, 35.2], [55.7, 43.4], [52.5, 49.2], [50.0, 50.3], [47.5, 49.2], [44.3, 43.4]] },
  left_external_oblique: { points: leftGeometry.oblique },
  right_external_oblique: { points: mirror(leftGeometry.oblique) },
  left_lat_region: { points: leftGeometry.lat },
  right_lat_region: { points: mirror(leftGeometry.lat) },
  erector_spinae_region: { points: [[47.5, 34.0], [52.5, 34.0], [53.7, 47.1], [50.0, 54.2], [46.3, 47.1]] },
  left_glute_max: { points: leftGeometry.gluteMax },
  right_glute_max: { points: mirror(leftGeometry.gluteMax) },
  left_glute_medius: { points: leftGeometry.gluteMedius },
  right_glute_medius: { points: mirror(leftGeometry.gluteMedius) },
  left_quadriceps: { points: leftGeometry.quadriceps },
  right_quadriceps: { points: mirror(leftGeometry.quadriceps) },
  left_hamstrings: { points: leftGeometry.hamstrings },
  right_hamstrings: { points: mirror(leftGeometry.hamstrings) },
  left_adductors: { points: leftGeometry.adductors },
  right_adductors: { points: mirror(leftGeometry.adductors) },
  left_calves: { points: leftGeometry.calves },
  right_calves: { points: mirror(leftGeometry.calves) },
  left_tibialis_anterior: { points: leftGeometry.tibialis },
  right_tibialis_anterior: { points: mirror(leftGeometry.tibialis) },
}

const stateLabels: Record<MuscleReadinessState, string> = {
  ready: 'Ready',
  available: 'Available',
  recovering: 'Recovering',
  rest: 'Rest',
  unknown: 'Not enough data',
}

function formatLastTrained(value?: string) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function MuscleReadinessMap({
  readiness,
  highlightedMuscleIds = [],
}: {
  readiness: MuscleReadiness[]
  highlightedMuscleIds?: MuscleId[]
}) {
  const [selectedId, setSelectedId] = useState<MuscleId | null>(null)
  const [hoveredId, setHoveredId] = useState<MuscleId | null>(null)
  const byId = useMemo(() => new Map(readiness.map((item) => [item.muscleId, item])), [readiness])
  const activeId = hoveredId || selectedId
  const active = activeId ? byId.get(activeId) : null
  const activeDefinition = activeId ? MUSCLE_REGIONS.find((region) => region.id === activeId) : null
  const highlighted = new Set(highlightedMuscleIds)

  return (
    <section className="workout-muscle-panel" data-testid="muscle-readiness-panel">
      <div className="tier-panel-heading">
        <div>
          <p className="tier-dashboard-label">Muscle Readiness</p>
          <h2>Readiness Map</h2>
        </div>
      </div>

      <div className="workout-body-map">
        <Image
          src="/woman-silhouette.png"
          alt=""
          width={862}
          height={1825}
          className="workout-body-image"
          priority={false}
        />
        <svg className="workout-muscle-overlay" viewBox="0 0 100 100" role="img" aria-label="Interactive muscle readiness map" preserveAspectRatio="none">
          {MUSCLE_REGIONS.map((region) => {
            const item = byId.get(region.id)
            const state = item?.state || 'unknown'
            const isActive = activeId === region.id
            const isHighlighted = highlighted.has(region.id) || Boolean(item?.exercisesToday?.length)
            const geometry = muscleMapGeometry[region.id]
            return (
              <polygon
                key={region.id}
                points={pointsToSvg(geometry.points)}
                className={`workout-muscle-region readiness-${state}${isActive ? ' is-selected' : ''}${isHighlighted ? ' is-in-workout' : ''}`}
                tabIndex={0}
                role="button"
                aria-label={`${region.label}: ${stateLabels[state]}`}
                data-muscle-id={region.id}
                onMouseEnter={() => setHoveredId(region.id)}
                onMouseLeave={() => setHoveredId(null)}
                onFocus={() => setHoveredId(region.id)}
                onBlur={() => setHoveredId(null)}
                onClick={() => setSelectedId((current) => (current === region.id ? null : region.id))}
              />
            )
          })}
        </svg>
      </div>

      <div className="workout-readiness-legend" aria-label="Readiness legend">
        {(['ready', 'available', 'recovering', 'rest'] as MuscleReadinessState[]).map((state) => (
          <span key={state}><i className={`readiness-${state}`} />{stateLabels[state]}</span>
        ))}
      </div>

      <div className="workout-muscle-detail" aria-live="polite">
        {active && activeDefinition ? (
          <>
            <strong>{activeDefinition.label}</strong>
            <span>{stateLabels[active.state]}</span>
            {formatLastTrained(active.lastTrainedAt) ? <small>Last trained: {formatLastTrained(active.lastTrainedAt)}</small> : null}
            {active.exercisesToday?.length ? <small>Today: {active.exercisesToday.slice(0, 2).join(', ')}</small> : null}
            {active.reasons?.[0] ? <small>{active.reasons[0]}</small> : null}
          </>
        ) : (
          <>
            <strong>Select a muscle</strong>
            <span>Readiness reflects logged training and recovery inputs.</span>
          </>
        )}
      </div>
    </section>
  )
}
