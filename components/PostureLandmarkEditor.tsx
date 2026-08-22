'use client'

import Image from 'next/image'
import { useCallback, useMemo, useRef, useState } from 'react'
import { AOSButton } from '@/components/aos-ui/AOSButton'
import {
  POSTURE_VIEW_LABELS,
  connectionsForView,
  type AssessmentView,
  type NormalizedPoint,
  type PoseDetectionResult,
  type PostureLandmark,
  type PostureLandmarkName,
} from '@/lib/posture/landmarks'
import { clamp01, pointChanged } from '@/lib/posture/geometry'
import { estimatePostureLandmarks } from '@/lib/posture/poseDetection'

type Props = {
  assessmentPhotoId: string
  view: AssessmentView
  imageUrl: string
  path: string
  onConfirmed: () => void
}

type HistoryEntry = {
  name: PostureLandmarkName
  previous: NormalizedPoint | null
}

function visiblePoint(landmark: PostureLandmark) {
  return landmark.visible && landmark.confirmed
}

export default function PostureLandmarkEditor({
  assessmentPhotoId,
  view,
  imageUrl,
  path,
  onConfirmed,
}: Props) {
  const imageRef = useRef<HTMLImageElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'saved'>('loading')
  const [message, setMessage] = useState('Locating your posture landmarks...')
  const [result, setResult] = useState<PoseDetectionResult | null>(null)
  const [activeName, setActiveName] = useState<PostureLandmarkName | null>(null)
  const [draggingName, setDraggingName] = useState<PostureLandmarkName | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 })

  const landmarks = useMemo(() => result?.landmarks || [], [result?.landmarks])
  const activeLandmark = landmarks.find((landmark) => landmark.name === activeName) || null
  const landmarkMap = useMemo(
    () => new Map(landmarks.map((landmark) => [landmark.name, landmark])),
    [landmarks],
  )

  const runDetection = useCallback(async () => {
    const image = imageRef.current
    if (!image) return

    setStatus('loading')
    setMessage('Locating your posture landmarks...')
    setImageSize({
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
    })

    const detection = await estimatePostureLandmarks(image, view)
    setResult(detection)
    const firstReviewPoint = detection.landmarks.find((landmark) => landmark.visible && landmark.lowConfidence)
      || detection.landmarks.find((landmark) => landmark.visible)
      || null
    setActiveName(firstReviewPoint?.name || null)
    setStatus('ready')

    if (detection.status === 'multiple_people') {
      setMessage('More than one person may be visible. Use a solo photo when possible, or correct the points manually.')
    } else {
      setMessage("We've estimated your posture landmarks. Adjust any point that doesn't line up with your body.")
    }
  }, [view])

  function updateLandmark(name: PostureLandmarkName, point: NormalizedPoint | null, trackHistory = true) {
    setResult((current) => {
      if (!current) return current
      const previous = current.landmarks.find((landmark) => landmark.name === name)?.confirmed || null
      if (trackHistory) setHistory((items) => [...items, { name, previous }].slice(-25))

      return {
        ...current,
        landmarks: current.landmarks.map((landmark) => landmark.name === name
          ? {
              ...landmark,
              confirmed: point,
              manuallyAdjusted: pointChanged(point, landmark.automatic),
              lowConfidence: !point || landmark.lowConfidence,
            }
          : landmark),
      }
    })
  }

  function pointFromEvent(event: React.PointerEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return null
    return {
      x: clamp01((event.clientX - rect.left) / rect.width),
      y: clamp01((event.clientY - rect.top) / rect.height),
    }
  }

  function handleSvgPointerDown(event: React.PointerEvent<SVGSVGElement>) {
    if (!activeName || draggingName) return
    if ((event.target as Element).tagName.toLowerCase() !== 'svg') return
    const point = pointFromEvent(event)
    if (!point) return
    updateLandmark(activeName, point)
  }

  function startDrag(name: PostureLandmarkName, event: React.PointerEvent<SVGCircleElement>) {
    event.preventDefault()
    event.stopPropagation()
    setActiveName(name)
    setDraggingName(name)
    event.currentTarget.setPointerCapture(event.pointerId)
    const previous = landmarkMap.get(name)?.confirmed || null
    setHistory((items) => [...items, { name, previous }].slice(-25))
  }

  function moveDrag(event: React.PointerEvent<SVGCircleElement>) {
    if (!draggingName) return
    const point = pointFromEvent(event as unknown as React.PointerEvent<SVGSVGElement>)
    if (!point) return
    updateLandmark(draggingName, point, false)
  }

  function stopDrag(event: React.PointerEvent<SVGCircleElement>) {
    if (!draggingName) return
    event.currentTarget.releasePointerCapture(event.pointerId)
    setDraggingName(null)
  }

  function undo() {
    const last = history[history.length - 1]
    if (!last) return
    setHistory((items) => items.slice(0, -1))
    updateLandmark(last.name, last.previous, false)
    setActiveName(last.name)
  }

  function resetAutomatic() {
    if (!activeLandmark) return
    updateLandmark(activeLandmark.name, activeLandmark.automatic)
  }

  function clearPoint() {
    if (!activeLandmark) return
    updateLandmark(activeLandmark.name, null)
  }

  async function confirm() {
    if (!result) return
    setStatus('saving')
    setMessage('Saving confirmed landmarks...')

    const res = await fetch('/api/assessment-photos/landmarks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assessmentPhotoId,
        path,
        view,
        imageWidth: imageSize.width,
        imageHeight: imageSize.height,
        detectionStatus: result.status,
        detectionMessage: result.message || null,
        rawLandmarks: result.rawLandmarks,
        landmarks: result.landmarks,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setStatus('ready')
      setMessage(data?.error || 'Landmarks could not be saved.')
      return
    }

    setStatus('saved')
    setMessage('Landmarks confirmed.')
    onConfirmed()
  }

  const uncertainCount = landmarks.filter((landmark) => landmark.visible && landmark.lowConfidence).length

  return (
    <section className="aos-landmark-editor" aria-label={`${POSTURE_VIEW_LABELS[view]} landmark editor`}>
      <div className="aos-landmark-editor__header">
        <div>
          <p className="aos-eyebrow">{POSTURE_VIEW_LABELS[view]} view</p>
          <h3>Confirm posture landmarks</h3>
        </div>
        <p role="status">{message}</p>
      </div>

      <div className="aos-landmark-workspace">
        <div className="aos-landmark-image-wrap">
          <Image
            ref={imageRef}
            src={imageUrl}
            alt={`${POSTURE_VIEW_LABELS[view]} posture assessment photo`}
            width={900}
            height={1200}
            unoptimized
            className="aos-landmark-image"
            onLoad={runDetection}
          />
          {result ? (
            <svg
              ref={svgRef}
              className="aos-landmark-overlay"
              viewBox="0 0 1 1"
              preserveAspectRatio="none"
              onPointerDown={handleSvgPointerDown}
              aria-label="Editable posture landmark overlay"
            >
              {connectionsForView(view).map(([from, to]) => {
                const a = landmarkMap.get(from)
                const b = landmarkMap.get(to)
                if (!a || !b || !visiblePoint(a) || !visiblePoint(b)) return null
                return (
                  <line
                    key={`${from}-${to}`}
                    x1={a.confirmed!.x}
                    y1={a.confirmed!.y}
                    x2={b.confirmed!.x}
                    y2={b.confirmed!.y}
                    vectorEffect="non-scaling-stroke"
                  />
                )
              })}
              {landmarks.filter((landmark) => landmark.visible && landmark.confirmed).map((landmark) => (
                <circle
                  key={landmark.name}
                  cx={landmark.confirmed!.x}
                  cy={landmark.confirmed!.y}
                  r={activeName === landmark.name ? 0.022 : 0.017}
                  vectorEffect="non-scaling-stroke"
                  className={[
                    'aos-landmark-point',
                    activeName === landmark.name ? 'is-active' : '',
                    landmark.lowConfidence ? 'is-uncertain' : '',
                  ].filter(Boolean).join(' ')}
                  role="button"
                  aria-label={`Drag ${landmark.label}`}
                  tabIndex={0}
                  onPointerDown={(event) => startDrag(landmark.name, event)}
                  onPointerMove={moveDrag}
                  onPointerUp={stopDrag}
                  onPointerCancel={stopDrag}
                />
              ))}
            </svg>
          ) : null}
        </div>

        <aside className="aos-landmark-panel">
          {status === 'loading' ? <p className="aos-landmark-note">Locating your posture landmarks...</p> : null}
          {uncertainCount ? <p className="aos-landmark-warning">{uncertainCount} point{uncertainCount === 1 ? '' : 's'} need closer review.</p> : null}
          <div className="aos-landmark-active">
            <strong>{activeLandmark?.label || 'Select a landmark'}</strong>
            <span>{activeLandmark?.confirmed ? 'Drag the point on the photo to adjust it.' : 'Tap the photo to place this point.'}</span>
          </div>
          <div className="aos-landmark-controls">
            <button type="button" onClick={undo} disabled={!history.length || status !== 'ready'}>Undo</button>
            <button type="button" onClick={resetAutomatic} disabled={!activeLandmark || status !== 'ready'}>Reset</button>
            <button type="button" onClick={clearPoint} disabled={!activeLandmark || status !== 'ready'}>Clear</button>
          </div>
          <div className="aos-landmark-list">
            {landmarks.filter((landmark) => landmark.visible).map((landmark) => (
              <button
                type="button"
                key={landmark.name}
                className={activeName === landmark.name ? 'is-active' : ''}
                onClick={() => setActiveName(landmark.name)}
              >
                <span>{landmark.label}</span>
                <small>
                  {landmark.manuallyAdjusted ? 'Adjusted' : landmark.lowConfidence ? 'Review' : 'Estimated'}
                </small>
              </button>
            ))}
          </div>
          <AOSButton type="button" onClick={confirm} disabled={!result || status === 'loading' || status === 'saving'}>
            {status === 'saving' ? 'Saving...' : 'Confirm landmarks'}
          </AOSButton>
        </aside>
      </div>
    </section>
  )
}
