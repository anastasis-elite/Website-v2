'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import {
  MUSCLE_REGIONS,
  getBilateralMuscleIds,
  getMuscleReadinessPresentation,
  muscleRegionIsVisible,
  type MuscleId,
  type MuscleReadiness,
  type MuscleReadinessState,
} from '@/lib/workout/muscleReadiness'
import { getReadinessForCanonicalMuscle } from '@/lib/workout/manualWorkout'

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

// The original front illustration and its hit areas retain their coordinates.
// The posterior vector below has its own anatomy and separately aligned regions.
const leftGeometry = {
  upperTrap: [[381, 415], [364, 429], [342, 440], [371, 454], [404, 438]],
  anteriorDeltoid: [[322, 450], [300, 455], [288, 478], [293, 518], [313, 530], [329, 490]],
  lateralDeltoid: [[296, 456], [279, 472], [270, 499], [269, 537], [284, 550], [293, 516], [287, 482]],
  posteriorDeltoid: [[295, 454], [325, 457], [345, 482], [334, 523], [305, 542], [279, 516], [278, 483]],
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
  left_posterior_deltoid: { points: leftGeometry.posteriorDeltoid },
  right_posterior_deltoid: { points: mirror(leftGeometry.posteriorDeltoid) },
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

const posteriorLeftGeometry = {
  upperTrap: [[400, 412], [379, 431], [346, 445], [347, 465], [372, 486], [411, 535], [416, 461]],
  lat: [[327, 537], [367, 522], [409, 555], [407, 631], [386, 685], [376, 748], [342, 768], [340, 705], [329, 652]],
  glute: [[294, 829], [346, 823], [395, 850], [415, 889], [414, 939], [392, 972], [350, 974], [310, 947], [285, 902]],
} satisfies Record<string, MuscleGeometry['points']>

/** Coordinates share the posterior vector's pose, not the front torso details. */
export const posteriorMuscleMapGeometry: Partial<Record<MuscleId, MuscleGeometry>> = {
  left_upper_traps: { points: posteriorLeftGeometry.upperTrap },
  right_upper_traps: { points: mirror(posteriorLeftGeometry.upperTrap) },
  left_posterior_deltoid: { points: leftGeometry.posteriorDeltoid },
  right_posterior_deltoid: { points: mirror(leftGeometry.posteriorDeltoid) },
  left_triceps: muscleMapGeometry.left_triceps,
  right_triceps: muscleMapGeometry.right_triceps,
  left_lat_region: { points: posteriorLeftGeometry.lat },
  right_lat_region: { points: mirror(posteriorLeftGeometry.lat) },
  // This hit area is lumbar only, below the ribs; the former long thoracic strip
  // remains in the front geometry export solely for coordinate compatibility.
  erector_spinae_region: { points: [[390, 674], [413, 685], [425, 704], [437, 685], [460, 674], [451, 766], [438, 826], [412, 826], [399, 766]] },
  left_glute_max: { points: posteriorLeftGeometry.glute },
  right_glute_max: { points: mirror(posteriorLeftGeometry.glute) },
  left_hamstrings: muscleMapGeometry.left_hamstrings,
  right_hamstrings: muscleMapGeometry.right_hamstrings,
  left_calves: muscleMapGeometry.left_calves,
  right_calves: muscleMapGeometry.right_calves,
}

/** A source-native posterior illustration: nape, scapulae, spine and heels. */
function PosteriorBody() {
  const limb = 'M294 465C269 472 263 502 266 548L260 633C257 672 245 710 239 752L232 835 222 897 219 947C209 972 211 990 222 1008L242 1024 252 1029 261 1022 250 1006 245 986 255 971 260 944 258 902 271 841 286 784 300 733C308 703 308 670 310 633L319 553 330 506Z'
  const leg = 'M287 898C276 943 284 1009 299 1074L318 1187C324 1218 319 1245 314 1280 307 1340 320 1436 337 1490L350 1552C351 1572 348 1591 342 1605L330 1646C325 1668 336 1682 360 1683L383 1680C403 1677 409 1667 405 1647L394 1594C391 1578 397 1566 399 1549L400 1481 404 1366 407 1250 407 1165 411 1051 422 943Z'
  return <svg className="workout-body-image" viewBox="0 0 862 1825" aria-hidden="true" focusable="false" data-testid="posterior-body-vector">
    <rect width="862" height="1825" rx="24" fill="var(--anastasis-charcoal, #161310)" />
    <g fill="#221a14" stroke="var(--anastasis-copper, #ad7c52)" strokeWidth="2.4" strokeLinejoin="round">
      <path d={limb} /><path d={limb} transform="translate(850 0) scale(-1 1)" />
      <path d={leg} /><path d={leg} transform="translate(850 0) scale(-1 1)" />
      <path d="M399 373 397 405C386 425 362 435 335 440 311 445 304 470 315 510L329 568C342 612 340 657 329 698L309 763C299 794 287 830 285 867 280 902 287 929 309 948 339 978 390 987 425 955 460 987 511 978 541 948 563 929 570 902 565 867 563 830 551 794 541 763L521 698C510 657 508 612 521 568L535 510C546 470 539 445 515 440 488 435 464 425 453 405L451 373Z" />
      <path d="M366 270C363 309 373 350 396 374 411 391 439 391 454 374 477 350 487 309 484 270 482 232 460 207 425 205 390 207 368 232 366 270Z" fill="#19130f" />
      <ellipse cx="425" cy="196" rx="45" ry="35" fill="#19130f" />
    </g>
    <g fill="none" stroke="var(--anastasis-ivory, #f4eee4)" strokeOpacity=".24" strokeWidth="2.4" strokeLinecap="round">
      <path d="M400 386C407 399 411 413 412 432M450 386C443 399 439 413 438 432M425 450 425 654M425 689 425 801" />
      <path d="M354 492C374 487 398 506 405 532L383 604C365 594 346 558 349 535M496 492C476 487 452 506 445 532L467 604C485 594 504 558 501 535" />
      <path d="M316 612C356 636 494 636 534 612M311 631C354 653 496 653 539 631M303 807C350 825 500 825 547 807" />
      <path d="M425 851 425 941M299 939C325 963 378 972 415 943M551 939C525 963 472 972 435 943M328 1226 388 1233M462 1233 522 1226" />
      <path d="M348 1647C359 1657 382 1657 395 1647M455 1647C468 1657 491 1657 502 1647" />
    </g>
  </svg>
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
  bilateralSelection = false,
}: {
  readiness: MuscleReadiness[]
  highlightedMuscleIds?: MuscleId[]
  selectedMuscleId?: MuscleId | null
  onSelectMuscle?: (muscleId: MuscleId) => void
  heading?: string
  eyebrow?: string
  bilateralSelection?: boolean
}) {
  const [internalSelectedId, setInternalSelectedId] = useState<MuscleId | null>(null)
  const [hoveredId, setHoveredId] = useState<MuscleId | null>(null)
  const [view, setView] = useState<'front' | 'posterior'>(() => MUSCLE_REGIONS.find(region => region.id === selectedMuscleId)?.view || 'front')
  const byId = useMemo(() => new Map(readiness.map((item) => [item.muscleId, item])), [readiness])
  const selectedId = selectedMuscleId ?? internalSelectedId
  const selectedDefinition = MUSCLE_REGIONS.find(region => region.id === selectedId)
  const visibleSelectedId = selectedDefinition && muscleRegionIsVisible(selectedDefinition, view) ? selectedId : null
  const activeId = hoveredId || visibleSelectedId
  const activeDefinition = activeId ? MUSCLE_REGIONS.find((region) => region.id === activeId) : null
  const activeCanonical = activeDefinition?.canonicalMuscles[0]
  const cautiousState = bilateralSelection && activeCanonical ? getReadinessForCanonicalMuscle(readiness, activeCanonical) : null
  const active = cautiousState ? readiness.filter(item => item.state === cautiousState && MUSCLE_REGIONS.find(region => region.id === item.muscleId)?.canonicalMuscles.includes(activeCanonical!))
    .sort((left, right) => (left.readinessScore ?? Infinity) - (right.readinessScore ?? Infinity))[0] || { muscleId: activeId!, state: cautiousState } : activeId ? byId.get(activeId) : null
  const selectedIds = new Set(selectedId ? bilateralSelection ? getBilateralMuscleIds(selectedId) : [selectedId] : [])
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
        {view === 'front' ? <Image
          src="/woman-silhouette.png"
          alt=""
          width={bodyImageSize.width}
          height={bodyImageSize.height}
          className="workout-body-image"
          priority={false}
        /> : <PosteriorBody />}
        <svg className="workout-muscle-overlay" viewBox={`0 0 ${bodyImageSize.width} ${bodyImageSize.height}`} role="group" aria-label={`Interactive muscle readiness map: ${view === 'front' ? 'front' : 'back'}`} preserveAspectRatio="xMidYMid meet">
          {MUSCLE_REGIONS.filter(region => muscleRegionIsVisible(region, view)).map((region) => {
            const item = byId.get(region.id)
            const state = item?.state || 'unknown'
            const isActive = selectedIds.has(region.id) || (bilateralSelection && activeId ? getBilateralMuscleIds(activeId).includes(region.id) : activeId === region.id)
            const isHighlighted = highlighted.has(region.id) || Boolean(item?.exercisesToday?.length)
            const geometry = view === 'posterior' ? posteriorMuscleMapGeometry[region.id] : muscleMapGeometry[region.id]
            if (!geometry) return null
            return (
              <polygon
                key={region.id}
                points={pointsToSvg(geometry.points)}
                className={`workout-muscle-region readiness-${state}${isActive ? ' is-selected' : ''}${isHighlighted ? ' is-in-workout' : ''}`}
                tabIndex={0}
                role="button"
                aria-label={`${region.label}: ${stateLabels[state]}`}
                aria-pressed={selectedIds.has(region.id)}
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
            <strong>{bilateralSelection && activeDefinition.side !== 'center' ? `${activeDefinition.label.replace(/^(Left|Right) /, '')} · Both sides` : activeDefinition.label}</strong>
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
