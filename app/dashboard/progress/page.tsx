import StrengthAssessmentSummary from '@/components/StrengthAssessmentSummary'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { getProgramLogicForClient } from '@/lib/dashboard/logic/getProgramLogicForClient'
import { getTierCapabilities } from '@/lib/entitlements'
import { ProgressTab, AssessmentsTab, TrendsTab } from '@/components/program-dashboard/TierAwareDashboardWorkspace'
export default async function ProgressPage() {
 const {supabase,user,client} = await getDashboardContext()
 const logic = await getProgramLogicForClient({supabase,user,client})
 return <main className="schedule-page"><div className="schedule-shell"><h1>Your progress and assessments</h1><p>Use your recorded history to see what is changing. Optional updates can wait until you have room.</p><StrengthAssessmentSummary status={logic.assessments.strength} client={client}/><section className="daily-disclosure"><h2>Progress</h2><ProgressTab logic={logic} tier={logic.program}/></section><details className="daily-disclosure"><summary>Assessments and requirements</summary><AssessmentsTab logic={logic} capabilities={getTierCapabilities(logic.program)}/></details><details className="daily-disclosure"><summary>Detailed trends</summary><TrendsTab logic={logic}/></details></div></main>
}
