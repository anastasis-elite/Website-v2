'use client'

import Link from 'next/link'
import type { DailyRecommendation } from '@/lib/dashboard/dailyRecommendation'
import { formatLocalTime } from '@/lib/schedule/time'
import { useDailyScheduleRefresh } from '@/lib/schedule/client'
import type { DailyScheduleState } from '@/lib/schedule/types'
export default function DailyPlanCard({ plan, compact = false, schedule, autoRefresh = true }: { plan: DailyRecommendation; compact?: boolean; schedule?: DailyScheduleState; autoRefresh?: boolean }) {
  useDailyScheduleRefresh(schedule || { date: plan.date, timezone: plan.timezone, events: [] }, autoRefresh)
  return <article className={`daily-plan-card${compact ? ' is-compact' : ''}`} data-testid="shared-daily-plan">
    <p className="tier-dashboard-label">{compact ? 'Today’s plan' : 'Your next step'}</p>
    <h2>{plan.primary.title}</h2><p>{plan.primary.reason}</p>
    <Link className="tier-primary-action" href={plan.primary.href}>{plan.primary.title}</Link>
    {compact ? <Link className="daily-return-today" href="/dashboard">Return to Today</Link> : null}
    <details className="daily-plan-context"><summary>Plan details</summary><p><strong>{plan.training.label}</strong> · {plan.training.readinessNote}</p><small>Updated {formatLocalTime(plan.generatedAt, plan.timezone)} · {plan.date}</small></details>
  </article>
}
