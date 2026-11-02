'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createPracticeTimeline, getPracticeFrame, practices, type PracticeId } from '@/lib/meditation/practiceTiming'

function durationLabel(durationMs: number) {
  const seconds = durationMs / 1000
  const minutes = Math.floor(seconds / 60)
  return seconds % 60 === 0 ? `${minutes} min` : `${minutes}m ${seconds % 60}s`
}

function countdown(durationMs: number) {
  // Show tenths for the half-second endpoint without ever displaying an early zero.
  const tenths = Math.ceil(durationMs / 100)
  const seconds = Math.floor(tenths / 10)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}.${tenths % 10}`
}

export default function MeditationPractice({ clientId, initialPractice }: { clientId: string; initialPractice: string }) {
  const router = useRouter()
  const initial = Object.hasOwn(practices, initialPractice) ? initialPractice as PracticeId : 'breath-reset'
  const [practice, setPractice] = useState<PracticeId>(initial)
  const [skipHolds, setSkipHolds] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [running, setRunning] = useState(false)
  const [started, setStarted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [message, setMessage] = useState('')
  const lock = useRef(false)
  const savedRef = useRef(false)
  const clock = useRef<{ elapsedMs: number; startedAt: number | null }>({ elapsedMs: 0, startedAt: null })
  const timeline = useMemo(() => createPracticeTimeline(practice, skipHolds), [practice, skipHolds])
  const current = practices[practice]
  const paced = practice === 'breath-reset' || practice === 'sleep-wind-down'
  const frame = getPracticeFrame(timeline, elapsedMs)
  const remainingMs = Math.max(0, timeline.durationMs - elapsedMs)
  const canComplete = paced ? frame.finished : elapsedMs >= 120000

  function readElapsed() {
    const { elapsedMs: previous, startedAt } = clock.current
    return Math.min(timeline.durationMs, previous + (startedAt === null ? 0 : Math.max(0, performance.now() - startedAt)))
  }

  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => {
      const { elapsedMs: previous, startedAt } = clock.current
      const next = Math.min(timeline.durationMs, previous + (startedAt === null ? 0 : Math.max(0, performance.now() - startedAt)))
      setElapsedMs(next)
      if (next >= timeline.durationMs) {
        clock.current = { elapsedMs: timeline.durationMs, startedAt: null }
        setRunning(false)
      }
    }, 50)
    return () => window.clearInterval(timer)
  }, [running, timeline.durationMs])

  function reset() {
    if (lock.current) return
    clock.current = { elapsedMs: 0, startedAt: null }
    savedRef.current = false
    setElapsedMs(0)
    setRunning(false)
    setSaved(false)
    setMessage('')
  }

  function choose(next: PracticeId) {
    if (lock.current) return
    reset()
    setPractice(next)
    setStarted(false)
  }

  function toggleRunning() {
    if (lock.current || savedRef.current) return
    const next = readElapsed()
    setElapsedMs(next)
    if (clock.current.startedAt !== null) {
      clock.current = { elapsedMs: next, startedAt: null }
      setRunning(false)
    } else if (next < timeline.durationMs) {
      clock.current = { elapsedMs: next, startedAt: performance.now() }
      setRunning(true)
    }
  }

  async function complete() {
    const actualMs = readElapsed()
    if (lock.current || savedRef.current || (paced ? actualMs < timeline.durationMs : actualMs < 120000)) return
    lock.current = true
    clock.current = { elapsedMs: actualMs, startedAt: null }
    setElapsedMs(actualMs)
    setRunning(false)
    setSaving(true)
    setMessage('')
    try {
      const response = await fetch('/api/recovery/activity', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId, activityType: practice === 'breath-reset' ? 'Breathwork' : 'Meditation', minutes: Math.floor(actualMs / 60000),
          ...(paced ? { practiceId: practice, elapsedMs: actualMs, skipHolds } : {}),
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || payload?.success !== true) throw new Error(payload?.error || 'Your practice could not be confirmed. Check your connection and retry.')
      savedRef.current = true
      setSaved(true)
      setMessage('Practice logged.')
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Your practice could not be saved. Retry when connected.')
    } finally {
      lock.current = false
      setSaving(false)
    }
  }

  return <div className="meditation-practice">
    {!started ? <>
      <nav className="meditation-options" aria-label="Meditation types">
        {(Object.keys(practices) as PracticeId[]).map(item => <button type="button" key={item} aria-pressed={item === practice} onClick={() => choose(item)}>
          <span className="detail-symbol" aria-hidden="true">{practices[item].icon}</span>
          <span><strong>{practices[item].title}</strong><small>{practices[item].copy}</small>{item === practice ? <span className="meditation-selected">✓ Selected</span> : null}</span>
          <span className="meditation-duration">{durationLabel(createPracticeTimeline(item, skipHolds).durationMs)}</span>
        </button>)}
      </nav>
      {paced ? <label className="meditation-hold-option"><input type="checkbox" checked={skipHolds} onChange={event => setSkipHolds(event.target.checked)} /> Skip holds after exhaling</label> : null}
      <button className="detail-action" type="button" onClick={() => { setStarted(true); toggleRunning() }}>Start practice</button>
    </> : <section className="detail-panel meditation-timer-panel">
      <h2>{current.title}</h2><p>{durationLabel(timeline.durationMs)} practice{paced && skipHolds ? ' · holds skipped' : ''}</p>
      <div className="meditation-orbit" aria-hidden="true" style={{ transform: `scale(${frame.orbScale})` }}><span>{frame.finished ? 'Finished' : frame.phase}</span></div>
      <p className="meditation-phase" role="status" aria-live="polite" aria-atomic="true">{frame.finished ? 'Finished' : `${running ? '' : 'Paused · '}${frame.phase}${frame.phase === 'Hold' ? ' after exhaling' : ''}${timeline.rounds ? ` · Round ${frame.round} of ${timeline.rounds}` : ''}`}</p>
      {!frame.finished ? <p className="meditation-phase-countdown" role="timer" aria-label="Current phase time remaining">{(Math.ceil(frame.phaseRemainingMs / 100) / 10).toFixed(1)}s</p> : null}
      <strong className="meditation-timer" role="timer" aria-label="Session time remaining">{countdown(remainingMs)}</strong>
      <div className="meditation-controls">
        <button type="button" disabled={saving || saved || frame.finished} onClick={toggleRunning}>{running ? 'Pause' : 'Continue'}</button>
        <button type="button" disabled={saving} onClick={reset}>Reset</button>
        <button type="button" disabled={saving || saved || !canComplete} onClick={complete}>{saving ? 'Saving…' : saved ? 'Logged' : 'Complete'}</button>
      </div>
      {!canComplete ? <p className="detail-note">{paced ? 'Logging opens after the final round.' : 'Logging opens after two minutes of practice.'}</p> : null}
      <p className="detail-note">Logs record only full minutes practiced.</p>
      <button type="button" className="detail-action" disabled={saving} onClick={() => choose(practice)}>{frame.finished ? 'Choose another practice' : 'Stop practice'}</button>
    </section>}
    <p className="detail-note">Breathe gently at a comfortable pace. Pause or stop and return to normal breathing if uncomfortable.</p>
    <small className="detail-note">Silent timer and visual breathing prompts. Guided audio is unavailable.</small>
    {message ? <p role="status">{message}</p> : null}
  </div>
}
