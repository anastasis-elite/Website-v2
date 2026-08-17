'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { DailyScheduleState, ScheduleEvent } from '@/lib/schedule/types'
import { formatLocalTime } from '@/lib/schedule/time'
import AdaptiveTodayForYou from '@/components/program-dashboard/AdaptiveTodayForYou'

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
    setSaving(true)
    setError('')
    try {
      const response = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          client_id: clientId,
          start_at: new Date(form.start_at).toISOString(),
          end_at: new Date(form.end_at).toISOString(),
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
      setSaving(false)
    }
  }

  async function complete(event: ScheduleEvent) {
    if (event.virtual) return
    setSaving(true)
    setError('')
    try {
      const response = await fetch(`/api/schedule/${event.id}/complete`, { method: 'POST' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Event could not be completed.')
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Event could not be completed.')
    } finally {
      setSaving(false)
    }
  }

  const schedule = initialSchedule
  const action = schedule.nextAction
  const current = schedule.events.find((event) => {
    const now = new Date(schedule.now).getTime()
    return new Date(event.start_at).getTime() <= now && new Date(event.end_at).getTime() >= now
  })

  return (
    <main className="schedule-page">
      <div className="schedule-shell">
        <AdaptiveTodayForYou
          schedule={schedule}
          streak={0}
          insight="The schedule is clear. Use the evening to protect recovery and tomorrow's setup."
        />

        <header className="schedule-hero">
          <div>
            <p className="schedule-label">Today</p>
            <h1>{action.title}</h1>
            <p>{action.reason}</p>
          </div>
          <div className="schedule-next-card">
            <span>{action.urgency}</span>
            <strong>{action.start_at ? formatLocalTime(action.start_at, schedule.timezone) : 'Open'}</strong>
            <small>{action.overdue ? 'Overdue' : action.automatically_adjusted ? 'Adjusted' : 'Next action'}</small>
            {action.action_route ? (
              <a href={action.action_route} className="adaptive-primary-action">Open</a>
            ) : null}
          </div>
        </header>

        <section className="schedule-summary-grid">
          <article>
            <span>Now</span>
            <strong>{current?.title || 'Open window'}</strong>
            <small>{current ? eventLabel(current) : 'No active block'}</small>
          </article>
          <article>
            <span>Remaining</span>
            <strong>{schedule.upcomingEvents.length}</strong>
            <small>{schedule.flexibleEvents.length} flexible</small>
          </article>
          <article>
            <span>Completed</span>
            <strong>{schedule.completedEvents.length}</strong>
            <small>{schedule.overdueEvents.length} overdue</small>
          </article>
          <article>
            <span>Open Time</span>
            <strong>{schedule.openWindows.length}</strong>
            <small>{schedule.timezone}</small>
          </article>
        </section>

        {schedule.adjustments.length ? (
          <section className="schedule-panel">
            <div className="schedule-section-heading">
              <p className="schedule-label">Adaptive Changes</p>
              <span>{schedule.adjustments.length}</span>
            </div>
            <div className="schedule-change-list">
              {schedule.adjustments.map((item) => (
                <article key={`${item.event_id}-${item.adjustment_type}`}>
                  <strong>{item.title}</strong>
                  <p>{item.reason}</p>
                  <small>
                    {item.suggested_start_at
                      ? `${formatLocalTime(item.suggested_start_at, schedule.timezone)} ${item.applied ? 'applied' : 'suggested'}`
                      : 'No valid open window today'}
                    {item.requires_approval ? ' · approval required' : ''}
                    {item.automatic && item.applied ? ' · automatic' : ''}
                  </small>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section className="schedule-grid">
          <div className="schedule-panel">
            <div className="schedule-section-heading">
              <p className="schedule-label">Timeline</p>
              <span>{schedule.date}</span>
            </div>
            <div className="schedule-timeline">
              {schedule.events.map((event) => (
                <article className={`schedule-event schedule-${event.flexibility_type}`} key={event.id}>
                  <time>{formatLocalTime(event.start_at, schedule.timezone)}</time>
                  <div>
                    <h3>{event.title}</h3>
                    <p>{event.description || event.event_type.replaceAll('_', ' ')}</p>
                    <div>
                      <span>{eventLabel(event)}</span>
                      <span>{event.priority}</span>
                      <span>{event.status}</span>
                      {event.virtual ? <span>plan</span> : null}
                    </div>
                  </div>
                  <button type="button" disabled={saving || event.virtual || event.status === 'completed'} onClick={() => complete(event)}>
                    {event.status === 'completed' ? 'Done' : 'Complete'}
                  </button>
                </article>
              ))}
            </div>
          </div>

          <aside className="schedule-panel">
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
          </aside>
        </section>
      </div>
    </main>
  )
}
