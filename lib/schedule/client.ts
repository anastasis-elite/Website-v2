'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { CALENDAR_CHANGE_STORAGE_KEY } from '@/lib/calendar/client'
import { nextScheduleBoundary } from './refresh'
import { localDateKey } from '@/lib/timezone'
import type { DailyScheduleState } from './types'

export function useDailyScheduleRefresh(schedule: Pick<DailyScheduleState, 'date' | 'timezone' | 'events'>, enabled = true) {
  const router = useRouter()
  const boundary = nextScheduleBoundary(schedule)
  const staleDate = schedule.date < localDateKey(new Date(), schedule.timezone)
  const refreshedStaleDate = useRef<string | null>(null)
  useEffect(() => {
    if (!enabled) return
    const refresh = () => { if (document.visibilityState === 'visible') router.refresh() }
    const storedChange = (event: StorageEvent) => { if (event.key === CALENDAR_CHANGE_STORAGE_KEY) refresh() }
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    window.addEventListener('calendar-events-updated', refresh)
    window.addEventListener('storage', storedChange)
    if (staleDate && refreshedStaleDate.current !== schedule.date) {
      refreshedStaleDate.current = schedule.date
      refresh()
    }
    // Refresh on daypart/greeting, event, or midnight boundaries without polling.
    const timer = !staleDate && Number.isFinite(boundary) ? window.setTimeout(refresh, Math.max(0, boundary - Date.now()) + 50) : undefined
    return () => {
      if (timer !== undefined) window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('calendar-events-updated', refresh)
      window.removeEventListener('storage', storedChange)
    }
  }, [router, boundary, staleDate, schedule.date, enabled])
}
