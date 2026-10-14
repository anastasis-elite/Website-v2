'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { requestDashboardRefresh } from '@/lib/dashboard/requestRefresh'
import { addLocalDays, localDateKey } from '@/lib/timezone'
import { zonedDateTimeToUtc } from '@/lib/schedule/time'

export default function DailyPlanRefresh({ timezone }: { timezone: string }) {
  const router = useRouter()
  useEffect(() => {
    const resume = () => { if (document.visibilityState === 'visible') requestDashboardRefresh(router, 'resume') }
    const saved = () => { if (document.visibilityState === 'visible') requestDashboardRefresh(router, 'saved') }
    let midnightTimer: number
    const scheduleMidnight = () => {
      const tomorrow = addLocalDays(localDateKey(new Date(), timezone), 1)
      const midnight = zonedDateTimeToUtc(tomorrow, '00:00', timezone).getTime()
      midnightTimer = window.setTimeout(() => {
        // Every dashboard page must change its server date at local midnight.
        // This is required even immediately after a save from the previous day.
        if (document.visibilityState === 'visible') requestDashboardRefresh(router, 'saved')
        scheduleMidnight()
      }, Math.max(0, midnight - Date.now()) + 50)
    }
    scheduleMidnight()
    // GuidedToday owns event/daypart boundaries. A single midnight timer also
    // covers nutrition and other pages, without repeated per-minute requests.
    document.addEventListener('visibilitychange', resume)
    window.addEventListener('anastasis:daily-plan-updated', saved)
    return () => { window.clearTimeout(midnightTimer); document.removeEventListener('visibilitychange', resume); window.removeEventListener('anastasis:daily-plan-updated', saved) }
  }, [router, timezone])
  return null
}
