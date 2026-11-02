import Link from 'next/link'
import { getTierCapabilities } from '@/lib/entitlements'
import type { ProgramLogicOutput } from '@/lib/dashboard/logic/types'
import type { DailyScheduleState } from '@/lib/schedule/types'
import TodayDashboardHeader from './TodayDashboardHeader'
import styles from './TodayPlanTheme.module.css'

export default function PlanOverview({ logic, schedule }: { logic: ProgramLogicOutput; schedule: DailyScheduleState }) {
  const capabilities = getTierCapabilities(logic.program)
  const workoutDayState = logic.workoutDecision.assignedWorkout?.workout_state
  const inactiveWorkoutDay = workoutDayState === 'rest' || workoutDayState === 'unavailable'
  const cards = [
    { kind: 'training', label: 'Movement', title: 'Your training', detail: logic.workout.assigned || inactiveWorkoutDay ? logic.workout.title : 'Make room for movement and rest.', action: 'Explore sessions', href: `/dashboard/program/${logic.program}/workout`, enabled: capabilities.workoutDisplay },
    { kind: 'nutrition', label: 'Nourishment', title: 'Your nutrition', detail: 'Your daily targets, in one place.', action: 'View targets', href: '/dashboard/nutrition', enabled: capabilities.nutritionTracking },
    { kind: 'recovery', label: 'Rest & recovery', title: 'Your recovery', detail: 'Make room to restore.', action: 'View recovery', href: '/dashboard/recovery', enabled: capabilities.recoveryBasic },
    { kind: 'schedule', label: 'Your time', title: 'Your schedule', detail: 'See how your week comes together.', action: 'Open schedule', href: '/dashboard/schedule', enabled: capabilities.calendar },
  ].filter(card => card.enabled)
  return <div className={`today-dashboard ${styles.surface}`} data-tier={logic.program} data-view="plan"><div className="today-shell">
    <TodayDashboardHeader logic={logic} schedule={schedule} plan />
    <section className="plan-overview" aria-labelledby="plan-overview"><h2 id="plan-overview">Your plan, at a glance.</h2>
      <div className="plan-overview-grid">{cards.map(card => <article key={card.kind} className="plan-overview-card">
        <img src={`/illustrations/today-${card.kind}.svg`} width="360" height="180" alt="" className="today-card-illustration" />
        <div className="plan-overview-copy"><p className="today-card-kicker">{card.label}</p><h3>{card.title}</h3><p>{card.detail}</p><Link href={card.href}>{card.action}<span aria-hidden="true">↗</span></Link></div>
      </article>)}</div>
    </section>
    <nav className="today-rhythm-links" aria-label="Plan settings"><Link href="/dashboard/schedule/settings">Schedule settings</Link><Link href="/dashboard/assessment/monthly">Due assessments</Link></nav>
  </div></div>
}
