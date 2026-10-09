'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
export default function DailyPlanRefresh() {
  const router = useRouter()
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') router.refresh() }
    const timer = window.setInterval(refresh, 60000)
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('anastasis:daily-plan-updated', refresh)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', refresh); window.removeEventListener('anastasis:daily-plan-updated', refresh) }
  }, [router])
  return null
}
