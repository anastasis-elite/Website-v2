import DashboardPerformance from '@/components/DashboardPerformance'
import DashboardShellTiming from '@/components/DashboardShellTiming'

export default function DashboardLoadingShell() {
  return <main className="today-dashboard" data-dashboard-stage="shell">
    <DashboardShellTiming />
    <DashboardPerformance stage="shell" />
    <div className="today-shell" role="status" aria-live="polite" aria-busy="true">
      <header className="today-header">
        <div className="today-brand"><span>Anastasis</span></div>
        <h1>Your day, made lighter.</h1>
        <p>Loading your saved day…</p>
      </header>
      <div className="today-loading-placeholder" aria-hidden="true" />
    </div>
  </main>
}
