'use client'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { DailyScheduleState, ScheduleEvent, ScheduleAdjustment } from '@/lib/schedule/types'
import { getActionRouteForEvent } from '@/lib/schedule/engine'
import { getScheduleEventCapabilities, healthEventTypes, scheduleEventVersion } from '@/lib/schedule/actions'
import { formatLocalTime, zonedDateTimeToUtc } from '@/lib/schedule/time'
import { getLocalMinutes, localDateKey } from '@/lib/timezone'
import { announceCalendarChange } from '@/lib/calendar/client'
import { scheduleStructureTaskHref } from '@/lib/assessment/scheduleStructure'

type Action = 'skip' | 'move' | 'complete' | 'dismiss'
type Attempt = { action: Action; start_at?: string; end_at?: string }
export default function ScheduleEventActions({ event, timezone, program = 'ignite', suggestion, canChangeTime = true, date, onSaved }: {
  event: ScheduleEvent; timezone: string; program?: string; suggestion?: ScheduleAdjustment; canChangeTime?: boolean; date?: string
  onSaved?: (event: ScheduleEvent, schedule?: DailyScheduleState) => void
}) {
  const router = useRouter(), lock = useRef(false)
  const timeInput = useRef<HTMLInputElement>(null)
  const [savedEvent, setSavedEvent] = useState(event)
  useEffect(() => { setSavedEvent(event); setFailed(null); setConfirmation(null) }, [event])
  const [saving, setSaving] = useState(false), [message, setMessage] = useState(''), [moving, setMoving] = useState(false)
  const [confirmation, setConfirmation] = useState<'skip' | 'dismiss' | null>(null)
  const [failed, setFailed] = useState<Attempt | null>(null)
  const initial = suggestion?.suggested_start_at || event.adjusted_start_at || event.start_at
  const localValue = (instant: string) => {
    const at = new Date(instant), minute = getLocalMinutes(at, timezone)
    return `${localDateKey(at, timezone)}T${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`
  }
  const [local, setLocal] = useState(() => localValue(initial))
  useEffect(() => { if (!moving) setLocal(localValue(initial)) }, [initial, timezone, moving]) // eslint-disable-line react-hooks/exhaustive-deps
  const capabilities = getScheduleEventCapabilities(savedEvent)
  const day = date || localDateKey(new Date(), timezone)
  async function mutate(action: Action, start_at?: string, end_at?: string) {
    if (lock.current) return
    lock.current = true; setSaving(true); setMessage(''); setFailed(null)
    try {
      const url = action === 'dismiss' ? '/api/schedule/dismiss' : event.virtual ? '/api/schedule/plan' :
        `/api/schedule/${encodeURIComponent(event.id)}${action === 'move' ? '/defer' : action === 'complete' ? '/complete' : ''}`
      const response = await fetch(url, { method: !event.virtual && action === 'skip' ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: event.id, date: day, action, ...(action === 'skip' ? { status: 'skipped' } : {}),
          expected_version: scheduleEventVersion(savedEvent), start_at, end_at }) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        if (response.status === 409) router.refresh()
        throw new Error(data.error || 'Change could not be saved. Try again.')
      }
      if (!data.event) throw new Error('The saved outcome could not be confirmed. Refresh before trying again.')
      setSavedEvent(data.event); setMoving(false); setConfirmation(null)
      setMessage(action === 'skip' ? 'Skipped. This does not count as completed.' : action === 'dismiss' ? 'Dismissed from Today. Your calendar event is unchanged.' : action === 'move' ? 'New time saved.' : 'Completion saved.')
      onSaved?.(data.event, data.schedule)
      announceCalendarChange(); router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Change could not be saved. Try again.')
      setFailed({ action, start_at, end_at })
    } finally { lock.current = false; setSaving(false) }
  }
  function move() {
    try {
      const [selectedDate, time] = (timeInput.current?.value || local).split('T'), start = zonedDateTimeToUtc(selectedDate, time, timezone)
      const requested = time.split(':').map(Number)
      if (localDateKey(start, timezone) !== selectedDate || getLocalMinutes(start, timezone) !== requested[0] * 60 + requested[1]) throw new Error('That local time does not exist because the clocks change. Choose another time.')
      const duration = event.adjusted_duration_minutes || event.estimated_duration_minutes ||
        (Date.parse(event.adjusted_end_at || event.end_at) - Date.parse(event.adjusted_start_at || event.start_at)) / 60000
      void mutate('move', start.toISOString(), new Date(start.getTime() + duration * 60000).toISOString())
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Choose a valid time.') }
  }
  const done = ['completed', 'skipped', 'cancelled'].includes(savedEvent.status)
  const reviewHref = savedEvent.status === 'completed' ? scheduleStructureTaskHref(savedEvent) : null
  const health = healthEventTypes.has(savedEvent.event_type)
  return <div className="schedule-event-actions" aria-busy={saving} data-event-id={event.id}>
    {done ? <><span>{savedEvent.status === 'completed' ? 'Done' : savedEvent.status === 'skipped' ? 'Skipped' : 'Cancelled'}</span>
      {reviewHref ? <Link className="tier-secondary-action" href={reviewHref}>Review assessment</Link> : null}</> : <>
      {capabilities.isInformational ? <Link className="tier-secondary-action" href={getActionRouteForEvent(savedEvent, program)}>Open Event</Link> : null}
      {capabilities.canComplete ? <button type="button" className="tier-primary-action" disabled={saving} onClick={() => void mutate('complete')}>Complete</button> : null}
      {capabilities.canSkip ? <button type="button" disabled={saving} onClick={() => setConfirmation('skip')}>Skip</button> : null}
      {capabilities.canReschedule && canChangeTime ? <button type="button" disabled={saving} onClick={() => { setMoving(!moving); setConfirmation(null) }}>Reschedule</button> : null}
      {capabilities.canDismiss ? <button type="button" disabled={saving} onClick={() => setConfirmation('dismiss')}>Dismiss from Today</button> : null}
      {savedEvent.dismissed_from_today ? <span>Dismissed from Today</span> : null}
      {health && !capabilities.isInformational ? <><Link className="tier-secondary-action" href={getActionRouteForEvent(savedEvent, program)}>Open activity</Link><small>Save through the activity above to record completion.</small></> : null}
      {!health && !capabilities.isInformational && !capabilities.canReschedule && !done ? <small>Fixed commitment. Edit its time in Daily Structure. You can record its outcome here.</small> : null}
      {suggestion && capabilities.canReschedule ? <small>{suggestion.reason}{suggestion.suggested_start_at ? ` Suggested: ${formatLocalTime(suggestion.suggested_start_at, timezone)}.` : ''}</small> : null}
    </>}
    {confirmation ? <div className="schedule-confirmation" role="group" aria-label={confirmation === 'skip' ? 'Confirm skip' : 'Confirm dismissal'}>
      <p>{confirmation === 'skip' ? `Skip “${event.title}”? It stays in your history and will not count as completed.` : `Dismiss “${event.title}” from Today? Its calendar record and busy time will stay unchanged.`}</p>
      <button type="button" disabled={saving} onClick={() => void mutate(confirmation)}>{confirmation === 'skip' ? 'Confirm skip' : 'Confirm dismissal'}</button>
      <button type="button" disabled={saving} onClick={() => setConfirmation(null)}>Cancel</button>
    </div> : null}
    {moving && canChangeTime ? <div><label>New time ({timezone})<input ref={timeInput} type="datetime-local" value={local} onChange={e => setLocal(e.target.value)} /></label>
      <p>Save this time for “{event.title}”.</p><button type="button" disabled={saving} onClick={move}>Save new time</button>
      <button type="button" disabled={saving} onClick={() => setMoving(false)}>Cancel</button></div> : null}
    {message || saving ? <p role={failed ? 'alert' : 'status'} aria-live="polite">{saving ? 'Saving…' : message}</p> : null}
    {failed ? <button type="button" disabled={saving} onClick={() => void mutate(failed.action, failed.start_at, failed.end_at)}>Retry</button> : null}
  </div>
}
