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

function CalendarIcon(){
  return <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false"><path d="M7 3v4"/><path d="M17 3v4"/><path d="M4.5 9h15"/><path d="M6 5h12a2 2 0 0 1 2 2v11.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/><path d="M8 13h3"/><path d="M8 16h5"/></svg>
}

function NutritionIcon(){
  return <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false"><path d="M7 3v8"/><path d="M4.5 3v5.5A2.5 2.5 0 0 0 7 11v10"/><path d="M9.5 3v5.5A2.5 2.5 0 0 1 7 11"/><path d="M16 3v18"/><path d="M16 3c2.2 1.2 3.5 3.4 3.5 6.2 0 2.4-1.1 4.1-3.5 4.8"/></svg>
}

function CheckInIcon(){
  return <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false"><path d="M5 12.5 9.3 17 19 7"/><path d="M4.5 5.5h15v15h-15z"/></svg>
}

function RecoveryIcon(){
  return <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false"><path d="M12 20s-7-4.35-7-10.2A3.8 3.8 0 0 1 12 7.7a3.8 3.8 0 0 1 7 2.1C19 15.65 12 20 12 20Z"/><path d="M8.5 12h2l1-2.4 1.8 5 1-2.6h1.8"/></svg>
}

export default function ClientDashboardNav({program}:{program:'ember'|'ignite'|'phoenix'}){
  const pathname=usePathname()
  if(hiddenPrefixes.some((prefix)=>pathname.startsWith(prefix)))return null
  const dashboard=`/dashboard/program/${program}`
  const workout=`${dashboard}/workout`
  const active=(href:string)=>href===dashboard?pathname===dashboard:pathname.startsWith(href)
  const itemClass=(item:string,href:string)=>`client-dashboard-nav__item client-dashboard-nav__item--${item}${active(href)?' active':''}`
  return <nav className="client-dashboard-nav" aria-label="Client dashboard navigation" data-tutorial-id="dashboard-navigation">
    <Link href={workout} className={itemClass('workout',workout)} aria-current={active(workout)?'page':undefined} aria-label="Open workout" data-nav-item="workout" data-tutorial-id="dashboard-nav-workout" onClick={()=>navClick('workout',workout)}><span className="client-dashboard-nav__icon"><WorkoutIcon/></span><small>Workout</small></Link>
    <Link href="/dashboard/schedule" className={itemClass('schedule','/dashboard/schedule')} aria-current={active('/dashboard/schedule')?'page':undefined} data-nav-item="schedule"><span className="client-dashboard-nav__icon"><CalendarIcon/></span><small>Schedule</small></Link>
    <Link href="/dashboard/nutrition" className={itemClass('nutrition','/dashboard/nutrition')} aria-current={active('/dashboard/nutrition')?'page':undefined} data-nav-item="nutrition" data-tutorial-id="dashboard-nav-nutrition"><span className="client-dashboard-nav__icon"><NutritionIcon/></span><small>Nutrition</small></Link>
    <Link href={dashboard} className={itemClass('dashboard',dashboard)} aria-current={active(dashboard)?'page':undefined} aria-label="Open dashboard" data-nav-item="dashboard" data-tutorial-id="client-dashboard-home" onClick={()=>navClick('dashboard',dashboard)}><span className="client-dashboard-nav__icon client-dashboard-nav__icon--dashboard"><DashboardIcon/></span><small>Dashboard</small></Link>
    <Link href="/dashboard/check-in" className={itemClass('checkin','/dashboard/check-in')} aria-current={active('/dashboard/check-in')?'page':undefined} data-nav-item="check-in" data-tutorial-id="dashboard-daily-checkin"><span className="client-dashboard-nav__icon"><CheckInIcon/></span><small>Check-In</small></Link>
    <Link href="/dashboard/recovery" className={`client-dashboard-nav__item client-dashboard-nav__item--recovery${active('/dashboard/recovery')||active('/dashboard/sleep')||active('/dashboard/meditation')?' active':''}`} aria-current={active('/dashboard/recovery')||active('/dashboard/sleep')||active('/dashboard/meditation')?'page':undefined} data-nav-item="recovery" data-tutorial-id="dashboard-nav-recovery"><span className="client-dashboard-nav__icon"><RecoveryIcon/></span><small>Recovery</small></Link>
    <DashboardMoreMenu program={program}/>
  </nav>
}
