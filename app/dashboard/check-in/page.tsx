import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import DailyCheckInForm from '@/components/DailyCheckInForm'
import { getClientLocalDate, getClientTimeZone } from '@/lib/timezone'

export default async function DailyCheckInPage(){
  const {supabase,client}=await getDashboardContext(); const today=getClientLocalDate(client)
  const {data:log}=await supabase.from('recovery_logs').select('*').eq('client_id',client.client_id).eq('log_date',today).maybeSingle()
  const cycleTrackingEnabled=!['menopause','pregnant','not_tracking'].includes(String(client.reproductive_status||'cycling'))
  return <main className="aos-flow-page"><div className="aos-flow-shell"><header className="aos-flow-hero"><p className="aos-eyebrow">Daily Check-In</p><h1>A moment for you.</h1><p>Start with energy. Add more detail when it helps today&apos;s plan understand your day.</p></header><DailyCheckInForm clientId={client.client_id} program={client.program||'ignite'} completed={Boolean(log?.check_in_completed_at)} localDate={today} timeZone={getClientTimeZone(client)} cycleTrackingEnabled={cycleTrackingEnabled} initial={{sleepHours:log?.sleep_hours,sleepQuality:log?.sleep_quality,stress:log?.stress_level,soreness:log?.soreness_level,energy:log?.energy_level,mood:log?.mood_level,hunger:log?.hunger_level,notes:log?.notes,sorenessRegions:log?.soreness_regions}}/></div></main>
}
