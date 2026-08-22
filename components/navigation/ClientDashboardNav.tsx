'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import DashboardMoreMenu from '@/components/navigation/DashboardMoreMenu'

const hiddenPrefixes=['/dashboard/signup','/dashboard/onboarding','/dashboard/payment-issue']

export default function ClientDashboardNav({program}:{program:'ember'|'ignite'|'phoenix'}){
  const pathname=usePathname()
  if(hiddenPrefixes.some((prefix)=>pathname.startsWith(prefix)))return null
  const dashboard=`/dashboard/program/${program}`
  const active=(href:string)=>href===dashboard?pathname===dashboard:pathname.startsWith(href)
  return <nav className="client-dashboard-nav" aria-label="Client dashboard navigation" data-tutorial-id="dashboard-navigation">
    <Link href={dashboard} className={active(dashboard)?'active':''} data-tutorial-id="client-dashboard-home"><span aria-hidden="true">⌂</span><small>Dashboard</small></Link>
    <Link href="/dashboard/schedule" className={active('/dashboard/schedule')?'active':''}><span aria-hidden="true">▣</span><small>Schedule</small></Link>
    <Link href="/dashboard/nutrition" className={active('/dashboard/nutrition')?'active':''} data-tutorial-id="dashboard-nav-nutrition"><span aria-hidden="true">⌁</span><small>Nutrition</small></Link>
    <Link href={`${dashboard}/workout`} className={`client-dashboard-nav__flame ${active(`${dashboard}/workout`)?'active':''}`} aria-label="Open today’s workout"><span aria-hidden="true">🔥</span><small>Workout</small></Link>
    <Link href="/dashboard/check-in" className={active('/dashboard/check-in')?'active':''} data-tutorial-id="dashboard-daily-checkin"><span aria-hidden="true">✓</span><small>Check-In</small></Link>
    <Link href="/dashboard/recovery" className={active('/dashboard/recovery')||active('/dashboard/sleep')||active('/dashboard/meditation')?'active':''} data-tutorial-id="dashboard-nav-recovery"><span aria-hidden="true">♡</span><small>Recovery</small></Link>
    <DashboardMoreMenu program={program}/>
  </nav>
}
