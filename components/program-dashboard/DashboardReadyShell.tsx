import Link from 'next/link'
import DashboardPerformance from '@/components/DashboardPerformance'
import type { ProgramTier } from '@/lib/entitlements'
import { WATER_ENTRY_HREF, foodEntryHref } from '@/lib/nutrition/loggingRoutes'
import DashboardShellTiming from '@/components/DashboardShellTiming'
import TodayStreakBadge from '@/components/program-dashboard/TodayStreakBadge'

// Rendered only after member access, tier and safety checks have completed.
// These actions do not imply that any activity has already been recorded.
export default function DashboardReadyShell({ program, showStreak = true }: { program: ProgramTier; showStreak?: boolean }) {
  return <div className="today-dashboard" data-tier={program} data-dashboard-stage="primary">
    <DashboardShellTiming />
    <DashboardPerformance stage="shell" />
    <DashboardPerformance stage="primary" />
    <div className="today-shell">
      <header className="today-header">
        {showStreak && <TodayStreakBadge loading />}
        <div className="today-brand"><span>Anastasis</span><small>{program.toUpperCase()}</small></div>
        <h1>Your day, made lighter.</h1>
      </header>
      <section className="today-next" aria-label="Daily actions">
        <p className="tier-dashboard-label">Start with you</p>
        <h2>Your daily check-in.</h2>
        <p>Start or review today’s check-in while your saved day loads.</p>
        <Link className="tier-primary-action" href="/dashboard/check-in" prefetch={false}>Open daily check-in</Link>
      </section>
      <div className="today-activities">
        <ul>
          <li><Link href={WATER_ENTRY_HREF} prefetch={false}><span className="today-activity-icon" aria-hidden="true">◒</span><span className="today-activity-copy"><strong>Log water</strong></span></Link></li>
          <li><Link href={foodEntryHref(program)} prefetch={false}><span className="today-activity-icon" aria-hidden="true">◡</span><span className="today-activity-copy"><strong>{program === 'ember' ? 'Nutrition guidance' : 'Log food'}</strong></span></Link></li>
        </ul>
      </div>
      <p role="status" aria-live="polite">Loading your saved progress and What’s Next…</p>
    </div>
  </div>
}
