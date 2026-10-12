'use client'

import type { DailyScheduleState, ScheduleEvent } from '@/lib/schedule/types'
import { formatLocalTime } from '@/lib/schedule/time'
import DailyPlanCard from '@/components/DailyPlanCard'
import ScheduleEventActions from '@/components/ScheduleEventActions'
import CalendarWorkspace from '@/components/CalendarWorkspace'
import { useDailyScheduleRefresh } from '@/lib/schedule/client'

function eventLabel(event: ScheduleEvent) {
  if (event.flexibility_type === 'fixed') return 'Fixed'
  if (event.flexibility_type === 'approval_required') return 'Approval'
  return 'Flexible'
}

export default function ScheduleDashboardClient({ initialSchedule }: { initialSchedule: DailyScheduleState }) {
  const schedule = initialSchedule
  useDailyScheduleRefresh(schedule)
  return <main className="schedule-page"><div className="schedule-shell">
    <header className="schedule-hero"><div><p className="schedule-label">{schedule.date} · {schedule.timezone}</p><h1>Your day, with room to breathe</h1><p>Keep appointments in view and choose time for what supports you.</p></div></header>
    {schedule.dailyRecommendation ? <DailyPlanCard plan={schedule.dailyRecommendation} compact autoRefresh={false} /> : null}
    <CalendarWorkspace date={schedule.date} timezone={schedule.timezone} />
    <section className="schedule-panel" aria-label="Anastasis activities and daily structure">
      <div className="schedule-section-heading"><h2>Anastasis activities and daily structure</h2><span>{schedule.date}</span></div>
      <p>Suggestions stay here until you choose them. Use the calendar above to save an activity to a connected calendar.</p>
      <div className="schedule-timeline">{schedule.events.filter(event => event.source !== 'external_calendar' && !event.calendar_event_id).map(event => <article id={`event-${event.id}`} className={`schedule-event schedule-${event.flexibility_type}`} key={event.id}>
        <time>{formatLocalTime(event.adjusted_start_at || event.start_at, schedule.timezone)}{event.adjusted_start_at ? <small>Originally {formatLocalTime(event.start_at, schedule.timezone)}</small> : null}</time>
        <div><h3>{event.title}</h3><p>{event.description || event.event_type.replaceAll('_', ' ')}</p><div><span>Anastasis</span><span>{eventLabel(event)}</span><span>{schedule.overdueEvents.some(item => item.id === event.id) ? 'Overdue · review or choose a new time' : event.suggested && event.status === 'scheduled' ? 'Suggested time' : event.status}</span></div></div>
        <ScheduleEventActions event={event} program={schedule.program} timezone={schedule.timezone} suggestion={schedule.adjustments.find(item => item.event_id === event.id && !item.applied)} />
      </article>)}</div>
    </section>
  </div></main>
}
