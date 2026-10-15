'use client'

import { markDashboardStage } from '@/lib/performance/dashboard'

const lastPassiveRefresh = new WeakMap<object, number>()

export function requestDashboardRefresh(router: { refresh(): void }, reason: 'passive' | 'saved' | 'resume' = 'passive') {
  const now = Date.now()
  if (reason === 'resume') markDashboardStage('resume')
  // A mobile resume commonly fires focus + visibilitychange, across several
  // modules. Collapse these signals; a confirmed save always refreshes.
  if (reason !== 'saved' && now - (lastPassiveRefresh.get(router) ?? -Infinity) < 1000) return
  lastPassiveRefresh.set(router, now)
  router.refresh()
}
