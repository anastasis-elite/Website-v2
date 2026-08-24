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

const dayMs = 24 * 60 * 60 * 1000

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
  next.setMonth(next.getMonth() + months)
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

export function eventDateKey(event: Pick<ScheduleEvent, 'adjusted_start_at' | 'start_at'>) {
  return toDateKey(new Date(event.adjusted_start_at || event.start_at))
}

export function buildCalendarItems(events: ScheduleEvent[], windows: OpenWindow[] = []): CalendarDisplayItem[] {
  const eventItems = events.map((event) => ({
    id: event.id,
    title: event.title,
    date: eventDateKey(event),
    start_at: event.adjusted_start_at || event.start_at,
    end_at: event.adjusted_end_at || event.end_at,
    source: calendarItemSource(event),
    event_type: event.event_type,
    status: event.status,
    suggested: false,
    event,
  }))

  const suggestionItems = windows.map((window) => ({
    id: `suggestion-${window.start_at}-${window.end_at}`,
    title: 'Suggested opening',
    date: toDateKey(new Date(window.start_at)),
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
  const gridStart = new Date(first.getTime() - first.getDay() * dayMs)
  const month = selected.getMonth()

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart.getTime() + index * dayMs)
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
