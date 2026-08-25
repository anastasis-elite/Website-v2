'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import {
  MUSCLE_REGIONS,
  type MuscleId,
  type MuscleReadiness,
  type MuscleReadinessState,
} from '@/lib/workout/muscleReadiness'

const musclePaths: Record<MuscleId, string> = {
  left_upper_traps: 'M353 495 C322 514 295 544 287 585 C322 571 349 552 371 518 Z',
  right_upper_traps: 'M509 495 C540 514 567 544 575 585 C540 571 513 552 491 518 Z',
  left_anterior_deltoid: 'M267 571 C222 586 206 643 221 700 C255 695 281 665 292 610 Z',
  right_anterior_deltoid: 'M595 571 C640 586 656 643 641 700 C607 695 581 665 570 610 Z',
  left_lateral_deltoid: 'M220 635 C187 690 185 775 206 840 C226 796 238 718 234 655 Z',
  right_lateral_deltoid: 'M642 635 C675 690 677 775 656 840 C636 796 624 718 628 655 Z',
  left_pectoralis_major: 'M305 635 C351 604 402 610 421 669 C388 700 340 698 302 668 Z',
  right_pectoralis_major: 'M441 669 C460 610 511 604 557 635 L560 668 C522 698 474 700 441 669 Z',
  left_biceps: 'M213 712 C184 760 182 856 206 948 C233 892 244 801 235 724 Z',
  right_biceps: 'M649 712 C678 760 680 856 656 948 C629 892 618 801 627 724 Z',
  left_triceps: 'M235 720 C251 780 244 882 214 948 C202 862 204 781 220 721 Z',
  right_triceps: 'M627 720 C611 780 618 882 648 948 C660 862 658 781 642 721 Z',
  left_forearms: 'M201 934 C171 1005 165 1108 200 1196 C227 1141 235 1016 216 941 Z',
  right_forearms: 'M661 934 C691 1005 697 1108 662 1196 C635 1141 627 1016 646 941 Z',
  rectus_abdominis: 'M382 715 C414 704 448 704 480 715 C491 802 485 904 431 958 C377 904 371 802 382 715 Z',
  left_external_oblique: 'M305 707 C337 724 364 781 365 903 C335 887 309 821 297 738 Z',
  right_external_oblique: 'M557 707 C525 724 498 781 497 903 C527 887 553 821 565 738 Z',
  left_lat_region: 'M300 665 C335 710 350 810 332 904 C296 859 279 761 286 683 Z',
  right_lat_region: 'M562 665 C527 710 512 810 530 904 C566 859 583 761 576 683 Z',
  erector_spinae_region: 'M399 680 C419 735 420 898 384 1001 L431 1053 L478 1001 C442 898 443 735 463 680 Z',
  left_glute_max: 'M337 1012 C375 977 426 994 430 1065 C406 1113 356 1119 319 1076 Z',
  right_glute_max: 'M432 1065 C436 994 487 977 525 1012 L543 1076 C506 1119 456 1113 432 1065 Z',
  left_glute_medius: 'M313 953 C348 943 386 966 399 1008 C363 1014 330 995 309 967 Z',
  right_glute_medius: 'M549 953 C514 943 476 966 463 1008 C499 1014 532 995 553 967 Z',
  left_quadriceps: 'M318 1096 C377 1121 413 1185 411 1396 C358 1383 321 1241 302 1120 Z',
  right_quadriceps: 'M544 1096 C485 1121 449 1185 451 1396 C504 1383 541 1241 560 1120 Z',
  left_hamstrings: 'M332 1097 C379 1135 397 1240 384 1402 C338 1352 311 1215 306 1116 Z',
  right_hamstrings: 'M530 1097 C483 1135 465 1240 478 1402 C524 1352 551 1215 556 1116 Z',
  left_adductors: 'M399 1110 C428 1185 430 1325 412 1436 C383 1340 378 1206 386 1121 Z',
  right_adductors: 'M463 1110 C434 1185 432 1325 450 1436 C479 1340 484 1206 476 1121 Z',
  left_calves: 'M338 1405 C382 1448 392 1608 361 1691 C321 1620 316 1485 338 1405 Z',
  right_calves: 'M524 1405 C480 1448 470 1608 501 1691 C541 1620 546 1485 524 1405 Z',
  left_tibialis_anterior: 'M391 1400 C420 1488 413 1609 382 1694 C370 1584 370 1485 391 1400 Z',
  right_tibialis_anterior: 'M471 1400 C442 1488 449 1609 480 1694 C492 1584 492 1485 471 1400 Z',
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
        <svg className="workout-muscle-overlay" viewBox="0 0 862 1825" role="img" aria-label="Interactive muscle readiness map">
          {MUSCLE_REGIONS.map((region) => {
            const item = byId.get(region.id)
            const state = item?.state || 'unknown'
            const isActive = activeId === region.id
            const isHighlighted = highlighted.has(region.id) || Boolean(item?.exercisesToday?.length)
            return (
              <path
                key={region.id}
                d={musclePaths[region.id]}
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
