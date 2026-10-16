import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { getProgramLogicForClient } from '@/lib/dashboard/logic/getProgramLogicForClient'
import { getTierCapabilities } from '@/lib/entitlements'
import { getDailyScheduleState } from '@/lib/schedule/service'
import { ProgressTab, AssessmentsTab, TrendsTab } from '@/components/program-dashboard/TierAwareDashboardWorkspace'
export default async function ProgressPage() {
 const {supabase,user,client} = await getDashboardContext()
 const logic = await getProgramLogicForClient({supabase,user,client})
 const schedule = await getDailyScheduleState({supabase,user,client,logic})
 const today = schedule.todayActivities
 return <main className="schedule-page"><div className="schedule-shell"><h1>Your progress and assessments</h1><p>Use your recorded history to see what is changing. Optional updates can wait until you have room.</p>{today ? <section className="daily-disclosure" aria-label="Today's required activities"><h2>Today’s progress</h2><p>{today.completed} of {today.total} required activities completed</p><p>Skipped activities do not count as completed. Calendar events do not count toward this total.</p></section> : null}<section className="daily-disclosure"><h2>Progress</h2><ProgressTab logic={logic} tier={logic.program}/></section><details className="daily-disclosure"><summary>Assessments and requirements</summary><AssessmentsTab logic={logic} capabilities={getTierCapabilities(logic.program)}/></details><details className="daily-disclosure"><summary>Detailed trends</summary><TrendsTab logic={logic}/></details></div></main>
}
