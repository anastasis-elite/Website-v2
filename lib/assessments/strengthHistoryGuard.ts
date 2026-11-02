'use client'

// The application shell acquires this listener before the router's passive effects.
// Assessment pages register their active guard later without changing its order.
const guards = new Set<(event: PopStateEvent) => void>()
let consumers = 0
let removeListener: (() => void) | null = null

export function acquireStrengthHistoryGuard() {
  if (consumers++ === 0) {
    const listener = (event: PopStateEvent) => {
      for (const guard of guards) {
        guard(event)
        if (event.cancelBubble) break
      }
    }
    window.addEventListener('popstate', listener, true)
    removeListener = () => window.removeEventListener('popstate', listener, true)
  }
  let released = false
  return () => {
    if (released) return
    released = true
    if (--consumers === 0) { removeListener?.(); removeListener = null }
  }
}

export function registerStrengthHistoryGuard(guard: (event: PopStateEvent) => void) {
  const release = acquireStrengthHistoryGuard()
  guards.add(guard)
  return () => { guards.delete(guard); release() }
}
