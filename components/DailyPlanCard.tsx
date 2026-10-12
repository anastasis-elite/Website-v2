import Link from 'next/link'
import type { DailyRecommendation } from '@/lib/dashboard/dailyRecommendation'
import { formatLocalTime } from '@/lib/schedule/time'
export default function DailyPlanCard({ plan, compact = false }: { plan: DailyRecommendation; compact?: boolean }) {
  return <article className={`daily-plan-card${compact ? ' is-compact' : ''}`} data-testid="shared-daily-plan">
    <p className="tier-dashboard-label">{compact ? 'Today’s plan' : 'Your next step'}</p>
    <p><strong>{plan.training.label}</strong> · {plan.training.readinessNote}</p>
    <h2>{plan.primary.title}</h2><p>{plan.primary.reason}</p>
    <Link className="tier-primary-action" href={plan.primary.href}>{plan.primary.title}</Link>
    <small>Updated {formatLocalTime(plan.generatedAt, plan.timezone)} · {plan.date} · {plan.timezone}</small>
  </article>
}
