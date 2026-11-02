'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { trackEvent } from '@/lib/analytics'
import './guided-navigation.css'

const hiddenPrefixes = ['/dashboard/signup', '/dashboard/onboarding', '/dashboard/payment-issue']

function TodayIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false"><path d="M4 11.2 12 4l8 7.2"/><path d="M6.5 10v9h11v-9"/><path d="M9.5 19v-5h5v5"/></svg>
}

function CalendarIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false"><path d="M7 3v4"/><path d="M17 3v4"/><path d="M4.5 9h15"/><path d="M6 5h12a2 2 0 0 1 2 2v11.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/><path d="M8 13h3"/><path d="M8 16h5"/></svg>
}

function ProgressIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false"><path d="M5 19V5"/><path d="M5 19h15"/><path d="m8 15 4-4 3 2 5-7"/></svg>
}

function CommunityIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false"><circle cx="9" cy="7" r="3"/><path d="M3 20v-3a6 6 0 0 1 12 0v3M17 4a3 3 0 0 1 0 6M17 13a5 5 0 0 1 4 5v2"/></svg>
}

export default function ClientDashboardNav({ program }: { program: 'ember' | 'ignite' | 'phoenix' }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  if (hiddenPrefixes.some((prefix) => pathname.startsWith(prefix))) return null

  const today = `/dashboard/program/${program}`
  const visualPage = pathname === today || pathname === `${today}/plan`
  const planView = pathname === `${today}/plan` || visualPage && searchParams.get('view') === 'plan'
  const items = [
    { id: 'today', label: 'Today', href: today, active: !planView && (pathname === today || pathname === '/dashboard' || pathname === '/dashboard/main'), tutorialId: 'client-dashboard-home', icon: <TodayIcon/> },
    { id: 'plan', label: 'Plan', href: `${today}?view=plan`, active: planView || pathname.startsWith('/dashboard/schedule') || pathname.startsWith('/dashboard/calendar') || pathname === '/dashboard/settings/calendars', tutorialId: undefined, icon: <CalendarIcon/> },
    { id: 'community', label: 'Community', href: '/dashboard/community', active: pathname.startsWith('/dashboard/community'), tutorialId: undefined, icon: <CommunityIcon/> },
    { id: 'progress', label: 'Progress', href: '/dashboard/progress', active: pathname.startsWith('/dashboard/progress') || pathname.startsWith('/dashboard/assessment'), tutorialId: 'dashboard-progress-navigation', icon: <ProgressIcon/> },
    { id: 'account', label: 'Account', href: '/dashboard/account', active: pathname.startsWith('/dashboard/account') || pathname.startsWith('/dashboard/cycle') || pathname === '/dashboard/support' || pathname === '/support', tutorialId: undefined, icon: <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"/><path d="M5 20v-1a7 7 0 0 1 14 0v1"/></svg> },
  ]

  return <nav className="client-dashboard-nav client-dashboard-nav--guided" aria-label="Member navigation" data-tutorial-id="dashboard-navigation">
    {items.map((item) => <Link
      key={item.id}
      href={item.href}
      className={`client-dashboard-nav__item client-dashboard-nav__item--${item.id}${item.active ? ' active' : ''}`}
      aria-current={item.active ? 'page' : undefined}
      data-nav-item={item.id}
      data-tutorial-id={item.tutorialId}
      onClick={() => trackEvent('dashboard_navigation_clicked', { item: item.id, href: item.href })}
    ><span className="client-dashboard-nav__icon">{item.icon}</span><small>{item.label}</small></Link>)}
  </nav>
}
