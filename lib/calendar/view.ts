import { addLocalDays, localDateKey } from '@/lib/timezone'
import type { OpenWindow, ScheduleEvent } from '@/lib/schedule/types'

export type CalendarViewMode = 'day' | 'week' | 'month'
export type CalendarItemSource = 'external_calendar' | 'anastasis' | 'user_created' | 'suggestion'

export type CalendarDisplayItem = {
  id: string
  title: string
  date: string
  start_at: string
  end_at: string
  source: CalendarItemSource
  event_type: string
  status: string
  suggested: boolean
  event?: ScheduleEvent
}

export type CalendarMonthCell = {
  date: string
  day: number
  inMonth: boolean
  isSelected: boolean
  isToday: boolean
  items: CalendarDisplayItem[]
}

export type CalendarWeekDay = {
  date: string
  label: string
  items: CalendarDisplayItem[]
}


function pad(value: number) {
  return String(value).padStart(2, '0')
}

export function toDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function parseDateKey(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function addDays(date: string, days: number) {
  const next = parseDateKey(date)
  next.setDate(next.getDate() + days)
  return toDateKey(next)
}

export function addMonths(date: string, months: number) {
  const next = parseDateKey(date)
  const day = next.getDate()
  next.setDate(1)
  next.setMonth(next.getMonth() + months)
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()
  next.setDate(Math.min(day, lastDay))
  return toDateKey(next)
}

export function getWeekStart(date: string) {
  const current = parseDateKey(date)
  const day = current.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  current.setDate(current.getDate() + mondayOffset)
  return toDateKey(current)
}

export function calendarItemSource(event: ScheduleEvent): CalendarItemSource {
  if (event.source === 'external_calendar' || event.external_event_id || event.external_calendar_source) return 'external_calendar'
  if (event.source === 'manual' || event.source === 'mobile') return 'user_created'
  return 'anastasis'
}

export function eventDateKey(event: Pick<ScheduleEvent, 'adjusted_start_at' | 'start_at'>, timezone?: string) {
  return localDateKey(new Date(event.adjusted_start_at || event.start_at), timezone || 'America/Chicago')
}

export function buildCalendarItems(events: ScheduleEvent[], windows: OpenWindow[] = [], timezone = 'America/Chicago'): CalendarDisplayItem[] {
  const eventItems = events.map((event) => ({
    id: event.id,
    title: event.title,
    date: eventDateKey(event, timezone),
    start_at: event.adjusted_start_at || event.start_at,
    end_at: event.adjusted_end_at || event.end_at,
    source: calendarItemSource(event),
    event_type: event.event_type,
    status: event.status,
    suggested: Boolean(event.suggested),
    event,
  }))

  const suggestionItems = windows.map((window) => ({
    id: `suggestion-${window.start_at}-${window.end_at}`,
    title: 'Potentially available',
    date: localDateKey(new Date(window.start_at), timezone),
    start_at: window.start_at,
    end_at: window.end_at,
    source: 'suggestion' as const,
    event_type: 'suggestion',
    status: 'suggested',
    suggested: true,
  }))

  return [...eventItems, ...suggestionItems].sort(
    (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
  )
}

export function buildMonthGrid({
  selectedDate,
  items,
  today = toDateKey(new Date()),
}: {
  selectedDate: string
  items: CalendarDisplayItem[]
  today?: string
}): CalendarMonthCell[] {
  const selected = parseDateKey(selectedDate)
  const first = new Date(selected.getFullYear(), selected.getMonth(), 1)
  const gridStart = new Date(first); gridStart.setDate(first.getDate() - first.getDay())
  const month = selected.getMonth()

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart); date.setDate(gridStart.getDate() + index)
    const key = toDateKey(date)
    return {
      date: key,
      day: date.getDate(),
      inMonth: date.getMonth() === month,
      isSelected: key === selectedDate,
      isToday: key === today,
      items: items.filter((item) => item.date === key),
    }
  })
}

export function buildWeekDays(selectedDate: string, items: CalendarDisplayItem[]): CalendarWeekDay[] {
  const start = getWeekStart(selectedDate)
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(start, index)
    return {
      date,
      label: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index],
      items: items.filter((item) => item.date === date),
    }
  })
}

export function itemsForDate(items: CalendarDisplayItem[], date: string) {
  return items.filter((item) => item.date === date)
}

/** Include the complete selected week even when its Monday precedes a Sunday month-grid start. */
export function calendarQueryDateRange(selectedDate: string) {
  const grid = buildMonthGrid({ selectedDate, items: [] })
  const week = buildWeekDays(selectedDate, [])
  const gridEnd = addLocalDays(grid[grid.length - 1].date, 1)
  const weekEnd = addLocalDays(week[week.length - 1].date, 1)
  return { start: grid[0].date < week[0].date ? grid[0].date : week[0].date, end: gridEnd > weekEnd ? gridEnd : weekEnd }
}

/** Project spanning appointments onto visible local dates; end instants and all-day end dates are exclusive. */
export function visibleEventDates(event: { start_at: string; end_at: string; all_day: boolean; start_date?: string | null; end_date?: string | null }, timezone: string, rangeStart: string, rangeEnd: string) {
  const first = event.all_day && event.start_date ? event.start_date : localDateKey(new Date(event.start_at), timezone)
  const last = event.all_day && event.end_date ? addLocalDays(event.end_date, -1) : localDateKey(new Date(new Date(event.end_at).getTime() - 1), timezone)
  const dates: string[] = []
  for (let date = first < rangeStart ? rangeStart : first; date <= last && date < rangeEnd; date = addLocalDays(date, 1)) dates.push(date)
  return dates
}
