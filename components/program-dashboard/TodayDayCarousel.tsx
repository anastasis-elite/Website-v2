'use client'

import Link from 'next/link'
import { useId } from 'react'
import CardArtwork from '@/components/CardArtwork'
import { formatLocalTime } from '@/lib/schedule/time'
import type { TodayDayItem, TodayDaySections } from '@/lib/dashboard/todayDaySections'
import styles from './TodayDayCarousel.module.css'

const artwork: Record<string, string> = { check_in: 'check-in', hydration: 'water', nutrition: 'nutrition', meal: 'nutrition', workout: 'training', recovery: 'recovery' }
const statuses: Record<string, string> = { upcoming: 'Upcoming', in_progress: 'In progress', deferred: 'Saved for later', skipped: 'Skipped in Schedule' }

function DayAction({ item, timezone, onOpen }: { item: TodayDayItem; timezone: string; onOpen: (id: string) => void }) {
  const kind = artwork[item.category]
  const timing = item.timing === 'all_day' ? 'All day' : item.startAt ? `${item.timing === 'suggested' ? 'Suggested · ' : ''}${item.continuesFromPreviousDay ? 'Continues from the previous day · ' : ''}${formatLocalTime(item.startAt, timezone)}${item.endAt ? ` – ${formatLocalTime(item.endAt, timezone)}` : ''}` : 'No set time'
  return <li data-day-item-id={item.id} data-event-id={item.eventId} data-activity-id={item.activityId}>
    <Link className={styles.action} href={item.href} onClick={() => onOpen(item.activityId || item.id)}>
      {kind ? <CardArtwork kind={kind} className={styles.artwork} naturalProportions sizes="(max-width: 600px) 100vw, 50vw" /> : null}
      <span className={styles.actionCopy}>
        <small className={styles.timing}>{timing}</small>
        <strong>{item.title}</strong>
        <span>{item.detail}</span>
        {statuses[item.status] ? <small>{statuses[item.status]}</small> : null}
      </span>
    </Link>
  </li>
}

export default function TodayDayCarousel({ day, timezone, onOpen }: { day: TodayDaySections; timezone: string; onOpen: (id: string) => void }) {
  const id = useId()
  return <section className={styles.day} aria-label="Today’s actions" data-testid="today-day-carousel">
    <div className={styles.sections}>
      {day.sections.map(section => <section key={section.id} id={`${id}-${section.id}`} className={styles.section} aria-labelledby={`${id}-${section.id}-title`} data-day-section={section.id}>
        <header className={styles.sectionHeading}><h3 id={`${id}-${section.id}-title`}>{section.title}</h3><p>{section.range}</p></header>
        {section.items.length ? <ul className={styles.actions}>{section.items.map(item => <DayAction key={item.id} item={item} timezone={timezone} onOpen={onOpen} />)}</ul> : <p className={styles.empty}>No remaining saved actions in this part of your day.</p>}
      </section>)}
    </div>
    {day.untimed.length ? <section className={styles.untimed} aria-labelledby={`${id}-untimed`}>
      <h3 id={`${id}-untimed`}>Any time today</h3>
      <p>All-day items and actions without a set time stay here. No scheduled time has been added.</p>
      <ul className={styles.actions}>{day.untimed.map(item => <DayAction key={item.id} item={item} timezone={timezone} onOpen={onOpen} />)}</ul>
    </section> : null}
  </section>
}
