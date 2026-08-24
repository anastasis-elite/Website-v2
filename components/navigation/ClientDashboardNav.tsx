'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import DashboardMoreMenu from '@/components/navigation/DashboardMoreMenu'
import { trackEvent } from '@/lib/analytics'

const hiddenPrefixes=['/dashboard/signup','/dashboard/onboarding','/dashboard/payment-issue']
const navClick=(item:string,href:string)=>trackEvent('dashboard_navigation_clicked',{item,href})

function DashboardIcon(){
  return <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false"><path d="M4 11.2 12 4l8 7.2"/><path d="M6.5 10v9h11v-9"/><path d="M9.5 19v-5h5v5"/></svg>
}

function WorkoutIcon(){
  return <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false"><path d="M5 9v6"/><path d="M9 7v10"/><path d="M15 7v10"/><path d="M19 9v6"/><path d="M9 12h6"/><path d="M3 12h2"/><path d="M19 12h2"/></svg>
}

export default function ClientDashboardNav({program}:{program:'ember'|'ignite'|'phoenix'}){
  const pathname=usePathname()
  if(hiddenPrefixes.some((prefix)=>pathname.startsWith(prefix)))return null
  const dashboard=`/dashboard/program/${program}`
  const workout=`${dashboard}/workout`
  const active=(href:string)=>href===dashboard?pathname===dashboard:pathname.startsWith(href)
  return <nav className="client-dashboard-nav" aria-label="Client dashboard navigation" data-tutorial-id="dashboard-navigation">
    <Link href={dashboard} className={active(dashboard)?'active':''} aria-current={active(dashboard)?'page':undefined} aria-label="Open dashboard" data-tutorial-id="client-dashboard-home" onClick={()=>navClick('dashboard',dashboard)}><DashboardIcon/><small>Dashboard</small></Link>
    <Link href="/dashboard/schedule" className={active('/dashboard/schedule')?'active':''}><span aria-hidden="true">▣</span><small>Schedule</small></Link>
    <Link href="/dashboard/nutrition" className={active('/dashboard/nutrition')?'active':''} data-tutorial-id="dashboard-nav-nutrition"><span aria-hidden="true">⌁</span><small>Nutrition</small></Link>
    <Link href={workout} className={active(workout)?'active':''} aria-current={active(workout)?'page':undefined} aria-label="Open workout" data-tutorial-id="dashboard-nav-workout" onClick={()=>navClick('workout',workout)}><WorkoutIcon/><small>Workout</small></Link>
    <Link href="/dashboard/check-in" className={active('/dashboard/check-in')?'active':''} data-tutorial-id="dashboard-daily-checkin"><span aria-hidden="true">✓</span><small>Check-In</small></Link>
    <Link href="/dashboard/recovery" className={active('/dashboard/recovery')||active('/dashboard/sleep')||active('/dashboard/meditation')?'active':''} data-tutorial-id="dashboard-nav-recovery"><span aria-hidden="true">♡</span><small>Recovery</small></Link>
    <DashboardMoreMenu program={program}/>
  </nav>
}
