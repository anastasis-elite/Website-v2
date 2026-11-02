import DashboardPerformance from '@/components/DashboardPerformance'
import DashboardShellTiming from '@/components/DashboardShellTiming'
import TodayStreakBadge from '@/components/program-dashboard/TodayStreakBadge'
import type { ProgramTier } from '@/lib/entitlements'
import styles from './DashboardLoadingShell.module.css'

export function DashboardLoadingContent({ program, showStreak = false }: { program?: ProgramTier; showStreak?: boolean }) {
  return <div className={styles.loading} role="status" aria-live="polite" aria-atomic="true" aria-busy="true">
    <svg className={styles.satin} viewBox="0 0 1000 500" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <defs><linearGradient id="loading-satin-fold" x1="0" y1="0" x2=".2" y2="1"><stop stopColor="#24150d"/><stop offset=".44" stopColor="#815331"/><stop offset=".5" stopColor="#b28356"/><stop offset=".56" stopColor="#5a371f"/><stop offset="1" stopColor="#1d110a"/></linearGradient></defs>
      <g className={styles.folds}><path d="M-200-160C100 120 400 50 630 160S1000 250 1220-150L1250 300C1020 400 730 250 500 190S50 190-200-20Z" fill="url(#loading-satin-fold)" opacity=".55"/><path d="M-200 10Q331 93 587 205T1200-173L1200 265Q864 260 654 230T-200 80Z" fill="url(#loading-satin-fold)" opacity=".45"/></g>
    </svg>
    <header className={styles.content}>
      {showStreak && <TodayStreakBadge loading />}
      <div className={styles.brand}>
        <span>Anastasis Elite</span>
        {program ? <small>{program.toUpperCase()}</small> : null}
      </div>
      <div className={styles.rule} aria-hidden="true" />
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
