import 'server-only'

import {
  dashboardTimingMilliseconds, isDashboardTimingStage, MAX_DASHBOARD_TIMING_ENTRIES,
  type DashboardTimingEntry, type DashboardTimingStage,
} from './dashboardTimingTypes'

export type DashboardRequestTiming = ReturnType<typeof createDashboardRequestTiming>

export function createDashboardRequestTiming({ enabled = true, now = () => performance.now() }: {
  enabled?: boolean; now?: () => number
} = {}) {
  const entries: DashboardTimingEntry[] = []
  const clock = () => {
    if (!enabled) return null
    try { const value = now(); return Number.isFinite(value) ? value : null } catch { return null }
  }
  const origin = clock()
  function start(stage: DashboardTimingStage): () => void {
    if (!enabled || origin === null || !isDashboardTimingStage(stage)) return () => {}
    const beginning = clock()
    let stopped = false
    return () => {
      if (stopped) return
      stopped = true
      const end = clock()
      if (beginning === null || end === null || entries.length >= MAX_DASHBOARD_TIMING_ENTRIES) return
      entries.push({ stage, startMs: dashboardTimingMilliseconds(beginning - origin), durationMs: dashboardTimingMilliseconds(end - beginning) })
    }
  }
  return {
    start,
    async measure<T>(stage: DashboardTimingStage, task: () => T | PromiseLike<T>): Promise<T> {
      const stop = start(stage)
      try { return await task() } finally { stop() }
    },
    snapshot(): DashboardTimingEntry[] { return entries.map(entry => ({ ...entry })) },
  }
}
