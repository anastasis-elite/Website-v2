'use client'

// Local User Timing entries only: no account identifiers, health data, network
// requests, or persistent browser storage. Read these with performance.getEntries.
export function markDashboardStage(stage: 'shell' | 'primary' | 'secondary' | 'resume') {
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
  } catch {
    // Unsupported/restricted timing APIs must not interfere with daily actions.
  }
}
