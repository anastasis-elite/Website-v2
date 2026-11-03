// Serializable, allowlisted diagnostics only. These offsets describe one server
// request; they are not synchronized with the browser's performance clock.
export const DASHBOARD_TIMING_STAGES = [
  'routing', 'context', 'safety', 'plan', 'logic-sources', 'schedule-sources',
  'logic', 'schedule', 'recommendation-persistence', 'execution-persistence',
] as const

export type DashboardTimingStage = typeof DASHBOARD_TIMING_STAGES[number]
export type DashboardTimingEntry = { stage: DashboardTimingStage; startMs: number; durationMs: number }

export const MAX_DASHBOARD_TIMING_ENTRIES = 40
export const MAX_DASHBOARD_TIMING_MS = 86_400_000

export function isDashboardTimingStage(value: unknown): value is DashboardTimingStage {
  return typeof value === 'string' && (DASHBOARD_TIMING_STAGES as readonly string[]).includes(value)
}

export function dashboardTimingMilliseconds(value: number): number {
  return Math.round(Math.min(MAX_DASHBOARD_TIMING_MS, Math.max(0, value)) * 1000) / 1000
}

export function sanitizeDashboardTimings(value: unknown): DashboardTimingEntry[] {
  if (!Array.isArray(value)) return []
  const entries: DashboardTimingEntry[] = []
  // Bound inspection as well as output. Never copy arbitrary properties into a
  // browser timing record, even if a caller accidentally supplies extra data.
  for (const item of value.slice(0, MAX_DASHBOARD_TIMING_ENTRIES)) {
    if (!item || typeof item !== 'object' || !isDashboardTimingStage(item.stage)) continue
    if (typeof item.startMs !== 'number' || !Number.isFinite(item.startMs) || item.startMs < 0) continue
    if (typeof item.durationMs !== 'number' || !Number.isFinite(item.durationMs) || item.durationMs < 0) continue
    entries.push({ stage: item.stage, startMs: dashboardTimingMilliseconds(item.startMs), durationMs: dashboardTimingMilliseconds(item.durationMs) })
  }
  return entries
}
