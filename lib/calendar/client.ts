'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type ConnectedCalendar = { id: string; name: string; timezone?: string; writable: boolean; selected: boolean; provider?: string }
export type CalendarConnection = {
  id: string; provider: string; account_label: string; status: string
  last_synced_at: string | null; error_message: string | null; calendars: ConnectedCalendar[]
}
export type CalendarPreferences = {
  default_calendar_id: string | null; timezone: string; preferred_start: string; preferred_end: string; buffer_minutes: number
}
export type CalendarSettings = { connections: CalendarConnection[]; preferences: CalendarPreferences; google_configured: boolean; icloud_configured?: boolean }
export type UnifiedCalendarEvent = {
  id: string; calendar_id: string | null; title: string; description: string | null; location: string | null
  start_at: string; end_at: string; timezone: string; all_day: boolean; start_date?: string | null; end_date?: string | null
  recurrence: string[]; reminders: number[]; source_label: string; writable: boolean; etag: string | null
  event_type: string; external_event_id?: string | null; recurring_event_id?: string | null; occurrence_start?: string | null
  edit_scope?: 'series' | 'instance'; series_start_at?: string; series_end_at?: string; series_start_date?: string | null; series_end_date?: string | null
  legacy?: boolean; calendar_event_id?: string
  reminders_default?: boolean; calendar_provider?: string
}
export type CalendarEventsResponse = { events: UnifiedCalendarEvent[]; calendars: ConnectedCalendar[] }

export class CalendarRequestError extends Error {
  constructor(message: string, public status: number) { super(message); this.name = 'CalendarRequestError' }
}

export async function calendarRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options, headers: { 'Content-Type': 'application/json', ...options.headers } })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new CalendarRequestError(payload.error || 'The calendar request could not be completed. Please try again.', response.status)
  return payload as T
}

export function useCalendarEvents(start: string, end: string, timezone?: string) {
  const [data, setData] = useState<CalendarEventsResponse>({ events: [], calendars: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const requestNumber = useRef(0)
  const invalidate = useCallback(() => { requestNumber.current++ }, [])
  const refresh = useCallback(async () => {
    const current = ++requestNumber.current
    setLoading(true)
    try {
      const next = await calendarRequest<CalendarEventsResponse>(`/api/calendars/events?${new URLSearchParams({ start, end, ...(timezone ? { timezone } : {}) })}`)
      if (current === requestNumber.current) { setData(next); setError('') }
    } catch (caught) {
      if (current === requestNumber.current) setError(caught instanceof Error ? caught.message : 'Calendar events could not be loaded.')
    } finally {
      if (current === requestNumber.current) setLoading(false)
    }
  }, [start, end, timezone])
  useEffect(() => {
    setData({events:[],calendars:[]})
    void refresh()
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('calendar-events-updated', onVisible)
    return () => { invalidate(); document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('calendar-events-updated', onVisible) }
  }, [refresh, invalidate])
  return { ...data, loading, error, refresh }
}

export function announceCalendarChange() { window.dispatchEvent(new Event('calendar-events-updated')) }
