import * as styles from '@/app/styles/globalstyles'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import DailyCheckInForm from '@/components/DailyCheckInForm'
import { getDailyExecutionPlan } from '@/lib/day/getDailyExecutionPlan'

export default async function DailyCheckInPage(){
  const {supabase,client}=await getDashboardContext(); const today=new Date().toISOString().slice(0,10)
  const dailyPlan=await getDailyExecutionPlan({supabase,client})
  const {data:log}=await supabase.from('recovery_logs').select('*').eq('client_id',client.client_id).eq('log_date',today).maybeSingle()
  const cycleTrackingEnabled=!['menopause','pregnant','not_tracking'].includes(String(client.reproductive_status||'cycling'))
  return <main style={styles.pageStyle}><div style={styles.containerStyle}><p style={styles.eyebrowStyle}>Daily Check-In</p><h1 style={styles.heroTitleStyle}>Tell the system what today feels like.</h1><p style={styles.heroTextStyle}>This is your daily body signal—not the monthly assessment. Your answers update recovery, fuel, symptoms, and today&apos;s workout decision.</p><section style={styles.cartBoxStyle}><p style={styles.eyebrowStyle}>Quick status</p><div style={styles.gridTwoCol}><p style={styles.bodyStyle}><strong>Nutrition:</strong> {dailyPlan?.nutritionLogged?'Logged today':'Needs input'}</p><p style={styles.bodyStyle}><strong>Water remaining:</strong> {Math.max(0,Math.round(Number(dailyPlan?.dailyRemaining?.water||0)))} oz</p></div></section><DailyCheckInForm clientId={client.client_id} program={client.program||'ignite'} cycleTrackingEnabled={cycleTrackingEnabled} initial={{sleepHours:log?.sleep_hours,sleepQuality:log?.sleep_quality,stress:log?.stress_level,soreness:log?.soreness_level,energy:log?.energy_level,mood:log?.mood_level,hunger:log?.hunger_level,notes:log?.notes}}/></div></main>
}
