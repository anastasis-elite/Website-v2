'use client'

import { DASHBOARD_TIMING_STAGES, dashboardTimingMilliseconds, MAX_DASHBOARD_TIMING_MS, sanitizeDashboardTimings, type DashboardTimingEntry } from './dashboardTimingTypes'

const todayMilestones = ['today-hydrated', 'today-layout-visible', 'today-carousel-interactive', 'today-check-in-ready', 'today-check-in-clickable'] as const
const startupTimingNames = DASHBOARD_TIMING_STAGES.map(stage => `anastasis:today:startup:server:${stage}`)
let startupOwner: object | null = null
let documentResponsePublished = false

function publishDocumentResponseTiming() {
  if (documentResponsePublished || typeof performance.getEntriesByType !== 'function') return
  // These are the browser's document navigation timings, never an inferred RSC
  // or warm-resume response. Ignore restores and unfinished/invalid responses.
  const navigation = performance.getEntriesByType('navigation')[0] as (PerformanceNavigationTiming & { activationStart?: number }) | undefined
  if (!navigation || !['navigate', 'reload'].includes(navigation.type) || (navigation.activationStart || 0) > 0) return
  const middlewareTimings = Array.isArray(navigation.serverTiming) ? navigation.serverTiming.slice(0, 40) : []
  for (const [remote, local] of [['today_mw_auth', 'auth'], ['today_mw_context', 'context']]) {
    const entry = middlewareTimings.find(value => value.name === remote && typeof value.duration === 'number' &&
      Number.isFinite(value.duration) && value.duration >= 0 && value.duration <= MAX_DASHBOARD_TIMING_MS)
    const name = `anastasis:today:middleware:${local}`
    if (entry && !performance.getEntriesByName(name).length) {
      performance.mark(name, { detail: { durationMs: dashboardTimingMilliseconds(entry.duration) } })
    }
  }
  const { requestStart, responseStart, responseEnd } = navigation
  if (![requestStart, responseStart, responseEnd].every(value => Number.isFinite(value) && value >= 0 && value <= MAX_DASHBOARD_TIMING_MS) ||
    responseStart < requestStart) return
  if (responseEnd === 0) return true
  if (responseEnd < responseStart) return
  documentResponsePublished = true
  performance.mark('anastasis:document-response-start', { startTime: responseStart })
  performance.mark('anastasis:document-response-end', { startTime: responseEnd })
  performance.measure('anastasis:navigation-to-document-response-start', { start: 0, end: responseStart })
  performance.measure('anastasis:document-request-to-first-byte', { start: requestStart, end: responseStart })
  performance.measure('anastasis:document-response-download', { start: responseStart, end: responseEnd })
}

// Each mounted/revalidated Today gets bounded local measurements. No identity,
// date, health information or other member content enters User Timing detail.
export function beginTodayStartup(timings?: readonly DashboardTimingEntry[]): () => void {
  const owner = {}
  startupOwner = owner
  let disposed = false
  let stopDocumentObserver = () => {}
  const clear = () => {
    if (typeof performance === 'undefined') return
    for (const stage of todayMilestones) {
      try {
        performance.clearMarks(`anastasis:${stage}`)
        performance.clearMeasures(`anastasis:navigation-to-${stage}`)
        performance.clearMeasures(`anastasis:today:start-to-${stage}`)
      } catch { /* Local diagnostics cannot affect daily actions. */ }
    }
    for (const name of [...startupTimingNames, 'anastasis:today:start']) {
      try { performance.clearMarks(name) } catch { /* Optional local diagnostics. */ }
    }
  }
  clear()
  try {
    if (typeof performance !== 'undefined' && typeof performance.mark === 'function') {
      performance.mark('anastasis:today:start')
      for (const entry of sanitizeDashboardTimings(timings)) {
        performance.mark(`anastasis:today:startup:server:${entry.stage}`, { detail: { startMs: entry.startMs, durationMs: entry.durationMs } })
      }
      // Called by Today's committed effect. This is hydration completion as
      // observed by React; it does not claim to measure CPU-only hydration cost.
      markDashboardStage('today-hydrated')
      if (publishDocumentResponseTiming() === true && typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        const loaded = () => {
          if (disposed || startupOwner !== owner) return
          try { publishDocumentResponseTiming() } catch { /* Optional local diagnostics. */ }
        }
        // A streamed document can hydrate Today before responseEnd is known.
        // Observe document completion once; never poll or inspect RSC resources.
        if (typeof document !== 'undefined' && document.readyState === 'complete') loaded()
        else {
          window.addEventListener('load', loaded, { once: true })
          stopDocumentObserver = () => window.removeEventListener('load', loaded)
        }
      }
    }
  } catch { /* Local timing is optional. */ }
  return () => {
    disposed = true
    stopDocumentObserver()
    if (startupOwner !== owner) return
    clear()
    startupOwner = null
  }
}

// Local User Timing entries only: no account identifiers, health data, network
// requests, or persistent browser storage. Read these with performance.getEntries.
export function markDashboardStage(stage: 'shell' | 'primary' | 'secondary' | 'resume' | typeof todayMilestones[number]) {
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
