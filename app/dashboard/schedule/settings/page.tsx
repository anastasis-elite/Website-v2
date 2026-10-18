import Link from 'next/link'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'

export default async function ScheduleSettingsPage() {
  await getDashboardContext()
  return <main className="schedule-page"><div className="schedule-shell schedule-daily-shell">
    <Link className="schedule-settings-link" href="/dashboard/schedule">‹ Back to my day</Link>
    <header className="schedule-hero"><div><p className="schedule-label">Schedule · Settings</p><h1>A rhythm that fits your life</h1><p>Adjust your routine when your day changes.</p></div></header>
    <nav className="schedule-settings-options" aria-label="Schedule settings">
      <Link className="schedule-panel" href="/dashboard/schedule/settings/routine"><strong>Edit My Routine</strong><span>Review your saved Schedule Structure Assessment and recurring commitments.</span></Link>
      <Link className="schedule-panel" href="/dashboard/settings/calendars"><strong>Connected calendars</strong><span>Manage Google, Apple, and other calendar connections.</span></Link>
    </nav>
  </div></main>
}
