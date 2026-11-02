'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { DailyScheduleState, ScheduleEvent } from '@/lib/schedule/types'
import { formatLocalTime } from '@/lib/schedule/time'
import { addLocalDays, localDateKey } from '@/lib/timezone'
import { useDailyScheduleRefresh } from '@/lib/schedule/client'
import { dayBlockHref, dayBlockLabels, isDayBlockDate, scheduleDayHref, type DayBlock } from '@/lib/day/dayBlockRoutes'
import { getActionRouteForEvent } from '@/lib/schedule/engine'
import { healthEventTypes } from '@/lib/schedule/actions'
import ScheduleCheckoff from '@/components/ScheduleCheckoff'
import styles from './schedule-review.module.css'

function statusLabel(event: ScheduleEvent, now: string) {
  if (event.status === 'completed') return 'Done'
  if (event.status === 'cancelled') return 'Cancelled'
  if (event.status === 'skipped') return 'Skipped'
  if (event.suggested) return 'Suggested'
  return Date.parse(event.adjusted_end_at || event.end_at) < Date.parse(now) ? 'Overdue' : 'Upcoming'
}

export default function ScheduleDashboardClient({ initialSchedule }: { initialSchedule: DailyScheduleState }) {
  const schedule = initialSchedule
  const router = useRouter()
  useDailyScheduleRefresh(schedule)
  const today = localDateKey(new Date(schedule.now), schedule.timezone)
  const events = [...schedule.events].sort((a, b) => Number(b.all_day) - Number(a.all_day)
    || Date.parse(a.adjusted_start_at || a.start_at) - Date.parse(b.adjusted_start_at || b.start_at)
    || a.id.localeCompare(b.id))
  return <main className={styles.page}>
    <header className={styles.header}>
      <Link href="/dashboard" className={styles.back}>‹ Today</Link>
      <h1>Schedule</h1>
      <Link href={`/dashboard/calendar?date=${schedule.date}`}>Calendar</Link>
    </header>
    <nav className={styles.dates} aria-label="Schedule date">
      <Link href={scheduleDayHref(addLocalDays(schedule.date, -1))} aria-label="Previous day">‹</Link>
      <label className={styles.dateLabel}><span className={styles.srOnly}>Select schedule date</span>
        <input aria-label="Select schedule date" type="date" value={schedule.date} onChange={event => {
          if (isDayBlockDate(event.target.value)) router.push(scheduleDayHref(event.target.value))
        }} />
      </label>
      <Link href={scheduleDayHref(addLocalDays(schedule.date, 1))} aria-label="Next day">›</Link>
      {schedule.date !== today ? <Link className={styles.today} href="/dashboard/schedule">Today</Link> : null}
    </nav>
    <div className={styles.meta}>
      <small>{schedule.timezone.replaceAll('_', ' ')}</small>
      <nav aria-label="Parts of your selected day">{(Object.keys(dayBlockLabels) as DayBlock[]).map(block =>
        <Link key={block} href={dayBlockHref(block, schedule.date)}>{dayBlockLabels[block]}</Link>)}</nav>
    </div>
    {schedule.unavailableSources?.length ? <p className={styles.notice} role="status">Some schedule details could not load. Refresh to try again.</p> : null}
    <section aria-label="Daily schedule">
      {events.length ? <ol className={styles.events}>{events.map(event => {
        const health = healthEventTypes.has(event.event_type)
        const terminal = ['completed', 'cancelled', 'skipped'].includes(event.status)
        return <li id={`event-${event.id}`} key={`${schedule.date}:${event.id}`} className={styles.row}>
          <time dateTime={event.adjusted_start_at || event.start_at}>{event.all_day ? 'All day' : formatLocalTime(event.adjusted_start_at || event.start_at, schedule.timezone)}</time>
          <div className={styles.activity}>
            <Link className={styles.title} href={getActionRouteForEvent(event, schedule.program)}>{event.title}</Link>
            <small>{statusLabel(event, schedule.now)}{event.source === 'external_calendar' ? ' · Calendar' : ''}</small>
          </div>
          {health ? terminal ? <span className={styles.healthDone} aria-label={`${event.title}: ${statusLabel(event, schedule.now)}`}>{event.status === 'completed' ? '✓' : '—'}</span>
            : <Link className={styles.log} href={getActionRouteForEvent(event, schedule.program)} aria-label={`Open ${event.title} to log`}>Log</Link>
            : <ScheduleCheckoff event={event} date={schedule.date} timezone={schedule.timezone} unavailable={schedule.unavailableSources?.includes('checkoffs')} />}
        </li>
      })}</ol> : <p className={styles.empty}>Nothing scheduled for this day.</p>}
    </section>
  </main>
}
