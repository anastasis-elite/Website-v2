'use client'

import { DASHBOARD_TIMING_STAGES, sanitizeDashboardTimings, type DashboardTimingEntry } from './dashboardTimingTypes'

const todayMilestones = ['today-layout-visible', 'today-carousel-interactive', 'today-check-in-clickable'] as const

// Each mounted/revalidated Today gets bounded local measurements. No identity,
// date, health information or other member content enters User Timing detail.
export function beginTodayStartup() {
  if (typeof performance === 'undefined') return
  try {
    for (const stage of todayMilestones) {
      performance.clearMarks(`anastasis:${stage}`)
      performance.clearMeasures(`anastasis:navigation-to-${stage}`)
      performance.clearMeasures(`anastasis:today:start-to-${stage}`)
    }
    performance.clearMarks('anastasis:today:start')
    performance.mark('anastasis:today:start')
  } catch { /* Local timing is optional. */ }
}

// Local User Timing entries only: no account identifiers, health data, network
// requests, or persistent browser storage. Read these with performance.getEntries.
export function markDashboardStage(stage: 'shell' | 'primary' | 'secondary' | 'resume' | 'today-layout-visible' | 'today-carousel-interactive' | 'today-check-in-clickable') {
  if (typeof performance === 'undefined' || typeof performance.mark !== 'function') return
  try {
    if (stage === 'secondary') {
      const resume = performance.getEntriesByName('anastasis:resume').at(-1)
      const previous = performance.getEntriesByName('anastasis:resume-to-secondary').at(-1)
      if (resume && (!previous || previous.startTime < resume.startTime)) {
        performance.measure('anastasis:resume-to-secondary', { start: resume.startTime, end: performance.now() })
      }
    }
    const name = `anastasis:${stage}`
    if (stage !== 'resume' && performance.getEntriesByName(name).length) return
    performance.mark(name)
    if (stage !== 'resume') performance.measure(`anastasis:navigation-to-${stage}`, { start: 0, end: name })
    if ((todayMilestones as readonly string[]).includes(stage) && performance.getEntriesByName('anastasis:today:start').length) {
      performance.measure(`anastasis:today:start-to-${stage}`, { start: 'anastasis:today:start', end: name })
    }
  } catch {
    // Unsupported/restricted timing APIs must not interfere with daily actions.
  }
}

const requestTimingNames = DASHBOARD_TIMING_STAGES.map(stage => `anastasis:today:server:${stage}`)
const actionableTimingName = 'anastasis:today:actionable'
let timingOwner: object | null = null

// Only the currently mounted primary render owns these bounded, local records.
// Legacy shell/resume markers above retain their existing behavior. Server
// offsets stay in numeric detail; their clock is not the browser's clock.
export function publishDashboardRequestTimings(timings: readonly DashboardTimingEntry[] | undefined, actionable = false): () => void {
  const owner = {}
  timingOwner = owner
  const clear = () => {
    for (const name of [...requestTimingNames, actionableTimingName]) {
      try { performance.clearMarks(name) } catch { /* Optional local diagnostics. */ }
    }
  }
  clear()
  try {
    if (typeof performance !== 'undefined' && typeof performance.mark === 'function') {
      for (const entry of sanitizeDashboardTimings(timings)) {
        performance.mark(`anastasis:today:server:${entry.stage}`, { detail: { startMs: entry.startMs, durationMs: entry.durationMs } })
      }
      if (actionable === true) performance.mark(actionableTimingName)
    }
  } catch {
    // Unsupported/restricted timing APIs must not interfere with daily actions.
  }
  return () => {
    if (timingOwner !== owner) return
    clear()
    timingOwner = null
  }
}
