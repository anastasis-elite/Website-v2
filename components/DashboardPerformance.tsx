'use client'

import { useEffect } from 'react'
import { markDashboardStage, publishDashboardRequestTimings } from '@/lib/performance/dashboard'
import type { DashboardTimingEntry } from '@/lib/performance/dashboardTimingTypes'

export default function DashboardPerformance({ stage, snapshot, timings, actionable }: {
  stage: 'shell' | 'primary' | 'secondary'; snapshot?: string
  timings?: readonly DashboardTimingEntry[]; actionable?: boolean
}) {
  useEffect(() => {
    // Two frames place the measurement after a committed screen has painted.
    let canceled = false
    let second = 0
    let clearTimings: (() => void) | undefined
    const first = window.requestAnimationFrame(() => {
      if (canceled) return
      second = window.requestAnimationFrame(() => {
        if (canceled) return
        markDashboardStage(stage)
        if (stage === 'primary') clearTimings = publishDashboardRequestTimings(timings, actionable === true)
      })
    })
    return () => {
      canceled = true
      window.cancelAnimationFrame(first)
      window.cancelAnimationFrame(second)
      clearTimings?.()
    }
  }, [stage, snapshot, timings, actionable])
  return null
}
