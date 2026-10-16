'use client'

import Link from 'next/link'
import type { DailyRecommendation } from '@/lib/dashboard/dailyRecommendation'
import { formatLocalTime } from '@/lib/schedule/time'
import { useDailyScheduleRefresh } from '@/lib/schedule/client'
import type { DailyScheduleState } from '@/lib/schedule/types'
import { useEffect, useState } from 'react'
import type { ScheduleEvent } from '@/lib/schedule/types'
import ScheduleEventActions from './ScheduleEventActions'
export default function DailyPlanCard({ plan, compact = false, schedule, autoRefresh = true, onSaved }: { plan: DailyRecommendation; compact?: boolean; schedule?: DailyScheduleState; autoRefresh?: boolean; onSaved?: (event: ScheduleEvent, state?: DailyScheduleState) => void }) {
  const [savedState, setSavedState] = useState<DailyScheduleState | null>(null)
  const [awaitingRefresh, setAwaitingRefresh] = useState(false)
  useEffect(() => { setSavedState(null); setAwaitingRefresh(false) }, [schedule, plan])
  const activeSchedule = savedState || schedule
  const activePlan = savedState?.dailyRecommendation || plan
  const event = activePlan.primary.eventId ? activeSchedule?.events.find(item => item.id === activePlan.primary.eventId) : undefined
  useDailyScheduleRefresh(schedule || { date: plan.date, timezone: plan.timezone, events: [] }, autoRefresh)
  return <article className={`daily-plan-card${compact ? ' is-compact' : ''}`} data-testid="shared-daily-plan">
    <p className="tier-dashboard-label">{compact ? 'Today’s plan' : 'Your next step'}</p>
    <h2>{awaitingRefresh ? 'Your change is saved' : activePlan.primary.title}</h2><p>{awaitingRefresh ? 'Refreshing your next step…' : activePlan.primary.reason}</p>
    {awaitingRefresh ? <Link className="tier-secondary-action" href="/dashboard">See Today’s next step</Link> : event ? <ScheduleEventActions key={event.id} event={event} timezone={plan.timezone} program={activeSchedule?.program} date={plan.date} canChangeTime={!activeSchedule?.unavailableSources?.length} onSaved={(saved, state) => { if (state?.dailyRecommendation) setSavedState(state); else setAwaitingRefresh(true); onSaved?.(saved, state) }} /> : <Link className="tier-primary-action" href={activePlan.primary.href}>{activePlan.primary.title}</Link>}
    {compact ? <Link className="daily-return-today" href="/dashboard">Return to Today</Link> : null}
    <details className="daily-plan-context"><summary>Plan details</summary><p><strong>{plan.training.label}</strong> · {plan.training.readinessNote}</p><small>Updated {formatLocalTime(plan.generatedAt, plan.timezone)} · {plan.date}</small></details>
  </article>
}
