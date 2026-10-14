'use client'

import { useEffect } from 'react'
import { markDashboardStage } from '@/lib/performance/dashboard'

export default function DashboardPerformance({ stage, snapshot }: { stage: 'shell' | 'primary' | 'secondary'; snapshot?: string }) {
  useEffect(() => {
    // Two frames place the measurement after a committed screen has painted.
    let second = 0
    const first = window.requestAnimationFrame(() => {
      second = window.requestAnimationFrame(() => markDashboardStage(stage))
    })
    return () => { window.cancelAnimationFrame(first); window.cancelAnimationFrame(second) }
  }, [stage, snapshot])
  return null
}
