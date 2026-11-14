import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import DailyCheckInForm from '@/components/DailyCheckInForm'
import { getClientLocalDate, getClientTimeZone } from '@/lib/timezone'
import PhoneAppFrame from '@/components/phone-app/PhoneAppFrame'
import { getCycleStatus } from '@/lib/cycle/getCycleStatus'
import { cycleTrackingAllowed, readPeriodState } from '@/lib/cycle/periodState'
import { hasRecentRecordedPeriodStart, periodContextWindowStart } from '@/lib/symptoms/periodContext'
import Link from 'next/link'
import './check-in-safe-area.css'

export default async function DailyCheckInPage(){
  const {supabase,client}=await getDashboardContext(); const today=getClientLocalDate(client)
  const cycleTrackingEnabled=cycleTrackingAllowed(client)
  const windowStart = periodContextWindowStart(today)
  const [{data:log}, periodStartLogs, periodState] = await Promise.all([
    supabase.from('recovery_logs').select('*').eq('client_id',client.client_id).eq('log_date',today).maybeSingle(),
    cycleTrackingEnabled && windowStart
      ? supabase.from('cycle_logs').select('log_date, period_started')
        .eq('client_id',client.client_id).eq('auth_user_id',client.auth_user_id).eq('period_started',true)
        .gte('log_date',windowStart).lte('log_date',today).order('log_date',{ascending:false}).limit(1)
      : Promise.resolve({data:[]}),
    readPeriodState(supabase, client, today),
  ])
  const recentPeriodStart = cycleTrackingEnabled && hasRecentRecordedPeriodStart(today,client.last_period_start,periodStartLogs.data || [])
  const cycle = getCycleStatus(client)
  return <><div className="check-in-safe-area" aria-hidden="true" /><PhoneAppFrame eyebrow="Daily check-in" title="Let’s start with you." subtitle="How are you feeling today? Take a moment to check in, and we’ll meet you where you are."><main className="aos-flow-page"><div className="aos-flow-shell">
    {cycleTrackingEnabled && cycle.enabled && Number.isFinite(cycle.cycleDay) && Number(cycle.cycleDay) > 0 ? <div className="phone-app-cycle-strip"><span>Your cycle · Day {cycle.cycleDay}<small> · Estimated {cycle.phase?.replaceAll('_', ' ')} phase</small></span><Link href="/dashboard/cycle">Update</Link></div> : null}
    <DailyCheckInForm clientId={client.client_id} program={client.program||'ignite'} completed={Boolean(log?.check_in_completed_at)} localDate={today} timeZone={getClientTimeZone(client)} cycleTrackingEnabled={cycleTrackingEnabled} recentPeriodStart={recentPeriodStart} periodState={periodState} initial={{sleepHours:log?.sleep_hours,sleepQuality:log?.sleep_quality,stress:log?.stress_level,soreness:log?.soreness_level,energy:log?.energy_level,mood:log?.mood_level,hunger:log?.hunger_level,notes:log?.notes,sorenessRegions:log?.soreness_regions}}/></div></main></PhoneAppFrame></>
}
