'use client'

import Link from 'next/link'
import { useEffect, useId, useRef } from 'react'
import CardArtwork from '@/components/CardArtwork'
import { formatLocalTime } from '@/lib/schedule/time'
import type { TodayDayItem, TodayDaySections } from '@/lib/dashboard/todayDaySections'
import styles from './TodayDayCarousel.module.css'

const artwork: Record<string, string> = { check_in: 'check-in', hydration: 'water', nutrition: 'nutrition', meal: 'nutrition', workout: 'training', recovery: 'recovery' }
const statuses: Record<string, string> = { upcoming: 'Upcoming', in_progress: 'In progress', deferred: 'Saved for later', skipped: 'Skipped in Schedule' }

function DayAction({ item, timezone, onOpen }: { item: TodayDayItem; timezone: string; onOpen: (id: string) => void }) {
  const kind = artwork[item.category]
  const timing = item.timingPending ? 'Timing is being confirmed' : item.timing === 'all_day' ? 'All day' : item.startAt ? `${item.timing === 'suggested' ? 'Suggested · ' : ''}${item.continuesFromPreviousDay ? 'Continues from the previous day · ' : ''}${formatLocalTime(item.startAt, timezone)}${item.endAt ? ` – ${formatLocalTime(item.endAt, timezone)}` : ''}` : 'No set time'
  return <li data-day-item-id={item.id} data-event-id={item.eventId} data-activity-id={item.activityId}>
    <Link className={styles.action} href={item.href} onClick={() => onOpen(item.activityId || item.id)}>
      {kind ? <CardArtwork kind={kind} className={styles.artwork} naturalProportions sizes="(max-width: 350px) 100vw, 50vw" /> : null}
      <span className={styles.actionCopy}>
        <small className={styles.timing}>{timing}</small>
        <strong>{item.title}</strong>
        <span>{item.detail}</span>
        {statuses[item.status] ? <small>{statuses[item.status]}</small> : null}
      </span>
    </Link>
  </li>
}

export default function TodayDayCarousel({ day, timezone, onOpen, pending = false, keepAnytime = false }: { day: TodayDaySections; timezone: string; onOpen: (id: string) => void; pending?: boolean; keepAnytime?: boolean }) {
  const id = useId()
  const root = useRef<HTMLElement | null>(null)
  const focused = useRef<{ element: HTMLElement; sectionId: string; itemId?: string; eventId?: string; activityId?: string } | null>(null)
  const sections = [...day.sections, ...(day.untimed.length || pending || keepAnytime ? [{
    id: 'untimed', title: 'Any time today',
    range: 'All-day items and actions without a set time stay here. No scheduled time has been added.',
    items: day.untimed,
  }] : [])]
  const panels = useRef<Array<HTMLElement | null>>([])
  useEffect(() => {
    const previous = focused.current
    // A removed card can make the browser drop focus to the document. Recover
    // that focus without changing the scroll position or a deliberate new focus.
    if (!previous || previous.element.isConnected !== false || !root.current || typeof document === 'undefined') return
    const active = document.activeElement
    if (active && active !== document.body && active !== document.documentElement) return
    const cards = Array.from(root.current.querySelectorAll<HTMLElement>('[data-day-item-id]'))
    const card = cards.find(node => node.dataset.dayItemId === previous.itemId) ||
      (previous.eventId ? cards.find(node => node.dataset.eventId === previous.eventId) : undefined) ||
      (previous.activityId && (!previous.eventId || previous.activityId === 'check-in')
        ? cards.find(node => node.dataset.activityId === previous.activityId) : undefined)
    const panel = panels.current.find(node => node?.dataset.daySection === previous.sectionId)
    const target = card?.querySelector<HTMLElement>('a[href]') || panel
    target?.focus({ preventScroll: true })
  }, [day])
  const navigate = (index: number) => {
    const panel = panels.current[index]
    panel?.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' })
    panel?.focus({ preventScroll: true })
  }
  return <section ref={root} className={styles.day} aria-label="Today’s actions" data-testid="today-day-carousel" onFocusCapture={event => {
    const element = event.target as HTMLElement
    const panel = element.closest<HTMLElement>('[data-day-section]')
    if (!panel?.dataset.daySection) return
    const card = element.closest<HTMLElement>('[data-day-item-id]')
    focused.current = { element, sectionId: panel.dataset.daySection, itemId: card?.dataset.dayItemId,
      eventId: card?.dataset.eventId, activityId: card?.dataset.activityId }
  }} onBlurCapture={event => {
    // Clicking or tabbing elsewhere is intentional, including an explicit body
    // target. Removing a focused card supplies no replacement target.
    if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) focused.current = null
  }}>
    <div className={styles.carousel}>
      {sections.map((section, index) => <section key={section.id} id={`${id}-${section.id}`} ref={node => { panels.current[index] = node }} className={styles.section} tabIndex={0} aria-labelledby={`${id}-${section.id}-title`} data-day-section={section.id} onKeyDown={event => {
        if (event.target !== event.currentTarget) return
        const last = sections.length - 1
        const next = event.key === 'ArrowRight' ? Math.min(index + 1, last) : event.key === 'ArrowLeft' ? Math.max(index - 1, 0) : event.key === 'Home' ? 0 : event.key === 'End' ? last : null
        if (next !== null) { event.preventDefault(); navigate(next) }
      }}>
        <header className={styles.sectionHeading}><h3 id={`${id}-${section.id}-title`}>{section.title}</h3><p>{section.range}</p></header>
        {section.items.length ? <ul className={styles.actions}>{section.items.map((item, itemIndex) => <DayAction key={item.activityId === 'check-in' && itemIndex === section.items.findIndex(action => action.activityId === 'check-in') ? 'activity:check-in' : item.id} item={item} timezone={timezone} onOpen={onOpen} />)}</ul> : null}
        {pending ? <p className={styles.empty} role="status">Your other saved actions and current guidance are still loading.</p> : !section.items.length ? <p className={styles.empty}>No remaining saved actions in this part of your day.</p> : null}
      </section>)}
    </div>
  </section>
}
