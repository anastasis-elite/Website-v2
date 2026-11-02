'use client'

import Image from 'next/image'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AOSButton } from '@/components/aos-ui/AOSButton'
import {
  POSTURE_VIEW_LABELS,
  connectionsForView,
  type AssessmentView,
  type NormalizedPoint,
  type PostureLandmark,
  type PostureLandmarkName,
} from '@/lib/posture/landmarks'
import { clamp01 } from '@/lib/posture/geometry'
import { createManualLandmarks, manualLandmarkSummary, updateManualLandmark, type ManualLandmarkConfirmation } from '@/lib/posture/manualLandmarks'

type Props = {
  assessmentPhotoId: string
  view: AssessmentView
  imageUrl: string
  path: string
  onConfirmed: (confirmation: ManualLandmarkConfirmation) => void
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
  const generation = useRef(0)
  const saveLock = useRef(false)
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'saved' | 'error'>('loading')
  const [message, setMessage] = useState('Loading your photo...')
  const [landmarks, setLandmarks] = useState(() => createManualLandmarks(view))
  const [activeName, setActiveName] = useState<PostureLandmarkName | null>(() => createManualLandmarks(view).find(landmark => landmark.visible)?.name || null)
  const [draggingName, setDraggingName] = useState<PostureLandmarkName | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 })

  const activeLandmark = landmarks.find((landmark) => landmark.name === activeName) || null
  const landmarkMap = useMemo(
    () => new Map(landmarks.map((landmark) => [landmark.name, landmark])),
    [landmarks],
  )

  const loadManualPhoto = useCallback(() => {
    const image = imageRef.current
    if (!image) return

    setImageSize({
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
    })

    setStatus('ready')
    setMessage('Select a named landmark, then tap the photo to place it. Leave points you cannot identify unplaced.')
  }, [])

  useEffect(() => {
    generation.current++
    const empty = createManualLandmarks(view)
    setLandmarks(empty)
    setActiveName(empty.find(landmark => landmark.visible)?.name || null)
    setDraggingName(null)
    setHistory([])
    setImageSize({ width: 0, height: 0 })
    setStatus('loading')
    setMessage('Loading your photo...')
    // A cached photo can load before this passive effect. Read only its actual
    // dimensions; manual landmarks still begin empty for every photo/view.
    if (imageRef.current?.complete && imageRef.current.naturalWidth > 0) loadManualPhoto()
    return () => { generation.current++ }
  }, [assessmentPhotoId, path, view, imageUrl, loadManualPhoto])

  function updateLandmark(name: PostureLandmarkName, point: NormalizedPoint | null, trackHistory = true) {
    if (status !== 'ready') return
    const previous = landmarks.find(landmark => landmark.name === name)?.confirmed || null
    if (trackHistory) setHistory(items => [...items, { name, previous }].slice(-25))
    setLandmarks(current => updateManualLandmark(current, name, point))
  }

  function pointFromEvent(event: React.PointerEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect || rect.width <= 0 || rect.height <= 0) return null
    return {
      x: clamp01((event.clientX - rect.left) / rect.width),
      y: clamp01((event.clientY - rect.top) / rect.height),
    }
  }

  function handleSvgPointerDown(event: React.PointerEvent<SVGSVGElement>) {
    if (status !== 'ready' || !activeName || draggingName) return
    if ((event.target as Element).tagName.toLowerCase() !== 'svg') return
    const point = pointFromEvent(event)
    if (!point) return
    updateLandmark(activeName, point)
  }

  function startDrag(name: PostureLandmarkName, event: React.PointerEvent<SVGCircleElement>) {
    if (status !== 'ready') return
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

  function resetManual() {
    if (status !== 'ready') return
    setLandmarks(createManualLandmarks(view))
    setHistory([])
    setDraggingName(null)
    setMessage('Manual points reset. Unplaced points remain unknown.')
  }

  function clearPoint() {
    if (!activeLandmark) return
    updateLandmark(activeLandmark.name, null)
  }

  async function confirm() {
    const summary = manualLandmarkSummary(landmarks)
    if (saveLock.current || status !== 'ready' || summary.confirmedCount === 0) return
    saveLock.current = true
    const requestGeneration = generation.current
    setStatus('saving')
    setMessage('Saving confirmed landmarks...')
    try {
      const res = await fetch('/api/assessment-photos/landmarks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assessmentPhotoId,
        path,
        view,
        imageWidth: imageSize.width,
        imageHeight: imageSize.height,
        detectionStatus: 'manual',
        rawLandmarks: [],
        landmarks,
      }),
    })

      const data = await res.json().catch(() => null)
      if (requestGeneration !== generation.current) return
      if (!res.ok || data?.success !== true || data.complete !== summary.complete || data.confirmedCount !== summary.confirmedCount || data.visibleCount !== summary.visibleCount) {
      setStatus('ready')
      setMessage(data?.error || 'Landmarks could not be saved.')
      return
      }

      setStatus('saved')
      setMessage(data.complete ? 'Manual landmarks confirmed for this view.' : `Saved ${summary.confirmedCount} of ${summary.visibleCount} visible landmarks. Unplaced points remain unknown.`)
      onConfirmed({ complete: data.complete, confirmedCount: data.confirmedCount, visibleCount: data.visibleCount })
    } catch {
      if (requestGeneration === generation.current) { setStatus('ready'); setMessage('Landmarks could not be saved. Your placed points are still here. Retry saving.') }
    } finally { saveLock.current = false }
  }

  const summary = manualLandmarkSummary(landmarks)

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
            onLoad={loadManualPhoto}
            onError={() => { setMessage('Your photo could not be loaded. Reopen it to try again.'); setStatus('error') }}
          />
          {status !== 'loading' && status !== 'error' ? (
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
          {status === 'loading' ? <p className="aos-landmark-note">Loading your photo...</p> : null}
          <p className="aos-landmark-note">Manual placement · {summary.confirmedCount} of {summary.visibleCount} visible landmarks placed. Unplaced points remain unknown. Left and right refer to your anatomy.</p>
          <div className="aos-landmark-active">
            <strong>{activeLandmark?.label || 'Select a landmark'}</strong>
            <span>{activeLandmark?.confirmed ? 'Drag the point on the photo to adjust it.' : 'Tap the photo to place this point.'}</span>
          </div>
          <div className="aos-landmark-controls">
            <button type="button" onClick={undo} disabled={!history.length || status !== 'ready'}>Undo</button>
            <button type="button" onClick={resetManual} disabled={!summary.confirmedCount || status !== 'ready'}>Reset manual points</button>
            <button type="button" onClick={clearPoint} disabled={!activeLandmark || status !== 'ready'}>Clear</button>
          </div>
          <div className="aos-landmark-list">
            {landmarks.filter((landmark) => landmark.visible).map((landmark) => (
              <button
                type="button"
                key={landmark.name}
                className={activeName === landmark.name ? 'is-active' : ''}
                onClick={() => setActiveName(landmark.name)}
                disabled={status !== 'ready'}
              >
                <span>{landmark.label}</span>
                <small>
                  {landmark.confirmed ? 'Placed manually' : 'Unplaced · unknown'}
                </small>
              </button>
            ))}
          </div>
          <AOSButton type="button" onClick={confirm} disabled={status !== 'ready' || !summary.confirmedCount}>
            {status === 'saving' ? 'Saving...' : summary.complete ? 'Confirm landmarks' : 'Save placed landmarks'}
          </AOSButton>
        </aside>
      </div>
    </section>
  )
}
