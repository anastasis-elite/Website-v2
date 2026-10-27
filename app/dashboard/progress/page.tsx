import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { getProgramLogicForClient } from '@/lib/dashboard/logic/getProgramLogicForClient'
import { getTierCapabilities } from '@/lib/entitlements'
import { ProgressTab, AssessmentsTab, TrendsTab } from '@/components/program-dashboard/TierAwareDashboardWorkspace'
import PhoneAppFrame from '@/components/phone-app/PhoneAppFrame'
import ProgressOverview from '@/components/program-dashboard/ProgressOverview'
import { loadProgressOverview, progressRange } from '@/lib/dashboard/progressOverview'
import styles from '@/components/program-dashboard/ProgressOverview.module.css'
export default async function ProgressPage({ searchParams }: { searchParams: Promise<{ range?: string | string[] }> }) {
 const {supabase,user,client} = await getDashboardContext()
 const range = progressRange((await searchParams).range)
 const [logic, overview] = await Promise.all([getProgramLogicForClient({supabase,user,client}), loadProgressOverview({supabase,userId:user.id,client,range})])
 return <PhoneAppFrame eyebrow="Progress" title="Look how far you’ve come." subtitle="There’s more to progress than a number."><main className={styles.content}>
   <ProgressOverview data={overview} program={logic.program}/>
   <details className={`daily-disclosure ${styles.details}`} id="progress-details" open><summary>Daily progress and consistency details</summary><ProgressTab logic={logic} tier={logic.program}/></details>
   <details className={`daily-disclosure ${styles.details}`}><summary>Assessments and requirements</summary><AssessmentsTab logic={logic} capabilities={getTierCapabilities(logic.program)}/></details>
   <details className={`daily-disclosure ${styles.details}`}><summary>Detailed trends</summary><TrendsTab logic={logic}/></details>
 </main></PhoneAppFrame>
}
