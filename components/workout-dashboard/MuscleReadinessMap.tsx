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
// The supplied back artwork has its own size, axis and separately aligned regions.
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

// Native coordinates of Rhea's supplied back image. Keep the front registration
// above independent: the two artworks have different poses and proportions.
const posteriorBodyImageSize = { width: 932, height: 1687 } as const
const posteriorBodyCenterX = 465
// Fill the front-sized frame by height without stretching the back artwork.
// Both the image and native-coordinate SVG use this one registration layer.
// The small downward offset aligns the visible bun/heels with the front figure.
const posteriorArtworkRegistration = {
  width: `${100 * posteriorBodyImageSize.width * bodyImageSize.height / (posteriorBodyImageSize.height * bodyImageSize.width)}%`,
  left: `${100 * bodyCenterX / bodyImageSize.width}%`,
  transform: `translate(-${100 * posteriorBodyCenterX / posteriorBodyImageSize.width}%, 2.8%)`,
}
function mirrorPosterior(points: MuscleGeometry['points']): MuscleGeometry['points'] {
  return points.map(([x, y]) => [2 * posteriorBodyCenterX - x, y])
}

const posteriorLeftGeometry = {
  upperTrap: [[428, 344], [411, 360], [387, 374], [357, 385], [380, 401], [410, 412], [455, 431], [456, 383], [445, 350]],
  posteriorDeltoid: [[351, 391], [333, 398], [321, 416], [316, 443], [318, 470], [333, 488], [354, 479], [366, 455], [368, 427]],
  triceps: [[317, 488], [333, 498], [354, 489], [360, 514], [355, 551], [347, 583], [341, 611], [324, 620], [311, 601], [312, 562]],
  lat: [[370, 486], [397, 474], [450, 456], [455, 487], [450, 534], [432, 571], [415, 610], [406, 649], [391, 670], [385, 643], [389, 609], [383, 561]],
  glute: [[380, 701], [418, 714], [460, 724], [459, 790], [446, 822], [417, 837], [381, 835], [353, 815], [341, 790], [349, 751], [364, 719]],
  hamstrings: [[342, 850], [380, 852], [417, 851], [450, 839], [453, 880], [447, 940], [445, 1009], [439, 1075], [385, 1075], [378, 1033], [364, 973], [352, 918], [345, 878]],
  calves: [[383, 1122], [403, 1114], [434, 1119], [445, 1147], [447, 1181], [439, 1244], [428, 1304], [421, 1365], [407, 1370], [396, 1314], [383, 1261], [373, 1203], [372, 1163]],
} satisfies Record<string, MuscleGeometry['points']>

/** All posterior hit areas use the supplied image's native 932 × 1687 space. */
export const posteriorMuscleMapGeometry: Partial<Record<MuscleId, MuscleGeometry>> = {
  left_upper_traps: { points: posteriorLeftGeometry.upperTrap },
  right_upper_traps: { points: mirrorPosterior(posteriorLeftGeometry.upperTrap) },
  left_posterior_deltoid: { points: posteriorLeftGeometry.posteriorDeltoid },
  right_posterior_deltoid: { points: mirrorPosterior(posteriorLeftGeometry.posteriorDeltoid) },
  left_triceps: { points: posteriorLeftGeometry.triceps },
  right_triceps: { points: mirrorPosterior(posteriorLeftGeometry.triceps) },
  left_lat_region: { points: posteriorLeftGeometry.lat },
  right_lat_region: { points: mirrorPosterior(posteriorLeftGeometry.lat) },
  // Lumbar only: below the ribs and above the pelvis, not a thoracic strip.
  erector_spinae_region: { points: [[435, 583], [463, 598], [491, 583], [503, 615], [512, 647], [525, 680], [499, 700], [465, 710], [431, 700], [405, 680], [418, 647], [427, 615]] },
  left_glute_max: { points: posteriorLeftGeometry.glute },
  right_glute_max: { points: mirrorPosterior(posteriorLeftGeometry.glute) },
  left_hamstrings: { points: posteriorLeftGeometry.hamstrings },
  right_hamstrings: { points: mirrorPosterior(posteriorLeftGeometry.hamstrings) },
  left_calves: { points: posteriorLeftGeometry.calves },
  right_calves: { points: mirrorPosterior(posteriorLeftGeometry.calves) },
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
  onChooseExercises,
  exerciseSelectionDisabled = false,
  heading = 'Readiness Map',
  eyebrow = 'Muscle Readiness',
  bilateralSelection = false,
}: {
  readiness: MuscleReadiness[]
  highlightedMuscleIds?: MuscleId[]
  selectedMuscleId?: MuscleId | null
  onSelectMuscle?: (muscleId: MuscleId) => void
  onChooseExercises?: (muscleId: MuscleId, trigger?: HTMLElement | SVGElement) => void
  exerciseSelectionDisabled?: boolean
  heading?: string
  eyebrow?: string
  bilateralSelection?: boolean
}) {
  const [internalSelectedId, setInternalSelectedId] = useState<MuscleId | null>(null)
  const [hoveredId, setHoveredId] = useState<MuscleId | null>(null)
  const [view, setView] = useState<'front' | 'posterior'>(() => MUSCLE_REGIONS.find(region => region.id === selectedMuscleId)?.view || 'front')
  const byId = useMemo(() => new Map(readiness.map((item) => [item.muscleId, item])), [readiness])
  // Focus/hover inspection stays per side. Activating a region chooses its
  // bilateral exercise flow, unless an existing exercise is still open.
  const selectedId = onChooseExercises ? internalSelectedId : selectedMuscleId ?? internalSelectedId
  const selectedDefinition = MUSCLE_REGIONS.find(region => region.id === selectedId)
  const visibleSelectedId = selectedDefinition && muscleRegionIsVisible(selectedDefinition, view) ? selectedId : null
  const activeId = hoveredId || visibleSelectedId
  const activeDefinition = activeId ? MUSCLE_REGIONS.find((region) => region.id === activeId) : null
  const activeCanonical = activeDefinition?.canonicalMuscles[0]
  const cautiousState = !onChooseExercises && bilateralSelection && activeCanonical ? getReadinessForCanonicalMuscle(readiness, activeCanonical) : null
  const active: MuscleReadiness | null = cautiousState ? readiness.filter(item => item.state === cautiousState && MUSCLE_REGIONS.find(region => region.id === item.muscleId)?.canonicalMuscles.includes(activeCanonical!))
    .sort((left, right) => (left.readinessScore ?? Infinity) - (right.readinessScore ?? Infinity))[0] || { muscleId: activeId!, state: cautiousState } : activeId ? byId.get(activeId) || { muscleId: activeId, state: 'unknown' as const } : null
  const selectedIds = new Set(selectedId ? !onChooseExercises && bilateralSelection ? getBilateralMuscleIds(selectedId) : [selectedId] : [])
  const exerciseSelectedIds = new Set(onChooseExercises && selectedMuscleId ? getBilateralMuscleIds(selectedMuscleId) : [])
  const highlighted = new Set(highlightedMuscleIds)
  const activePresentation = active ? getMuscleReadinessPresentation(active.state) : null

  function selectMuscle(regionId: MuscleId, trigger?: HTMLElement | SVGElement) {
    if (onChooseExercises && !exerciseSelectionDisabled) {
      setInternalSelectedId(regionId)
      onChooseExercises(regionId, trigger)
      return
    }
    if (!onChooseExercises && onSelectMuscle) {
      onSelectMuscle(regionId)
      return
    }

    setInternalSelectedId((current) => (current === regionId ? null : regionId))
  }

  const imageSize = view === 'posterior' ? posteriorBodyImageSize : bodyImageSize

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

      <div className="workout-readiness-legend" aria-label="Readiness legend">
        {(['ready', 'available', 'recovering', 'rest'] as MuscleReadinessState[]).map((state) => (
          <span key={state}><i className={`readiness-${state}`} />{stateLabels[state]}</span>
        ))}
      </div>

      <div className="workout-body-map" data-view={view} style={{ aspectRatio: `${bodyImageSize.width} / ${bodyImageSize.height}` }}>
        <div className="workout-body-artwork" style={view === 'posterior' ? posteriorArtworkRegistration : undefined}>
          {view === 'front' ? <Image
            src="/woman-silhouette.png"
            alt=""
            width={bodyImageSize.width}
            height={bodyImageSize.height}
            className="workout-body-image"
            priority={false}
          /> : <Image
            src="/images/muscle-map/posterior-body.webp"
            alt=""
            aria-hidden="true"
            width={posteriorBodyImageSize.width}
            height={posteriorBodyImageSize.height}
            sizes="(max-width: 560px) 375px, (max-width: 980px) 422px, 457px"
            className="workout-body-image"
            data-testid="posterior-body-image"
            priority={false}
          />}
          <svg className="workout-muscle-overlay" viewBox={`0 0 ${imageSize.width} ${imageSize.height}`} role="group" aria-label={`Interactive muscle readiness map: ${view === 'front' ? 'front' : 'back'}`} preserveAspectRatio="xMidYMid meet">
            {MUSCLE_REGIONS.filter(region => muscleRegionIsVisible(region, view)).map((region) => {
              const item = byId.get(region.id)
              const state = item?.state || 'unknown'
              const isActive = selectedIds.has(region.id) || exerciseSelectedIds.has(region.id) || (!onChooseExercises && bilateralSelection && activeId ? getBilateralMuscleIds(activeId).includes(region.id) : activeId === region.id)
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
                  aria-haspopup={onChooseExercises && !exerciseSelectionDisabled ? 'dialog' : undefined}
                  data-muscle-id={region.id}
                  data-exercise-selected={exerciseSelectedIds.has(region.id) ? 'true' : undefined}
                  onMouseEnter={() => setHoveredId(region.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onFocus={() => setHoveredId(region.id)}
                  onBlur={() => setHoveredId(null)}
                  onClick={event => selectMuscle(region.id, event?.currentTarget)}
                  onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (!event.repeat) selectMuscle(region.id, event.currentTarget) } }}
                />
              )
            })}
          </svg>
        </div>
      </div>

      <div className="workout-muscle-detail" aria-live="polite">
        {active && activeDefinition ? (
          <>
            <strong>{!onChooseExercises && bilateralSelection && activeDefinition.side !== 'center' ? `${activeDefinition.label.replace(/^(Left|Right) /, '')} · Both sides` : activeDefinition.label}</strong>
            <span>{Number.isFinite(active.readinessScore) ? `${active.readinessScore}% readiness estimate · ` : ''}{stateLabels[active.state]}</span>
            {formatLastTrained(active.lastTrainedAt) ? <small>Last trained: {formatLastTrained(active.lastTrainedAt)}</small> : null}
            {active.exercisesToday?.length ? <small>Today: {active.exercisesToday.join(', ')}</small> : null}
            {activePresentation ? <small>{activePresentation.guidance}</small> : null}
            {active.reasons?.map((reason, index) => <small key={`${index}:${reason}`}>{reason}</small>)}
          </>
        ) : (
          <>
            <strong>Select a muscle</strong>
            <span>Readiness reflects logged training and recovery inputs.</span>
          </>
        )}
      </div>
      {onChooseExercises ? <div className="workout-map-exercise-choice">
        <p>{exerciseSelectionDisabled ? 'Select a muscle to inspect its readiness.' : 'Select a muscle to choose equipment and exercises. Focus or hover to inspect readiness.'}</p>
        {exerciseSelectionDisabled ? <p role="status">Your active exercise stays open. Inspect readiness here; finish that exercise before choosing another.</p>
          : <p>Exercise choices use the more cautious readiness of both matching sides.</p>}
      </div> : null}
    </section>
  )
}
