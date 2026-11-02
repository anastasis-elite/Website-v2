import DashboardPerformance from '@/components/DashboardPerformance'
import DashboardShellTiming from '@/components/DashboardShellTiming'
import TodayStreakBadge from '@/components/program-dashboard/TodayStreakBadge'
import type { ProgramTier } from '@/lib/entitlements'

export function DashboardLoadingContent({ program, showStreak = false }: { program?: ProgramTier; showStreak?: boolean }) {
  return <div className="today-shell" role="status" aria-live="polite" aria-atomic="true" aria-busy="true">
    <header className="today-header" style={{ position: 'relative', maxWidth: 560, margin: '32px auto', padding: '48px 24px', textAlign: 'center', border: '1px solid var(--anastasis-copper)', borderRadius: 24, background: 'var(--anastasis-charcoal)', color: 'var(--anastasis-ivory)' }}>
      {showStreak && <TodayStreakBadge loading />}
      <div className="today-brand" style={{ display: 'block', marginBottom: 28 }}>
        <span style={{ display: 'block', fontSize: 'clamp(1.25rem, 5vw, 2rem)', letterSpacing: '.14em' }}>Anastasis Elite</span>
        {program ? <small style={{ display: 'inline-block', marginTop: 16 }}>{program.toUpperCase()}</small> : null}
      </div>
      <div aria-hidden="true" style={{ width: 64, height: 2, margin: '0 auto 28px', background: 'var(--anastasis-copper)' }} />
      <h1>Loading your saved day.</h1>
      <p>Your saved activities and progress are loading.</p>
    </header>
  </div>
}

export default function DashboardLoadingShell() {
  return <main className="today-dashboard" data-dashboard-stage="shell">
    <DashboardShellTiming />
    <DashboardPerformance stage="shell" />
    <DashboardLoadingContent />
  </main>
}
