import StartContent from './StartContent'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { getMonthlyAssessmentStatus } from '@/lib/assessment/getMonthlyAssessmentStatus'
import Link from 'next/link'

export default async function Page({ searchParams }: { searchParams: Promise<{ assessmentType?: string }> }) {
  const query = await searchParams
  const {client,supabase} = await getDashboardContext()

  if (!client) {
    return null
  }

  if(query.assessmentType === 'monthly') {
    const status=await getMonthlyAssessmentStatus(supabase,client.client_id)
    if(!status.due) return <main className="aos-flow-page"><div className="aos-flow-shell"><h1>Your monthly check-in is already saved</h1><p>It opens again 30 days after your last submission. Today’s check-in stays available separately.</p><Link href="/dashboard/progress">Progress and assessments</Link></div></main>
  }
  return <StartContent client={client} assessmentType={query.assessmentType === 'monthly' ? 'monthly' : 'initial'} />
}
