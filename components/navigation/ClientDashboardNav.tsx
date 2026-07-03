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
  return <nav className="client-dashboard-nav" aria-label="Client dashboard navigation">
    <Link href={dashboard} className={active(dashboard)?'active':''}><span aria-hidden="true">⌂</span><small>Dashboard</small></Link>
    <Link href="/dashboard/nutrition" className={active('/dashboard/nutrition')?'active':''}><span aria-hidden="true">⌁</span><small>Nutrition</small></Link>
    <Link href={`${dashboard}/workout`} className={`client-dashboard-nav__flame ${active(`${dashboard}/workout`)?'active':''}`} aria-label="Open today’s workout"><span aria-hidden="true">🔥</span><small>Workout</small></Link>
    <Link href="/dashboard/recovery" className={active('/dashboard/recovery')||active('/dashboard/sleep')||active('/dashboard/check-in')||active('/dashboard/meditation')?'active':''}><span aria-hidden="true">♡</span><small>Recovery</small></Link>
    <DashboardMoreMenu program={program}/>
  </nav>
}
