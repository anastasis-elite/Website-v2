import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import DailyCheckInForm from '@/components/DailyCheckInForm'
import { getDailyExecutionPlan } from '@/lib/day/getDailyExecutionPlan'
import { AOSCard } from '@/components/aos-ui/AOSCard'
import { getClientLocalDate } from '@/lib/timezone'

export default async function DailyCheckInPage(){
  const {supabase,client}=await getDashboardContext(); const today=getClientLocalDate(client)
  const dailyPlan=await getDailyExecutionPlan({supabase,client})
  const {data:log}=await supabase.from('recovery_logs').select('*').eq('client_id',client.client_id).eq('log_date',today).maybeSingle()
  const cycleTrackingEnabled=!['menopause','pregnant','not_tracking'].includes(String(client.reproductive_status||'cycling'))
  return <main className="aos-flow-page"><div className="aos-flow-shell"><header className="aos-flow-hero"><p className="aos-eyebrow">Daily Check-In</p><h1>Tell the system what today feels like.</h1><p>This is your daily body signal—not the monthly assessment. Your answers update recovery, fuel, symptoms, and today&apos;s workout decision.</p></header><AOSCard className="aos-quick-status"><div><span>Nutrition</span><strong>{dailyPlan?.nutritionLogged?'Logged today':'Needs input'}</strong></div><div><span>Water remaining</span><strong>{Math.max(0,Math.round(Number(dailyPlan?.dailyRemaining?.water||0)))} oz</strong></div></AOSCard><DailyCheckInForm clientId={client.client_id} program={client.program||'ignite'} cycleTrackingEnabled={cycleTrackingEnabled} initial={{sleepHours:log?.sleep_hours,sleepQuality:log?.sleep_quality,stress:log?.stress_level,soreness:log?.soreness_level,energy:log?.energy_level,mood:log?.mood_level,hunger:log?.hunger_level,notes:log?.notes,sorenessRegions:log?.soreness_regions}}/></div></main>
}
