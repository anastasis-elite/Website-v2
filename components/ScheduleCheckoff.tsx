'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ScheduleEvent } from '@/lib/schedule/types'
import { announceCalendarChange } from '@/lib/calendar/client'
import styles from './schedule-checkoff.module.css'

type Attempt = { completed: boolean; expectedRevision: number; operationId: string }

export default function ScheduleCheckoff({ event, date, timezone, unavailable = false }: {
  event: ScheduleEvent; date: string; timezone: string; unavailable?: boolean
}) {
  const router = useRouter()
  const [saved, setSaved] = useState(event.checkoff)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const lock = useRef(false)
  const attempt = useRef<Attempt | null>(null)
  useEffect(() => {
    if (!lock.current) setSaved(event.checkoff)
  }, [event.checkoff])
  const completed = saved?.completed ?? event.status === 'completed'
  const final = ['cancelled', 'skipped'].includes(event.status) || (event.status === 'completed' && !saved?.revision)
  async function save() {
    if (lock.current || unavailable || final) return
    lock.current = true
    setSaving(true)
    setMessage('')
    try {
      // Keep the same desired state and operation after a lost response.
      attempt.current ||= { completed: !completed, expectedRevision: saved?.revision ?? 0, operationId: crypto.randomUUID() }
      const response = await fetch('/api/schedule/checkoff', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: event.id, date, timezone, ...attempt.current }),
      })
      const data = await response.json()
      if (!response.ok) {
        if (response.status === 409) {
          attempt.current = null
          router.refresh()
        }
        throw new Error(data.error || 'Could not save. Try again.')
      }
      setSaved(data.checkoff)
      attempt.current = null
      announceCalendarChange()
      window.dispatchEvent(new Event('anastasis:daily-plan-updated'))
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save. Try again.')
    } finally {
      lock.current = false
      setSaving(false)
    }
  }
  return <div className={styles.control}>
    <label className={styles.target} title={unavailable ? 'Saved check-offs are unavailable. Refresh to try again.' : undefined}>
      <input type="checkbox" checked={completed} disabled={saving || unavailable || final} onChange={() => void save()}
        aria-label={`${completed ? 'Undo completion of' : 'Complete'} ${event.title}`} aria-busy={saving} />
    </label>
    {message ? <p role="alert">{message}</p> : null}
  </div>
}
