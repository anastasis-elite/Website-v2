'use client'

import Link from 'next/link'
import type { CSSProperties } from 'react'
import type { AccountData, AccountProfileFormData } from '@/lib/dashboard/account/types'
import AccountProfileForm from '@/components/AccountProfileForm'
import LogoutButton from './LogoutButton'
import { useAccountData, useClientProfile, useJourneyStats, useProgramEnrollment, useStreakData, useWeeklyCompletionStats } from './hooks'

const quickActions = [
  { icon: '▣', title: 'My Plan', detail: 'View your program', route: 'program' },
  { icon: 'Ψ', title: 'Nutrition', detail: 'Log food & macros', href: '/dashboard/nutrition' },
  { icon: '▥', title: 'Progress', detail: 'See your results', href: '/dashboard/assessment/measurements' },
  { icon: '▧', title: 'Photos', detail: 'Track transformation', href: '/dashboard/assessment/photos' },
  { icon: '✓', title: 'Assessments', detail: 'Check-ins & tests', href: '/dashboard/assessment' },
] as const

function formatDate(value: string | null) {
  if (!value) return 'Not available yet'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Not available yet' : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}

function displayMetric(value: number | null, suffix = '') { return value === null ? '—' : `${value}${suffix}` }

export default function AccountDashboard({ initialData, client, user }: { initialData: AccountData; client: AccountProfileFormData; user: { email: string | null } }) {
  const data = useAccountData(initialData)
  const profile = useClientProfile(data)
  const enrollment = useProgramEnrollment(data)
  const summary = useJourneyStats(data)
  const journey = useWeeklyCompletionStats(data)
  const { streak, flame } = useStreakData(data)
  const dashboardHref = `/dashboard/program/${enrollment.program}`
  const workoutHref = `${dashboardHref}/workout`
  const avatarStyle = profile.avatarUrl ? { backgroundImage: `linear-gradient(rgba(8,5,3,.08),rgba(8,5,3,.2)),url("${profile.avatarUrl}")` } : undefined

  return (
    <main className="account-dashboard" style={{ '--account-intensity': Math.max(.25, flame.score / 100) } as CSSProperties}>
      <div className="account-shell">
        <header className="account-page-header"><div><h1>Account</h1><p>You&apos;re building something powerful.</p></div><Link href="#account-settings" className="account-gear" aria-label="Account settings">⚙</Link></header>

        <section className="account-hero-grid">
          <article className="account-profile-hero">
            <div className="account-avatar" style={avatarStyle} role="img" aria-label={`${profile.name} profile photo`}><span>{profile.avatarUrl ? '' : initials(profile.name)}</span></div>
            <div className="account-profile-copy"><h2>{profile.name} <span aria-hidden="true">🔥</span></h2><p className="account-program-label">{profile.program} program</p><p>{profile.capacityStatement}</p><a href="#personal-info" className="account-outline-button">Edit Profile</a></div>
          </article>
          <article className="account-streak-card" data-flame-state={flame.state}><div><small>Current streak</small><strong>{streak}<span> days</span></strong><hr/><small>Member since</small><p>{formatDate(profile.memberSince)}</p></div><span className="account-large-flame" aria-hidden="true">🔥</span></article>
        </section>

        <section className="account-stats" aria-label="Account statistics">
          <div><span>🔥</span><small>Total days</small><strong>{summary.totalCompletedDays}</strong><p>completed</p></div>
          <div><span>◎</span><small>Goal progress</small><strong>{displayMetric(summary.goalProgressPercent, '%')}</strong><p>{summary.goalProgressPercent === null ? 'add goal data' : 'on track'}</p></div>
          <div><span>↟</span><small>Workouts</small><strong>{summary.workoutsCompleted}</strong><p>completed</p></div>
          <div><span>♢</span><small>Water avg</small><strong>{displayMetric(summary.waterAverageOz)}</strong><p>{summary.waterAverageOz === null ? 'no logs yet' : 'oz daily'}</p></div>
          <div><span>♥</span><small>Recovery score</small><strong>{displayMetric(summary.recoveryAveragePercent, '%')}</strong><p>{summary.recoveryAveragePercent === null ? 'no logs yet' : '30 day avg'}</p></div>
        </section>

        <section className="account-panel account-quick-panel"><div className="account-section-heading"><h2>Quick actions</h2><span>Manage your plan and progress</span></div><div className="account-quick-grid">{quickActions.map((action) => { const href = 'route' in action ? workoutHref : action.href; return <Link href={href} key={action.title} className="account-quick-action"><span aria-hidden="true">{action.icon}</span><strong>{action.title}</strong><small>{action.detail}</small><b aria-hidden="true">→</b></Link> })}</div></section>

        <section className="account-lower-grid">
          <article className="account-panel account-settings" id="account-settings"><h2>Account</h2><a href="#personal-info" className="account-setting-row"><span className="account-setting-icon" aria-hidden="true">♙</span><span><strong>Personal Info</strong><small>Update your profile and preferences</small></span><span aria-hidden="true">›</span></a><a href="#security" className="account-setting-row"><span className="account-setting-icon" aria-hidden="true">▣</span><span><strong>Security</strong><small>Password and login settings</small></span><span aria-hidden="true">›</span></a><a href="#notifications" className="account-setting-row"><span className="account-setting-icon" aria-hidden="true">♢</span><span><strong>Notifications</strong><small>Manage alerts and reminders</small></span><span aria-hidden="true">›</span></a><a href="#billing" className="account-setting-row"><span className="account-setting-icon" aria-hidden="true">▤</span><span><strong>Billing & Subscriptions</strong><small>{profile.subscriptionStatus ? `Status: ${profile.subscriptionStatus}` : 'Plan and payment support'}</small></span><span aria-hidden="true">›</span></a><a href="mailto:Anastasis.elite@gmail.com?subject=Account%20Support" className="account-setting-row"><span className="account-setting-icon" aria-hidden="true">?</span><span><strong>Help & Support</strong><small>Get help or contact support</small></span><span aria-hidden="true">›</span></a><LogoutButton /></article>

          <article className="account-panel account-journey"><div className="account-section-heading"><h2>Your journey</h2><span>This week</span></div><div className="account-journey-ring" style={{ '--journey-progress': `${journey.averageCompletionPercent * 3.6}deg` } as CSSProperties}><div><strong>{journey.averageCompletionPercent}%</strong><small>Average completion</small></div></div><div className="account-journey-list">{journey.metrics.map((item) => <div key={item.key}><span className={item.percent >= 100 ? 'complete' : ''}>{item.percent >= 100 ? '✓' : '○'}</span><strong>{item.label}</strong><small>{item.completed} / {item.target}</small></div>)}</div><Link href="/dashboard/assessment/measurements" className="account-outline-button">View Full Progress</Link></article>
        </section>

        <section className="account-manage-grid" aria-label="Manage account details">
          <details className="account-panel account-detail-panel" id="personal-info"><summary>Personal Info <span>Open ›</span></summary><AccountProfileForm client={client} user={user} mode="profile" /><div className="account-detail-copy"><Link href="/dashboard/assessment/daily-structure" className="account-outline-button">Update Daily Structure</Link></div></details>
          <details className="account-panel account-detail-panel" id="security"><summary>Security <span>Open ›</span></summary><AccountProfileForm client={client} user={user} mode="security" /></details>
          <details className="account-panel account-detail-panel" id="notifications"><summary>Notifications <span>Open ›</span></summary><div className="account-detail-copy"><p>Account reminders currently use <strong>{profile.email}</strong>.</p><p>Granular notification controls will appear here when reminder delivery is enabled.</p></div></details>
          <details className="account-panel account-detail-panel" id="billing"><summary>Billing & Subscriptions <span>Open ›</span></summary><div className="account-detail-copy"><p>Current status: <strong>{profile.subscriptionStatus || 'Contact support to confirm'}</strong></p><div className="account-inline-actions"><Link href="/refund-policy">Billing policy</Link><a href="mailto:Anastasis.elite@gmail.com?subject=Billing%20Support">Contact billing support</a></div></div></details>
        </section>

      </div>
    </main>
  )
}
