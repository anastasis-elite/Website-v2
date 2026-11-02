'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import {
  MUSCLE_REGIONS,
  getMuscleReadinessPresentation,
  type MuscleId,
  type MuscleReadiness,
  type MuscleReadinessState,
} from '@/lib/workout/muscleReadiness'

type MuscleGeometry = {
  points: Array<[number, number]>
}

const bodyImageSize = { width: 862, height: 1825 } as const
// The illustration's torso axis is slightly left of the image midpoint.
const bodyCenterX = 425

function mirror(points: MuscleGeometry['points']): MuscleGeometry['points'] {
  return points.map(([x, y]) => [2 * bodyCenterX - x, y])
}

function pointsToSvg(points: MuscleGeometry['points']) {
  return points.map(([x, y]) => `${x},${y}`).join(' ')
}

// Pixel coordinates in woman-silhouette.png, shared by the image and SVG.
// Posterior regions use this same silhouette; there is no separate back asset.
const leftGeometry = {
  upperTrap: [[381, 415], [364, 429], [342, 440], [371, 454], [404, 438]],
  anteriorDeltoid: [[322, 450], [300, 455], [288, 478], [293, 518], [313, 530], [329, 490]],
  lateralDeltoid: [[296, 456], [279, 472], [270, 499], [269, 537], [284, 550], [293, 516], [287, 482]],
  pectoralis: [[338, 466], [378, 458], [416, 466], [416, 551], [353, 539], [327, 513]],
  biceps: [[271, 548], [286, 553], [306, 535], [312, 575], [304, 620], [293, 667], [268, 677], [272, 620]],
  triceps: [[271, 540], [293, 539], [313, 568], [307, 617], [295, 669], [268, 677], [272, 619]],
  forearms: [[267, 689], [291, 683], [303, 710], [296, 750], [281, 804], [267, 861], [254, 898], [227, 897], [233, 839], [238, 788], [245, 739]],
  oblique: [[329, 641], [376, 650], [381, 696], [393, 758], [394, 811], [356, 821], [307, 792], [322, 743], [337, 700]],
  lat: [[324, 559], [385, 574], [395, 627], [383, 689], [376, 742], [341, 767], [339, 703], [330, 656]],
  gluteMax: [[291, 858], [343, 850], [397, 875], [415, 931], [400, 971], [353, 973], [316, 947], [285, 917]],
  gluteMedius: [[302, 809], [343, 826], [359, 850], [333, 881], [285, 888], [293, 846]],
  quadriceps: [[290, 902], [333, 900], [350, 977], [374, 1056], [389, 1145], [393, 1186], [363, 1219], [328, 1187], [310, 1112], [291, 1034], [281, 967]],
  hamstrings: [[292, 983], [343, 990], [391, 1000], [400, 1074], [393, 1186], [363, 1219], [328, 1187], [310, 1112], [291, 1034]],
  adductors: [[353, 889], [397, 928], [411, 965], [411, 1050], [402, 1139], [391, 1091], [378, 1013], [351, 944]],
  calves: [[323, 1265], [361, 1280], [393, 1267], [398, 1323], [392, 1390], [380, 1450], [366, 1517], [352, 1518], [343, 1467], [325, 1392], [316, 1329]],
  tibialis: [[328, 1265], [360, 1282], [389, 1268], [391, 1332], [381, 1396], [368, 1469], [362, 1523], [353, 1523], [345, 1465], [331, 1387], [320, 1327]],
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
  rectus_abdominis: { points: [[388, 640], [461, 640], [466, 695], [452, 757], [446, 819], [425, 838], [404, 819], [399, 757], [385, 695]] },
  left_external_oblique: { points: leftGeometry.oblique },
  right_external_oblique: { points: mirror(leftGeometry.oblique) },
  left_lat_region: { points: leftGeometry.lat },
  right_lat_region: { points: mirror(leftGeometry.lat) },
  erector_spinae_region: { points: [[405, 562], [445, 562], [450, 702], [441, 799], [425, 845], [409, 799], [400, 702]] },
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
  ready: 'High readiness',
  available: 'Moderate readiness',
  recovering: 'Reduced loading suggested',
  rest: 'Recovery still accumulating',
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
  selectedMuscleId,
  onSelectMuscle,
  heading = 'Readiness Map',
  eyebrow = 'Muscle Readiness',
}: {
  readiness: MuscleReadiness[]
  highlightedMuscleIds?: MuscleId[]
  selectedMuscleId?: MuscleId | null
  onSelectMuscle?: (muscleId: MuscleId) => void
  heading?: string
  eyebrow?: string
}) {
  const [internalSelectedId, setInternalSelectedId] = useState<MuscleId | null>(null)
  const [hoveredId, setHoveredId] = useState<MuscleId | null>(null)
  const [view, setView] = useState<'front' | 'posterior'>(() => MUSCLE_REGIONS.find(region => region.id === selectedMuscleId)?.view || 'front')
  const byId = useMemo(() => new Map(readiness.map((item) => [item.muscleId, item])), [readiness])
  const selectedId = selectedMuscleId ?? internalSelectedId
  const visibleSelectedId = MUSCLE_REGIONS.find(region => region.id === selectedId)?.view === view ? selectedId : null
  const activeId = hoveredId || visibleSelectedId
  const active = activeId ? byId.get(activeId) : null
  const activeDefinition = activeId ? MUSCLE_REGIONS.find((region) => region.id === activeId) : null
  const highlighted = new Set(highlightedMuscleIds)
  const activePresentation = active ? getMuscleReadinessPresentation(active.state) : null

  function selectMuscle(regionId: MuscleId) {
    if (onSelectMuscle) {
      onSelectMuscle(regionId)
      return
    }

    setInternalSelectedId((current) => (current === regionId ? null : regionId))
  }

  return (
    <section className="workout-muscle-panel" data-testid="muscle-readiness-panel">
      <div className="tier-panel-heading">
        <div>
          <p className="tier-dashboard-label">{eyebrow}</p>
          <h2>{heading}</h2>
        </div>
        <div className="workout-mode-switch" role="group" aria-label="Muscle map view">
          {(['front', 'posterior'] as const).map(side => <button key={side} type="button" aria-pressed={view === side} className={view === side ? 'is-active' : ''} onClick={() => { setView(side); setHoveredId(null) }}>
            {side === 'front' ? 'Front' : 'Back'}
          </button>)}
        </div>
      </div>

      <div className="workout-body-map">
        <Image
          src="/woman-silhouette.png"
          alt=""
          width={bodyImageSize.width}
          height={bodyImageSize.height}
          className="workout-body-image"
          priority={false}
        />
        <svg className="workout-muscle-overlay" viewBox={`0 0 ${bodyImageSize.width} ${bodyImageSize.height}`} role="img" aria-label={`Interactive muscle readiness map: ${view === 'front' ? 'front' : 'back'}`} preserveAspectRatio="xMidYMid meet">
          {MUSCLE_REGIONS.filter(region => region.view === view).map((region) => {
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
                onClick={() => selectMuscle(region.id)}
                onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectMuscle(region.id) } }}
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
            <span>{active.readinessScore ? `${active.readinessScore}% readiness estimate · ` : ''}{stateLabels[active.state]}</span>
            {formatLastTrained(active.lastTrainedAt) ? <small>Last trained: {formatLastTrained(active.lastTrainedAt)}</small> : null}
            {active.exercisesToday?.length ? <small>Today: {active.exercisesToday.slice(0, 2).join(', ')}</small> : null}
            {activePresentation ? <small>{activePresentation.guidance}</small> : null}
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
