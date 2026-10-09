'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import type { DailyScheduleState, ScheduleEvent } from '@/lib/schedule/types'
import { formatLocalTime } from '@/lib/schedule/time'
import DailyPlanCard from '@/components/DailyPlanCard'
import ScheduleEventActions from '@/components/ScheduleEventActions'
import { zonedDateTimeToUtc } from '@/lib/schedule/time'

function eventLabel(event: ScheduleEvent) {
  if (event.flexibility_type === 'fixed') return 'Fixed'
  if (event.flexibility_type === 'approval_required') return 'Approval'
  return 'Flexible'
}

function defaultLocalValue(date: string, time = '09:00') {
  return `${date}T${time}`
}

export default function ScheduleDashboardClient({
  initialSchedule,
  clientId,
}: {
  initialSchedule: DailyScheduleState
  clientId: string
}) {
  const router = useRouter()
  const submitLock = useRef(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    title: '',
    event_type: 'custom',
    flexibility_type: 'flexible',
    priority: 'medium',
    start_at: defaultLocalValue(initialSchedule.date),
    end_at: defaultLocalValue(initialSchedule.date, '09:30'),
  })

  async function saveEvent(event: React.FormEvent) {
    event.preventDefault()
    if (submitLock.current) return
    submitLock.current = true
    setSaving(true)
    setError('')
    try {
      const response = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          client_id: clientId,
          start_at: zonedDateTimeToUtc(form.start_at.split('T')[0], form.start_at.split('T')[1], initialSchedule.timezone).toISOString(),
          end_at: zonedDateTimeToUtc(form.end_at.split('T')[0], form.end_at.split('T')[1], initialSchedule.timezone).toISOString(),
          timezone: initialSchedule.timezone,
        }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Event could not be saved.')
      setForm((current) => ({ ...current, title: '' }))
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Event could not be saved.')
    } finally {
      submitLock.current = false
      setSaving(false)
    }
  }


  const schedule = initialSchedule

  return (
    <main className="schedule-page">
      <div className="schedule-shell">
        <header className="schedule-hero"><div><p className="schedule-label">{schedule.date} · {schedule.timezone}</p><h1>Your day, with room to breathe</h1><p>Fixed commitments stay in place. Flexible actions can move or be skipped today.</p></div></header>
        {schedule.dailyRecommendation ? <DailyPlanCard plan={schedule.dailyRecommendation} compact /> : null}
        {error ? <p role="alert">{error}</p> : null}
        <section className="schedule-grid">
          <div className="schedule-panel">
            <div className="schedule-section-heading">
              <p className="schedule-label">Timeline</p>
              <span>{schedule.date}</span>
            </div>
            <div className="schedule-timeline">
              {schedule.events.filter(event => !['skipped','cancelled'].includes(event.status)).map((event) => (
                <article id={`event-${event.id}`} className={`schedule-event schedule-${event.flexibility_type}`} key={event.id}>
                  <time>{formatLocalTime(event.adjusted_start_at || event.start_at, schedule.timezone)}{event.adjusted_start_at ? <small>Originally {formatLocalTime(event.start_at, schedule.timezone)}</small> : null}</time>
                  <div>
                    <h3>{event.title}</h3>
                    <p>{event.description || event.event_type.replaceAll('_', ' ')}</p>
                    <div>
                      <span>{eventLabel(event)}</span>
                      <span>{event.suggested ? 'Suggested time' : event.status}</span>
                    </div>
                  </div>
                  <ScheduleEventActions event={event} program={schedule.program} timezone={schedule.timezone} suggestion={schedule.adjustments.find(item => item.event_id === event.id && !item.applied)} />
                </article>
              ))}
            </div>
          </div>

          <aside className="schedule-panel"><details><summary>Add a commitment or action</summary>
            <div className="schedule-section-heading">
              <p className="schedule-label">Add Event</p>
            </div>
            <form className="schedule-form" onSubmit={saveEvent}>
              <label>
                Title
                <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
              </label>
              <label>
                Type
                <select value={form.event_type} onChange={(event) => setForm({ ...form, event_type: event.target.value })}>
                  {['workout','meal','hydration','recovery','check_in','assessment','work','school','appointment','medical','dental','personal','household','sleep','custom'].map((type) => <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>)}
                </select>
              </label>
              <label>
                Flexibility
                <select value={form.flexibility_type} onChange={(event) => setForm({ ...form, flexibility_type: event.target.value })}>
                  <option value="flexible">Flexible</option>
                  <option value="fixed">Fixed</option>
                  <option value="approval_required">Suggestible</option>
                </select>
              </label>
              <label>
                Priority
                <select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </label>
              <label>
                Start
                <input type="datetime-local" value={form.start_at} onChange={(event) => setForm({ ...form, start_at: event.target.value })} required />
              </label>
              <label>
                End
                <input type="datetime-local" value={form.end_at} onChange={(event) => setForm({ ...form, end_at: event.target.value })} required />
              </label>
              <button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Add Event'}</button>
              {error ? <p role="alert">{error}</p> : null}
            </form>
          </details></aside>
        </section>
      </div>
    </main>
  )
}
