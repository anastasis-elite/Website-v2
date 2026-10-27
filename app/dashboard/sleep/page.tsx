import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { getProgramLogicForClient } from '@/lib/dashboard/logic/getProgramLogicForClient'
import SleepLogger from '@/components/SleepLogger'
import PhoneAppFrame from '@/components/phone-app/PhoneAppFrame'
import { getClientLocalDate } from '@/lib/timezone'
import '@/components/phone-app/detail-screens.css'

export default async function SleepPage() {
  const {supabase,user,client}=await getDashboardContext(),today=getClientLocalDate(client)
  const [logic,{data:log,error:logError},{data:trend,error:trendError}]=await Promise.all([
    getProgramLogicForClient({supabase,user,client}),
    supabase.from('sleep_logs').select('*').eq('user_id',user.id).eq('client_id',client.client_id).eq('log_date',today).maybeSingle(),
    supabase.from('sleep_logs').select('duration_hours,quality,log_date').eq('user_id',user.id).eq('client_id',client.client_id).order('log_date',{ascending:false}).limit(7),
  ])
  const recorded = Boolean(log)
  return <PhoneAppFrame backHref="/dashboard/recovery" backLabel="Recovery" eyebrow="Recovery" title="Sleep" subtitle="Make space for rest."><main className="detail-content">
    {logError ? <p role="status">Your saved night could not be loaded. Refresh before editing it.</p> : <SleepLogger key={`${today}:${log?.updated_at||'new'}`} clientId={client.client_id} initial={{duration:log?.duration_hours??'',quality:log?.quality??'',bedtime:log?.bedtime||'',wakeTime:log?.wake_time||'',notes:log?.notes||''}}/>}
    <section className="detail-panel"><p className="phone-app-eyebrow">Recovery context</p><div className="sleep-context"><div><h3>Recovery impact</h3><p>{recorded?logic.recoveryStatus.reasoning:'Log your sleep to add context.'}</p></div><div><h3>Workout impact</h3><p>{recorded?logic.workoutDecision.reasonForModification:'Log your sleep to add context.'}</p></div></div></section>
    <section className="detail-panel"><h2>Recent sleep</h2>{trendError?<p role="status">Recent nights could not be loaded.</p>:trend?.length?<ul className="sleep-history">{trend.map((night:any)=><li key={night.log_date}><time>{night.log_date}</time><span>{night.duration_hours??'Not recorded'} hours · Quality {night.quality??'not recorded'}</span></li>)}</ul>:<p>Your recorded nights will appear here.</p>}</section>
  </main></PhoneAppFrame>
}
