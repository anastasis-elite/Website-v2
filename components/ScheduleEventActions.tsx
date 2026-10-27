'use client'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ScheduleEvent, ScheduleAdjustment } from '@/lib/schedule/types'
import { getActionRouteForEvent } from '@/lib/schedule/engine'
import { healthEventTypes } from '@/lib/schedule/actions'
import { formatLocalTime, zonedDateTimeToUtc } from '@/lib/schedule/time'
import { getLocalMinutes, localDateKey } from '@/lib/timezone'
import { announceCalendarChange } from '@/lib/calendar/client'
import { scheduleStructureTaskHref } from '@/lib/assessment/scheduleStructure'
export default function ScheduleEventActions({ event, timezone, program = 'ignite', suggestion, canChangeTime = true }: { event: ScheduleEvent; timezone: string; program?: string; suggestion?: ScheduleAdjustment; canChangeTime?: boolean }) {
  const router = useRouter(); const lock = useRef(false); const [saving, setSaving] = useState(false); const [message, setMessage] = useState(''); const [moving, setMoving] = useState(false)
  const moveDialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = moveDialog.current
    if (moving && dialog && !dialog.open) dialog.showModal()
    else if (!moving && dialog?.open) dialog.close()
  }, [moving])
  const initial = suggestion?.suggested_start_at || event.adjusted_start_at || event.start_at
  const minute = getLocalMinutes(new Date(initial), timezone)
  const [local, setLocal] = useState(`${localDateKey(new Date(initial), timezone)}T${String(Math.floor(minute/60)).padStart(2,'0')}:${String(minute%60).padStart(2,'0')}`)
  useEffect(() => {
    if (moving) return
    const at = new Date(initial), minutes = getLocalMinutes(at, timezone)
    setLocal(`${localDateKey(at, timezone)}T${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`)
  }, [initial, timezone, moving])
  async function mutate(action: 'skip' | 'move' | 'complete', start_at?: string, end_at?: string) {
    if (lock.current) return; lock.current = true; setSaving(true); setMessage('')
    try {
      const response = await fetch(event.virtual ? '/api/schedule/plan' : `/api/schedule/${event.id}${action === 'move' ? '/defer' : action === 'complete' ? '/complete' : ''}`, {
        method: event.virtual || action !== 'skip' ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event.virtual ? { eventId: event.id, action, start_at, end_at } : action === 'skip' ? { status: 'skipped' } : { start_at, end_at }) })
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Change could not be saved.')
      setMessage(action === 'skip' ? 'Skipped for today.' : action === 'move' ? 'New time saved.' : 'Completed.'); setMoving(false); announceCalendarChange(); router.refresh()
    } catch(e) { setMessage(e instanceof Error ? e.message : 'Change could not be saved.') }
    finally { lock.current = false; setSaving(false) }
  }
  function move() {
    try {
      const [date, time] = local.split('T'); const start = zonedDateTimeToUtc(date, time, timezone)
      const requested = time.split(':').map(Number); if (localDateKey(start, timezone) !== date || getLocalMinutes(start, timezone) !== requested[0]*60+requested[1]) throw new Error('That local time does not exist because the clocks change. Choose another time.')
      const duration = event.adjusted_duration_minutes || event.estimated_duration_minutes || (new Date(event.adjusted_end_at || event.end_at).getTime() - new Date(event.adjusted_start_at || event.start_at).getTime())/60000
      void mutate('move', start.toISOString(), new Date(start.getTime() + duration*60000).toISOString())
    } catch(e) { setMessage(e instanceof Error ? e.message : 'Choose a time.') }
  }
  const acceptedStart = suggestion ? suggestion.suggested_start_at : event.suggested ? event.start_at : null, acceptedEnd = suggestion ? suggestion.suggested_end_at : event.suggested ? event.end_at : null
  const commitment = event.virtual && event.flexibility_type === 'fixed'
  const done = ['completed','skipped','cancelled'].includes(event.status); const health = healthEventTypes.has(event.event_type)
  const reviewHref = event.status === 'completed' ? scheduleStructureTaskHref(event) : null
  return <div className="schedule-event-actions">
    {done ? <>
      <span>{event.status === 'completed' ? 'Done' : event.status === 'cancelled' ? 'Cancelled' : 'Skipped today'}</span>
      {reviewHref ? <Link className="tier-secondary-action" href={reviewHref}>Review assessment</Link> : null}
    </> : <>
      <Link className="tier-secondary-action" href={getActionRouteForEvent(event, program)}>{commitment ? 'Edit commitment' : health ? 'Open activity' : 'View details'}</Link>
      {!health && !event.virtual ? <button disabled={saving} onClick={() => void mutate('complete')}>Complete</button> : null}
      {event.flexibility_type === 'flexible' && event.movable && !event.approval_required ? <>{canChangeTime ? <button disabled={saving} onClick={() => setMoving(!moving)}>Move to later</button> : null}<button disabled={saving} onClick={() => void mutate('skip')}>Skip today</button></> : null}
      {commitment ? <small>Fixed commitment. Edit its time in Daily Structure.</small> : health ? <small>Save through the activity above to record completion.</small> : null}
      {suggestion ? <small>{suggestion.reason}{!acceptedStart ? ' No time has been placed on your calendar.' : ''}</small> : null}
      {canChangeTime && acceptedStart && acceptedEnd && !suggestion?.applied ? <button disabled={saving} onClick={() => void mutate('move', acceptedStart, acceptedEnd)}>Accept {formatLocalTime(acceptedStart, timezone)} suggestion</button> : null}
    </>}
    {canChangeTime && !done && event.flexibility_type === 'flexible' && event.movable && !event.approval_required ? <dialog ref={moveDialog} className="phone-app-reschedule" aria-label={`Reschedule ${event.title}`} onCancel={() => setMoving(false)} onClose={() => setMoving(false)}>
      <p className="phone-app-eyebrow">Reschedule</p><h2>Make room for it.</h2><p>Your plan can move with you.</p>
      <h3>{event.title}</h3><p>Currently {formatLocalTime(event.adjusted_start_at || event.start_at, timezone)}{event.adjusted_duration_minutes || event.estimated_duration_minutes ? ` · ${event.adjusted_duration_minutes || event.estimated_duration_minutes} minutes` : ''}</p>
      <label>Choose a day and time ({timezone})<input type="datetime-local" value={local} onChange={e => setLocal(e.target.value)}/></label>
      <p>Only this activity will move. Times from unconnected calendars are unavailable.</p>
      <div className="phone-app-reschedule-actions"><button className="tier-primary-action" disabled={saving} onClick={move}>Confirm new time</button><button disabled={saving} onClick={() => setMoving(false)}>Keep original time</button></div>
      <p role="status">{saving ? 'Saving…' : message}</p>
    </dialog> : null}
    <p role="status">{saving ? 'Saving…' : message}</p>
  </div>
}
