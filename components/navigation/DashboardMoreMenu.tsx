'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePathname, useRouter } from 'next/navigation'
import { trackEvent } from '@/lib/analytics'

export default function DashboardMoreMenu({ program }: { program: 'ember' | 'ignite' | 'phoenix' }) {
  const router = useRouter()
  const pathname = usePathname()
  const trigger = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [message, setMessage] = useState('')
  const active = ['/dashboard/account', '/dashboard/settings', '/dashboard/cycle', '/dashboard/community'].some((path) => pathname.startsWith(path))
  const items = [
    { label: 'Account & preferences', href: '/dashboard/account' },
    { label: 'Daily check-in', href: '/dashboard/check-in', tutorialId: 'dashboard-daily-checkin' },
    { label: 'Workout', href: `/dashboard/program/${program}/workout`, tutorialId: 'dashboard-nav-workout' },
    { label: 'Nutrition & hydration', href: '/dashboard/nutrition', tutorialId: 'dashboard-nav-nutrition' },
    { label: 'Recovery', href: '/dashboard/recovery', tutorialId: 'dashboard-nav-recovery' },
    { label: 'Sleep', href: '/dashboard/sleep' },
    { label: 'Meditation', href: '/dashboard/meditation' },
    { label: 'Cycle', href: '/dashboard/cycle' },
    { label: 'Monthly assessments', href: '/dashboard/assessment/monthly' },
    { label: 'Daily structure preferences', href: '/dashboard/assessment/daily-structure' },
    { label: 'Connected calendars', href: '/dashboard/settings/calendars' },
    ...(program === 'phoenix' ? [{ label: 'Recipes', href: '/dashboard/nutrition#phoenix-recipes' }] : []),
    { label: 'Help & support', href: '/support' },
  ]

  function close() {
    setOpen(false)
    trigger.current?.focus()
  }

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        trigger.current?.focus()
      }
    }
    document.addEventListener('keydown', escape)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  async function logout() {
    setLoggingOut(true)
    setMessage('')
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' })
      if (!response.ok) throw new Error('Sign out failed')
      try {
        for (const key of Object.keys(window.sessionStorage)) {
          if (key.startsWith('anastasis:check-in-draft:v1:')) window.sessionStorage.removeItem(key)
        }
      } catch { /* Restricted browser storage does not prevent sign-out. */ }
      router.replace('/login')
      router.refresh()
    } catch {
      setMessage('We couldn’t sign you out. Please try again.')
      setLoggingOut(false)
    }
  }

  return <div className="dashboard-more-menu">
    <button ref={trigger} type="button" className={`dashboard-more-trigger client-dashboard-nav__item client-dashboard-nav__item--you${active || open ? ' active' : ''}`} data-nav-item="you" aria-expanded={open} aria-haspopup="dialog" aria-controls={open ? 'dashboard-you-menu' : undefined} onClick={() => { setOpen((value) => !value); trackEvent('dashboard_navigation_clicked', { item: 'you' }) }}>
      <span className="client-dashboard-nav__icon"><svg aria-hidden="true" viewBox="0 0 24 24" focusable="false"><circle cx="12" cy="8" r="3.5"/><path d="M5 20v-1a7 7 0 0 1 14 0v1"/></svg></span><small>You</small>
    </button>
    {open ? createPortal(<div className="dashboard-more-backdrop dashboard-you-backdrop" onClick={close}>
      <div id="dashboard-you-menu" className="dashboard-more-sheet dashboard-you-sheet" role="dialog" aria-modal="true" aria-labelledby="dashboard-you-title" onKeyDown={(event) => {
        if (event.key !== 'Tab') return
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('a[href],button:not([disabled])'))
        const first = controls[0], last = controls.at(-1)
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }} onClick={(event) => event.stopPropagation()}>
        <div className="dashboard-more-heading"><div><small>{program}</small><h2 id="dashboard-you-title">You</h2></div><button type="button" autoFocus onClick={close} aria-label="Close your tools">×</button></div>
        <p className="dashboard-you-copy">Your tools, preferences, and support.</p>
        <nav aria-label="Member tools">{items.map(({ label, href, tutorialId }) => <Link key={label} href={href} data-tutorial-id={tutorialId} onClick={() => { setOpen(false); trackEvent('dashboard_navigation_clicked', { item: label, href }) }}>{label}<span aria-hidden="true">›</span></Link>)}</nav>
        <button type="button" className="dashboard-more-logout" disabled={loggingOut} onClick={logout}>{loggingOut ? 'Signing out…' : 'Sign out'}</button>
        {message ? <p role="alert" className="dashboard-you-copy">{message}</p> : null}
      </div>
    </div>, document.body) : null}
  </div>
}
