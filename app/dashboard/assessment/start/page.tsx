import StartContent from './StartContent'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { getMonthlyAssessmentStatus } from '@/lib/assessment/getMonthlyAssessmentStatus'
import PhoneAppFrame from '@/components/phone-app/PhoneAppFrame'
import Link from 'next/link'
import '@/components/phone-app/assessments.css'

export default async function Page({ searchParams }: { searchParams: Promise<{ assessmentType?: string }> }) {
  const query = await searchParams
  const { client, supabase } = await getDashboardContext()
  if (!query.assessmentType || query.assessmentType === 'initial') return <StartContent client={client} />
  const status = await getMonthlyAssessmentStatus(supabase, client)
  if (status.unavailable) return <PhoneAppFrame eyebrow="Assessments" title="Assessment unavailable" subtitle="Your saved answers could not be loaded."><p className="assessment-notice">Refresh before continuing. No assessment has been saved.</p></PhoneAppFrame>
  const kind = query.assessmentType === 'review' ? 'review' : query.assessmentType === 'monthly' ? status.dueKind || 'review' : 'quarterly'
  if (kind === 'review' && status.dueKind === 'quarterly') return <PhoneAppFrame eyebrow="Assessments" title="Quarterly Assessment due" subtitle="Refresh your full assessment first."><main className="assessment-content"><p>The full assessment replaces this month’s review.</p><Link className="assessment-action" href="/dashboard/assessment/start?assessmentType=quarterly">Open Quarterly Assessment</Link></main></PhoneAppFrame>
  const canSubmit = status.dueKind === kind
  const notice = canSubmit ? undefined : kind === 'quarterly' ? `Your full assessment is up to date. It reopens ${status.nextFullDueDate}. Monthly reviews keep their own completion dates.` : `Your selections are up to date. The next review opens ${status.nextReviewDueDate}.`
  const draftVersion = `${status.lastCompletedAt || 'first'}:${status.lastReviewCompletedAt || 'none'}`
  return <StartContent key={`${kind}:${draftVersion}`} client={client} assessmentType={kind} savedAnswers={status.savedAnswers} canSubmit={canSubmit} notice={notice} draftVersion={draftVersion} />
}
