'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ScheduleEvent } from '@/lib/schedule/types'
import { announceCalendarChange } from '@/lib/calendar/client'
import styles from './schedule-checkoff.module.css'

type ResponseStatus = 'scheduled' | 'in_progress' | 'completed'
type Attempt = ({ completed: boolean } | { status: ResponseStatus }) & { expectedRevision: number; operationId: string }

export default function ScheduleCheckoff({ event, date, timezone, unavailable = false, expanded = false }: {
  event: ScheduleEvent; date: string; timezone: string; unavailable?: boolean; expanded?: boolean
}) {
  const router = useRouter()
  const [saved, setSaved] = useState(event.checkoff)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [retrying, setRetrying] = useState(false)
  const [failed, setFailed] = useState(false)
  const lock = useRef(false)
  const attempt = useRef<Attempt | null>(null)
  useEffect(() => {
    if (!lock.current) setSaved(event.checkoff)
  }, [event.checkoff])
  const completed = saved?.completed ?? event.status === 'completed'
  const inProgress = !completed && saved?.status === 'in_progress'
  const final = ['cancelled', 'skipped'].includes(event.status) || Boolean(event.checkoff?.authoritative) || (event.status === 'completed' && !saved?.revision)
  async function save(status?: ResponseStatus) {
    if (lock.current || unavailable || final) return
    lock.current = true
    setSaving(true)
    setMessage('')
    setFailed(false)
    try {
      // Keep the same desired state and operation after a lost response.
      attempt.current ||= { ...(status ? { status } : { completed: !completed }), expectedRevision: saved?.revision ?? 0, operationId: crypto.randomUUID() }
      const response = await fetch('/api/schedule/checkoff', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: event.id, date, timezone, ...attempt.current }),
      })
      const data = await response.json()
      if (!response.ok) {
        if (response.status === 409) {
          attempt.current = null
          setRetrying(false)
          router.refresh()
        }
        throw new Error(data.error || 'Could not save. Try again.')
      }
      setSaved(data.checkoff)
      attempt.current = null
      setRetrying(false)
      setMessage(data.checkoff.status === 'in_progress' ? 'In progress saved.' : data.checkoff.completed ? 'Completion saved.' : 'Response cleared.')
      announceCalendarChange()
      window.dispatchEvent(new Event('anastasis:daily-plan-updated'))
      router.refresh()
    } catch (error) {
      setFailed(true)
      setRetrying(Boolean(attempt.current))
      setMessage(error instanceof Error ? error.message : 'Could not save. Try again.')
    } finally {
      lock.current = false
      setSaving(false)
    }
  }
  const disabled = saving || unavailable || final
  return <div className={expanded ? styles.expanded : styles.control} aria-label={`Response for ${event.title}`}>
    {expanded ? <div className={styles.responses}>
      <button type="button" disabled={disabled || retrying || completed} aria-pressed={inProgress} onClick={() => void save('in_progress')}>In progress</button>
      <button type="button" disabled={disabled || retrying || completed} aria-pressed={completed} onClick={() => void save('completed')}>Completed</button>
    </div> : <>
    <label className={styles.target} title={unavailable ? 'Saved check-offs are unavailable. Refresh to try again.' : undefined}>
      <input type="checkbox" checked={completed} disabled={disabled || retrying && Boolean(attempt.current && 'status' in attempt.current)} onChange={() => void save()}
        aria-label={`${completed ? 'Undo completion of' : 'Complete'} ${event.title}`} aria-busy={saving} />
    </label>
    {!completed && !final ? <button className={styles.progress} type="button" disabled={disabled || retrying || inProgress} aria-pressed={inProgress} onClick={() => void save('in_progress')}>In progress</button> : null}
    </>}
    {retrying ? <button type="button" disabled={disabled} onClick={() => void save()}>Retry save</button> : null}
    {unavailable && expanded ? <p role="status">Saved responses are unavailable. Refresh to try again.</p> : null}
    {event.schedule_response_kind === 'breakfast' && expanded ? <p>This confirms breakfast only. Food and nutrition logs are saved separately.</p> : null}
    {message ? <p role={failed ? 'alert' : 'status'}>{message}</p> : null}
  </div>
}
