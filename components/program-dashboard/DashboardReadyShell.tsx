import DashboardPerformance from '@/components/DashboardPerformance'
import type { ProgramTier } from '@/lib/entitlements'
import DashboardShellTiming from '@/components/DashboardShellTiming'
import { DashboardLoadingContent } from '@/components/program-dashboard/DashboardLoadingShell'

// Rendered only after member access, tier and safety checks have completed.
// Saved personalization is still pending, so this shell cannot choose actions.
export default function DashboardReadyShell({ program, showStreak = true }: { program: ProgramTier; showStreak?: boolean }) {
  return <div className="today-dashboard" data-tier={program} data-dashboard-stage="shell">
    <DashboardShellTiming />
    <DashboardPerformance stage="shell" />
    <DashboardLoadingContent program={program} showStreak={showStreak} />
  </div>
}
