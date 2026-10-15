import type { CalendarDisplayItem } from './view'
import type { ViewPreferenceStorage } from '@/lib/dashboard/viewPreferences'

type Dismissals = { version: 1; dates: Record<string, string[]> }

export function calendarDismissalKey(clientId: string) {
  return `aos:calendar-dismissals:v1:${encodeURIComponent(clientId)}`
}

/** A changed proposed time remains reviewable even when an earlier proposal was dismissed. */
export function calendarSuggestionKey(item: Pick<CalendarDisplayItem, 'id' | 'start_at' | 'end_at'>) {
  return `${item.id}:${item.start_at}:${item.end_at}`
}

function readRecord(storage: ViewPreferenceStorage, clientId: string): Dismissals {
  try {
    const value = JSON.parse(storage.getItem(calendarDismissalKey(clientId)) || 'null')
    if (value?.version === 1 && value.dates && typeof value.dates === 'object') {
      const dates: Record<string, string[]> = {}
      for (const [date, ids] of Object.entries(value.dates)) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(date) && Array.isArray(ids)) dates[date] = ids.filter((id): id is string => typeof id === 'string' && id.length <= 500).slice(0, 200)
      }
      return { version: 1, dates }
    }
  } catch { /* Cosmetic state can be unavailable or from an older version. */ }
  return { version: 1, dates: {} }
}

export function readCalendarDismissals(storage: ViewPreferenceStorage, clientId: string, date: string) {
  if (!clientId) return []
  return readRecord(storage, clientId).dates[date] || []
}

export function writeCalendarDismissals(storage: ViewPreferenceStorage, clientId: string, date: string, ids: string[]) {
  if (!clientId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  try {
    const record = readRecord(storage, clientId)
    const dates = { ...record.dates, [date]: [...new Set(ids)].slice(0, 200) }
    // Keep cosmetic browser state bounded without changing activity or health records.
    const recent = Object.fromEntries(Object.entries(dates).sort(([a], [b]) => b.localeCompare(a)).slice(0, 31))
    storage.setItem(calendarDismissalKey(clientId), JSON.stringify({ version: 1, dates: recent }))
    return true
  } catch { return false }
}

export function filterDismissedCalendarSuggestions<T extends CalendarDisplayItem>(items: T[], dismissedIds: string[]) {
  const dismissed = new Set(dismissedIds)
  return items.filter(item => !item.suggested || !dismissed.has(calendarSuggestionKey(item)))
}
