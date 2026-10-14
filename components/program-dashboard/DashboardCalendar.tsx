'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useViewPreference } from '@/components/dashboard/useViewPreference'
import { addLocalDays, getLocalDaypart } from '@/lib/timezone'
import { formatLocalTime, zonedDateTimeToUtc } from '@/lib/schedule/time'
import { useCalendarEvents } from '@/lib/calendar/client'
import type { DailyScheduleState, ScheduleEvent } from '@/lib/schedule/types'
import type { PlanBlock } from './dashboardWorkspaceTypes'
import { calendarSuggestionKey, filterDismissedCalendarSuggestions, readCalendarDismissals, writeCalendarDismissals } from '@/lib/calendar/dismissals'
import { addDays, addMonths, buildCalendarItems, calendarQueryDateRange, buildMonthGrid, buildWeekDays, itemsForDate, parseDateKey, visibleEventDates, summarizeCalendarItems, type CalendarDisplayItem } from '@/lib/calendar/view'

type CalendarMode = 'day' | 'week' | 'month'
type Daypart = 'morning' | 'midday' | 'evening'
type ConnectedDisplayItem = CalendarDisplayItem & { source_label?: string; all_day?: boolean }

function eventRange(event: ScheduleEvent, timezone: string) {
  if (event.all_day) return 'All day'
  return `${formatLocalTime(event.adjusted_start_at || event.start_at, timezone)}-${formatLocalTime(event.adjusted_end_at || event.end_at, timezone)}`
}

function overlapsDaypart(item: ConnectedDisplayItem, date: string, daypart: Daypart, timezone: string) {
  if (item.all_day) return true
  const starts = zonedDateTimeToUtc(date, daypart === 'morning' ? '00:00' : daypart === 'midday' ? '11:00' : '17:00', timezone)
  const ends = zonedDateTimeToUtc(daypart === 'evening' ? addLocalDays(date, 1) : date, daypart === 'morning' ? '11:00' : daypart === 'midday' ? '17:00' : '00:00', timezone)
  return Date.parse(item.start_at) < ends.getTime() && Date.parse(item.end_at) > starts.getTime()
}

export default function DashboardCalendar({
  schedule,
  planBlocks,
  clientId,
}: {
  schedule: DailyScheduleState
  planBlocks: PlanBlock[]
  clientId: string
}) {
  const [dateExplicit,setDateExplicit]=useState(false)
  const [mode, setMode] = useViewPreference<CalendarMode>(clientId, 'calendar-mode', ['day', 'week', 'month'], 'day')
  const [daypartPreference, setDaypartPreference] = useViewPreference<Daypart | 'auto'>(clientId, 'calendar-daypart', ['auto', 'morning', 'midday', 'evening'], 'auto')
  const [selectedDate, setSelectedDate] = useState(schedule.date)
  const daypart = daypartPreference === 'auto' ? getLocalDaypart(new Date(schedule.now), schedule.timezone) : daypartPreference
  const [dismissed, setDismissed] = useState<string[]>([])
  const [dismissalNotice, setDismissalNotice] = useState('')
  useEffect(()=>{if(!dateExplicit)setSelectedDate(schedule.date)},[schedule.date,dateExplicit])
  useEffect(() => {
    try { setDismissed(readCalendarDismissals(window.localStorage, clientId, schedule.date)) }
    catch { setDismissed([]) }
    setDismissalNotice('')
  }, [clientId, schedule.date])
  const dateRange = calendarQueryDateRange(selectedDate)
  const rangeStartDate = dateRange.start
  const rangeEndDate = dateRange.end
  const rangeStart = zonedDateTimeToUtc(rangeStartDate, '00:00', schedule.timezone).toISOString()
  const rangeEnd = zonedDateTimeToUtc(rangeEndDate, '00:00', schedule.timezone).toISOString()
  const connected = useCalendarEvents(rangeStart, rangeEnd, schedule.timezone)
  const items = useMemo<ConnectedDisplayItem[]>(() => {
    const persistedKeys = new Set(connected.events.map(event => `${event.id}:${event.start_at}`))
    const existing = schedule.events.filter(event => !['cancelled', 'skipped'].includes(event.status) && !persistedKeys.has(`${event.calendar_event_id || event.id}:${event.start_at}`))
    const planItems = buildCalendarItems(existing, schedule.openWindows, schedule.timezone).map(item => ({ ...item, source_label: item.event?.source_label, all_day: item.event?.all_day }))
    const accountItems: ConnectedDisplayItem[] = connected.events.flatMap(event => visibleEventDates(event, schedule.timezone, rangeStartDate, rangeEndDate).map(date => ({ id: `connected:${event.id}:${event.occurrence_start || event.start_at}:${date}`, title: event.title, date, start_at: event.start_at, end_at: event.end_at, source: event.calendar_id ? 'external_calendar' : 'user_created', event_type: event.event_type || 'personal', status: event.calendar_id ? 'Synced' : 'Saved', suggested: false, source_label: event.source_label, all_day: event.all_day } as ConnectedDisplayItem)))
    return filterDismissedCalendarSuggestions([...planItems, ...accountItems], dismissed).sort((a, b) => a.start_at.localeCompare(b.start_at))
  }, [schedule.events, schedule.openWindows, schedule.timezone, connected.events, rangeStartDate, rangeEndDate, dismissed])
  const selectedItems = itemsForDate(items, selectedDate)
  const monthCells = buildMonthGrid({ selectedDate, items, today: schedule.date })
  const weekDays = buildWeekDays(selectedDate, items)
  const selectedPlanBlock = planBlocks.find((block) => block.id === daypart)
  const daypartItems = selectedItems.filter(item => overlapsDaypart(item, selectedDate, daypart, schedule.timezone))
  const showTodayPlan = selectedDate === schedule.date && Boolean(selectedPlanBlock)
  const itemTitles = new Set(daypartItems.map((item) => item.title.trim().toLowerCase()))
  const planTasks = showTodayPlan
    ? selectedPlanBlock!.tasks.filter((task) => !itemTitles.has(task.label.trim().toLowerCase()))
    : []

  function selectDate(date: string) {
    setDateExplicit(true)
    setSelectedDate(date)
    setMode('day')
  }

  function go(delta: number) {
    setDateExplicit(true)
    if (mode === 'month') setSelectedDate((current) => addMonths(current, delta))
    else if (mode === 'week') setSelectedDate((current) => addDays(current, delta * 7))
    else setSelectedDate((current) => addDays(current, delta))
  }

  function today() {
    setDateExplicit(false)
    setSelectedDate(schedule.date)
    setDaypartPreference('auto')
  }

  function saveDismissals(next: string[]) {
    let saved = false
    try { saved = writeCalendarDismissals(window.localStorage, clientId, schedule.date, next) }
    catch { /* Browser storage itself may be unavailable. */ }
    setDismissed(next)
    setDismissalNotice(saved ? next.length ? 'Suggestion hidden in this browser. Your activities remain available in Schedule.' : 'Suggestions restored.' : 'Updated for this visit. Browser storage is unavailable, so this choice may return after reload.')
  }

  const selected = parseDateKey(selectedDate)
  const heading =
    mode === 'month'
      ? selected.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
      : mode === 'week'
        ? `Week of ${parseDateKey(weekDays[0].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
        : selected.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <section className="tier-calendar-panel" aria-label="Calendar" data-tutorial-id="dashboard-calendar">
      <div className="tier-panel-heading">
        <div>
          <p className="tier-dashboard-label">Calendar</p>
          <h2>{heading}</h2>
        </div>
        <div className="tier-segmented-control" role="tablist" aria-label="Calendar view">
          {(['day', 'week', 'month'] as CalendarMode[]).map((item) => (
            <button key={item} type="button" role="tab" aria-selected={mode === item} className={mode === item ? 'is-active' : ''} onClick={() => setMode(item)}>
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="tier-calendar-nav" aria-label="Calendar navigation">
        <button type="button" onClick={() => go(-1)}>Previous</button>
        <button type="button" onClick={today}>Today</button>
        <button type="button" onClick={() => go(1)}>Next</button>
        <Link href="/dashboard/settings/calendars">Connected calendars</Link>
        <Link href="/dashboard/schedule#connected-calendar">Add or manage events</Link>
        {dismissed.length ? <button type="button" onClick={() => saveDismissals([])}>Restore dismissed suggestions</button> : null}
      </div>
      {dismissalNotice ? <p role="status" className="tier-calendar-empty">{dismissalNotice}</p> : null}
      {connected.error ? <p role="alert" className="tier-calendar-empty">{connected.error} <Link href="/dashboard/settings/calendars">Review connection</Link></p> : null}

      {mode === 'month' ? (
        <div className="tier-month-calendar" data-testid="calendar-month-grid">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day} className="tier-month-weekday">{day}</span>)}
          {monthCells.map((cell) => {
            const counts = summarizeCalendarItems(cell.items)
            const activities = cell.items.filter(item => item.source !== 'suggestion')
            return (
              <button
                key={cell.date}
                type="button"
                className={`tier-month-cell${cell.inMonth ? '' : ' is-muted'}${cell.isSelected ? ' is-selected' : ''}${cell.isToday ? ' is-today' : ''}`}
                onClick={() => selectDate(cell.date)}
                aria-label={`Open ${cell.date}${counts.events ? `, ${counts.events} event${counts.events === 1 ? '' : 's'}` : ''}${counts.suggestions ? `, ${counts.suggestions} suggestion${counts.suggestions === 1 ? '' : 's'}` : ''}`}
              >
                <span>{cell.day}</span>
                {counts.events ? <strong>{counts.events}</strong> : null}
                <div>{activities.slice(0, 2).map((item) => <i key={item.id} data-source={item.source}>{item.suggested ? 'Suggested' : item.title}</i>)}{!activities.length && counts.available ? <i data-source="suggestion">Open time</i> : null}</div>
              </button>
            )
          })}
        </div>
      ) : null}

      {mode === 'week' ? (
        <div className="tier-week-calendar" data-testid="calendar-week-grid">
          {weekDays.map((day) => (
            <button
              key={day.date}
              type="button"
              className={`tier-week-day${day.date === selectedDate ? ' is-selected' : ''}${day.date === schedule.date ? ' is-today' : ''}`}
              onClick={() => selectDate(day.date)}
              aria-pressed={day.date === selectedDate}
            >
              <span>{day.label}</span>
              <strong>{parseDateKey(day.date).getDate()}</strong>
              <div>
                {day.items.length ? day.items.slice(0, 4).map((item) => (
                  <CalendarPill key={item.id} item={item} timezone={schedule.timezone} />
                )) : <small>Open</small>}
              </div>
            </button>
          ))}
        </div>
      ) : null}

      {mode === 'day' ? (
        <div className="tier-day-calendar" data-testid="calendar-day-view">
          <div className="tier-daypart-control" role="tablist" aria-label="Day plan time">
            {(['morning', 'midday', 'evening'] as Daypart[]).map((item) => (
              <button key={item} type="button" role="tab" aria-selected={daypart === item} className={daypart === item ? 'is-active' : ''} onClick={() => setDaypartPreference(item)}>
                {item}
              </button>
            ))}
          </div>
          {daypartItems.length ? daypartItems.map((item) => (
            <CalendarPill key={item.id} item={item} timezone={schedule.timezone} detailed onDismiss={() => saveDismissals([...dismissed, calendarSuggestionKey(item)])} />
          )) : <p className="tier-calendar-empty">No scheduled items for this part of the day.</p>}
          {showTodayPlan ? (
            <div className="tier-daypart-plan" data-testid="calendar-daypart-plan">
              <div>
                <strong>{selectedPlanBlock!.title}</strong>
                <small>{selectedPlanBlock!.focus}</small>
              </div>
              {planTasks.length ? planTasks.map((task) => (
                <Link key={task.id} href={task.href} className={`tier-plan-task${task.complete ? ' is-complete' : ''}`}>
                  <span>{task.complete ? 'Done' : 'Planned'}</span>
                  <strong>{task.label}</strong>
                  {task.detail ? <small>{task.detail}</small> : null}
                </Link>
              )) : <p className="tier-calendar-empty">This part of the plan is already represented on the calendar.</p>}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

function CalendarPill({
  item,
  timezone,
  detailed = false,
  onDismiss,
}: {
  item: ConnectedDisplayItem
  timezone: string
  detailed?: boolean
  onDismiss?: () => void
}) {
  return (
    <article className={`tier-calendar-pill source-${item.source}${item.suggested ? ' is-suggestion' : ''}`}>
      <time>{item.all_day ? 'All day' : formatLocalTime(item.start_at, timezone)}</time>
      <strong>{item.title}</strong>
      {detailed ? (
        <>
          <small>{item.event_type.replaceAll('_', ' ')} · {item.source_label || item.source.replaceAll('_', ' ')}</small>
          {item.suggested ? (
            <div className="tier-suggestion-actions">
              <Link href={item.event ? `/dashboard/schedule#event-${item.event.id}` : '/dashboard/schedule#connected-calendar'}>Review suggestion</Link>
              {onDismiss ? <button type="button" onClick={onDismiss}>Dismiss time</button> : null}
            </div>
          ) : item.event ? (
            <small>{eventRange(item.event, timezone)} · {item.status}</small>
          ) : <Link href="/dashboard/schedule#connected-calendar">{item.status} · View event</Link>}
        </>
      ) : null}
    </article>
  )
}
