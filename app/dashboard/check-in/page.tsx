import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import DailyCheckInForm from '@/components/DailyCheckInForm'
import { getClientLocalDate, getClientTimeZone } from '@/lib/timezone'
import PhoneAppFrame from '@/components/phone-app/PhoneAppFrame'
import { getCycleStatus } from '@/lib/cycle/getCycleStatus'
import { hasRecentRecordedPeriodStart, periodContextWindowStart } from '@/lib/symptoms/periodContext'
import Link from 'next/link'
import './check-in-safe-area.css'

export default async function DailyCheckInPage(){
  const {supabase,client}=await getDashboardContext(); const today=getClientLocalDate(client)
  const cycleTrackingEnabled=!['menopause','pregnant','not_tracking'].includes(String(client.reproductive_status||'cycling'))
  const windowStart = periodContextWindowStart(today)
  const [{data:log}, periodStartLogs] = await Promise.all([
    supabase.from('recovery_logs').select('*').eq('client_id',client.client_id).eq('log_date',today).maybeSingle(),
    cycleTrackingEnabled && windowStart
      ? supabase.from('cycle_logs').select('log_date, period_started')
        .eq('client_id',client.client_id).eq('auth_user_id',client.auth_user_id).eq('period_started',true)
        .gte('log_date',windowStart).lte('log_date',today).order('log_date',{ascending:false}).limit(1)
      : Promise.resolve({data:[]}),
  ])
  const recentPeriodStart = cycleTrackingEnabled && hasRecentRecordedPeriodStart(today,client.last_period_start,periodStartLogs.data || [])
  const cycle = getCycleStatus(client)
  return <><div className="check-in-safe-area" aria-hidden="true" /><PhoneAppFrame eyebrow="Daily check-in" title="How are you arriving today?" subtitle="A moment to notice what you need."><main className="aos-flow-page"><div className="aos-flow-shell">
    {cycleTrackingEnabled && cycle.enabled && Number.isFinite(cycle.cycleDay) && Number(cycle.cycleDay) > 0 ? <div className="phone-app-cycle-strip"><span>Your cycle · Day {cycle.cycleDay}<small> · Estimated {cycle.phase?.replaceAll('_', ' ')} phase</small></span><Link href="/dashboard/cycle">Update</Link></div> : null}
    <DailyCheckInForm clientId={client.client_id} program={client.program||'ignite'} completed={Boolean(log?.check_in_completed_at)} localDate={today} timeZone={getClientTimeZone(client)} cycleTrackingEnabled={cycleTrackingEnabled} recentPeriodStart={recentPeriodStart} initial={{sleepHours:log?.sleep_hours,sleepQuality:log?.sleep_quality,stress:log?.stress_level,soreness:log?.soreness_level,energy:log?.energy_level,mood:log?.mood_level,hunger:log?.hunger_level,notes:log?.notes,sorenessRegions:log?.soreness_regions}}/></div></main></PhoneAppFrame></>
}
